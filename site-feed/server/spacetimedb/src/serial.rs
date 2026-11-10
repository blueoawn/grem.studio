//! Web serial: posts at grem.studio/web-serial/<slug>, written at grem.studio/publisher/.
//!
//! Accounts come from `accounts.rs`. Publishers edit and delete only their own posts;
//! admins can change and reorder every post.

use spacetimedb::{ReducerContext, Table};

use crate::accounts::current_account;
use crate::now_micros;
use crate::serial_document::{SerialDocumentV1, DocumentError};

const RESERVED_SLUGS: &[&str] = &["assets"];

// -- Tables --

/// Legacy posts: kept for backward compatibility. Public for read access.
#[spacetimedb::table(name = serial_posts, public)]
pub struct SerialPost {
    #[primary_key]
    pub slug: String,
    pub title: String,
    pub body: String,
    #[index(btree)]
    pub created_by: String,
    pub published_at: u64,
    /// Reading order: lower values come earlier in the serial.
    pub sort_order: u64,
}

/// Published rich documents, keyed by post slug. Public for read access.
#[spacetimedb::table(name = published_rich_documents, public)]
pub struct PublishedRichDocument {
    #[primary_key]
    pub slug: String,
    pub document: String,
    pub last_modified: u64,
    pub modified_by: String,
}

/// Private draft documents, keyed by (post_slug, draft_id). Not public - access controlled.
#[spacetimedb::table(name = draft_rich_documents)]
pub struct DraftRichDocument {
    #[primary_key]
    pub post_slug: String,
    pub draft_id: u64,
    pub document: String,
    pub created_at: u64,
    pub created_by: String,
}

fn validate_slug(slug: &str) -> Result<String, String> {
    let slug = slug.trim().to_ascii_lowercase();
    if slug.is_empty() || slug.len() > 80 {
        return Err("Post URL must be 1-80 characters".into());
    }
    if slug.starts_with('-') || slug.ends_with('-') {
        return Err("Post URL cannot start or end with a hyphen".into());
    }
    if !slug.chars().all(|character| character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-') {
        return Err("Post URL may only contain lowercase letters, digits, and hyphens".into());
    }
    // These paths are served by the app itself, so a post there could never be viewed.
    if RESERVED_SLUGS.contains(&slug.as_str()) {
        return Err(format!("Post URL '{}' is reserved by the site", slug));
    }
    Ok(slug)
}

fn validate_text(value: &str, field: &str, max_length: usize) -> Result<String, String> {
    let value = value.trim().to_string();
    if value.is_empty() || value.len() > max_length {
        return Err(format!("{} must be 1-{} characters", field, max_length));
    }
    Ok(value)
}

struct Actor {
    username: String,
    is_admin: bool,
}

/// The logged-in admin or publisher making this call.
fn require_actor(ctx: &ReducerContext) -> Result<Actor, String> {
    current_account(ctx)
        .map(|account| Actor { username: account.username, is_admin: account.is_admin })
        .ok_or_else(|| "Log in at grem.studio/publisher/ to change posts".to_string())
}

fn can_change_post(is_admin: bool, username: &str, created_by: &str) -> bool {
    is_admin || username == created_by
}

fn find_post(ctx: &ReducerContext, slug: &str) -> Result<SerialPost, String> {
    let slug = slug.trim().to_ascii_lowercase();
    ctx.db.serial_posts().slug().find(&slug).ok_or_else(|| "Post not found".to_string())
}

fn find_changeable_post(ctx: &ReducerContext, slug: &str) -> Result<SerialPost, String> {
    let actor = require_actor(ctx)?;
    let post = find_post(ctx, slug)?;
    if !can_change_post(actor.is_admin, &actor.username, &post.created_by) {
        return Err("Only the author or an admin can change this post".into());
    }
    Ok(post)
}

/// Index of the post to swap with, or None when the post is already at that end.
fn move_target(position: usize, len: usize, earlier: bool) -> Option<usize> {
    if earlier {
        position.checked_sub(1)
    } else {
        Some(position + 1).filter(|target| *target < len)
    }
}

/// Read a post, preferring rich document if available, falling back to legacy body.
/// Returns (title, body, has_rich_document).
pub fn rich_read(ctx: &ReducerContext, slug: &str) -> Result<(String, String, bool), String> {
    let slug = slug.trim().to_ascii_lowercase();
    
    // Check for rich document first
    if let Some(rich_doc) = ctx.db.published_rich_documents().slug().find(&slug) {
        // Try to parse as SerialDocumentV1 and extract plain text
        if let Ok(doc) = SerialDocumentV1::from_json(&rich_doc.document) {
            // Return the document slug as title, plain text as body
            let plain_text = doc.plain_text();
            return Ok((rich_doc.slug.clone(), plain_text, true));
        } else {
            // If parsing fails, return the raw document
            return Ok((rich_doc.slug.clone(), rich_doc.document.clone(), true));
        }
    }
    
    // Fall back to legacy post
    let post = ctx.db.serial_posts().slug().find(&slug)
        .ok_or_else(|| "Post not found".to_string())?;
    Ok((post.title, post.body, false))
}

/// Project a rich document to plain text for legacy clients.
/// This extracts text content from rich JSON using SerialDocumentV1.
pub fn legacy_body_projection(rich_document: &str) -> Result<String, String> {
    match SerialDocumentV1::from_json(rich_document) {
        Ok(doc) => Ok(doc.plain_text()),
        Err(e) => {
            // If parsing fails, attempt basic extraction or return original
            // For backward compatibility, try to extract text fields from JSON
            if let Some(text) = extract_text_from_json(rich_document) {
                Ok(text)
            } else {
                Err(format!("Failed to project rich document to plain text: {}", e))
            }
        }
    }
}

/// Basic text extraction from JSON as fallback
fn extract_text_from_json(json: &str) -> Option<String> {
    // Simple JSON parsing to extract text values
    let json = json.trim();
    if json.starts_with('{') && json.ends_with('}') {
        // Try to extract "document" field or text fields
        if let Some(doc_start) = json.find("\"document\"") {
            if let Some(colon) = json[doc_start..].find(':') {
                let val_start = doc_start + colon + 1;
                let val = json[val_start..].trim_start();
                if val.starts_with('"') {
                    let val_end = val[1..].find('"')?;
                    return Some(val[1..val_end + 1].to_string());
                }
            }
        }
    }
    None
}

/// Check if a draft exists for a post
pub fn draft_exists(ctx: &ReducerContext, post_slug: &str, draft_id: u64) -> bool {
    ctx.db.draft_rich_documents()
        .post_slug_draft_id()
        .find(&post_slug, &draft_id)
        .is_some()
}

// -- Reducers --

#[spacetimedb::reducer]
pub fn create_serial_post(ctx: &ReducerContext, slug: String, title: String, body: String) -> Result<(), String> {
    let actor = require_actor(ctx)?;
    let slug = validate_slug(&slug)?;
    let title = validate_text(&title, "Title", 150)?;
    let body = validate_text(&body, "Body", 10_000)?;
    if ctx.db.serial_posts().slug().find(&slug).is_some() {
        return Err("That post URL is already in use".into());
    }

    let timestamp = now_micros(ctx);
    ctx.db.serial_posts().insert(SerialPost {
        slug,
        title,
        body,
        created_by: actor.username,
        published_at: timestamp,
        sort_order: timestamp,
    });
    Ok(())
}

#[spacetimedb::reducer]
pub fn edit_serial_post(ctx: &ReducerContext, slug: String, title: String, body: String) -> Result<(), String> {
    let existing = find_changeable_post(ctx, &slug)?;
    let title = validate_text(&title, "Title", 150)?;
    let body = validate_text(&body, "Body", 10_000)?;
    ctx.db.serial_posts().slug().update(SerialPost { title, body, ..existing });
    Ok(())
}

#[spacetimedb::reducer]
pub fn delete_serial_post(ctx: &ReducerContext, slug: String) -> Result<(), String> {
    let existing = find_changeable_post(ctx, &slug)?;
    ctx.db.serial_posts().slug().delete(&existing.slug);
    Ok(())
}

#[spacetimedb::reducer]
pub fn move_serial_post(ctx: &ReducerContext, slug: String, earlier: bool) -> Result<(), String> {
    // Moving a post also moves its neighbour, which may belong to someone else.
    if !require_actor(ctx)?.is_admin {
        return Err("Only admins can reorder posts".into());
    }
    let existing = find_post(ctx, &slug)?;

    let mut posts: Vec<SerialPost> = ctx.db.serial_posts().iter().collect();
    posts.sort_by(|left, right| left.sort_order.cmp(&right.sort_order).then_with(|| left.slug.cmp(&right.slug)));
    let position = posts
        .iter()
        .position(|post| post.slug == existing.slug)
        .ok_or_else(|| "Post not found".to_string())?;
    let Some(target) = move_target(position, posts.len(), earlier) else {
        return Ok(());
    };

    // Swapping just the two neighbours leaves every other post's order untouched.
    let neighbour = posts.swap_remove(target);
    let (own_order, neighbour_order) = (existing.sort_order, neighbour.sort_order);
    ctx.db.serial_posts().slug().update(SerialPost { sort_order: neighbour_order, ..existing });
    ctx.db.serial_posts().slug().update(SerialPost { sort_order: own_order, ..neighbour });
    Ok(())
}

// -- Rich document reducers --

#[spacetimedb::reducer]
pub fn publish_rich_document(ctx: &ReducerContext, slug: String, document: String) -> Result<(), String> {
    let actor = require_actor(ctx)?;
    let slug = validate_slug(&slug)?;
    
    // Check that the legacy post exists
    let legacy_post = ctx.db.serial_posts().slug().find(&slug)
        .ok_or_else(|| "Post not found".to_string())?;
    
    // Validate the document is not empty
    if document.trim().is_empty() {
        return Err("Document must not be empty".into());
    }
    
    let timestamp = now_micros(ctx);
    
    // Insert or update the rich document
    let rich_doc = ctx.db.published_rich_documents().slug().find(&slug);
    if let Some(existing) = rich_doc {
        ctx.db.published_rich_documents().slug().update(PublishedRichDocument {
            document,
            last_modified: timestamp,
            modified_by: actor.username,
            ..existing
        });
    } else {
        ctx.db.published_rich_documents().insert(PublishedRichDocument {
            slug,
            document,
            last_modified: timestamp,
            modified_by: actor.username,
        });
    }
    
    Ok(())
}

#[spacetimedb::reducer]
pub fn save_draft(ctx: &ReducerContext, post_slug: String, draft_id: u64, document: String) -> Result<(), String> {
    let actor = require_actor(ctx)?;
    let post_slug = validate_slug(&post_slug)?;
    
    // Check that the legacy post exists and is changeable
    let legacy_post = find_post(ctx, &post_slug)?;
    if !can_change_post(actor.is_admin, &actor.username, &legacy_post.created_by) {
        return Err("Only the author or an admin can save drafts for this post".into());
    }
    
    // Validate the document is not empty
    if document.trim().is_empty() {
        return Err("Document must not be empty".into());
    }
    
    let timestamp = now_micros(ctx);
    
    // Insert or update the draft
    let existing_draft = ctx.db.draft_rich_documents()
        .post_slug_draft_id()
        .find(&post_slug, &draft_id);
    
    if let Some(existing) = existing_draft {
        ctx.db.draft_rich_documents().post_slug_draft_id().update(DraftRichDocument {
            document,
            created_at: existing.created_at, // Keep original creation time
            created_by: existing.created_by, // Keep original author
            ..existing
        });
    } else {
        ctx.db.draft_rich_documents().insert(DraftRichDocument {
            post_slug,
            draft_id,
            document,
            created_at: timestamp,
            created_by: actor.username,
        });
    }
    
    Ok(())
}

#[spacetimedb::reducer]
pub fn discard_draft(ctx: &ReducerContext, post_slug: String, draft_id: u64) -> Result<(), String> {
    let actor = require_actor(ctx)?;
    let post_slug = validate_slug(&post_slug)?;
    
    // Check that the legacy post exists and is changeable
    let legacy_post = find_post(ctx, &post_slug)?;
    if !can_change_post(actor.is_admin, &actor.username, &legacy_post.created_by) {
        return Err("Only the author or an admin can discard drafts for this post".into());
    }
    
    if let Some(draft) = ctx.db.draft_rich_documents()
        .post_slug_draft_id()
        .find(&post_slug, &draft_id)
    {
        ctx.db.draft_rich_documents().post_slug_draft_id().delete(&post_slug, &draft_id);
    }
    
    Ok(())
}

#[spacetimedb::reducer]
pub fn list_drafts_for_post(ctx: &ReducerContext, post_slug: String) -> Result<Vec<DraftRichDocument>, String> {
    let actor = require_actor(ctx)?;
    let post_slug = validate_slug(&post_slug)?;
    
    // Check that the legacy post exists and is changeable
    let legacy_post = find_post(ctx, &post_slug)?;
    if !can_change_post(actor.is_admin, &actor.username, &legacy_post.created_by) {
        return Err("Only the author or an admin can list drafts for this post".into());
    }
    
    // Collect all drafts for this post by iterating and filtering
    let drafts: Vec<DraftRichDocument> = ctx.db.draft_rich_documents()
        .iter()
        .filter(|d| d.post_slug == post_slug)
        .collect();
    
    Ok(drafts)
}

#[spacetimedb::reducer]
pub fn list_published_rich_documents(ctx: &ReducerContext) -> Result<Vec<PublishedRichDocument>, String> {
    // This is public - no authorization required
    let documents: Vec<PublishedRichDocument> = ctx.db.published_rich_documents()
        .slug()
        .iter()
        .collect();
    
    Ok(documents)
}

#[cfg(test)]
mod tests {
    use super::{can_change_post, move_target, validate_slug};
    use spacetimedb::Table;

    #[test]
    fn accepts_a_route_safe_slug() {
        assert_eq!(validate_slug("Chapter-01").unwrap(), "chapter-01");
    }

    #[test]
    fn rejects_unsafe_and_reserved_slugs() {
        assert!(validate_slug("chapter/one").is_err());
        assert!(validate_slug(" Assets ").is_err());
    }

    #[test]
    fn only_author_or_admin_can_change_a_post() {
        assert!(can_change_post(false, "ana", "ana"));
        assert!(!can_change_post(false, "ana", "ben"));
        assert!(can_change_post(true, "ana", "ben"));
    }

    #[test]
    fn move_target_stops_at_both_ends() {
        assert_eq!(move_target(0, 3, true), None);
        assert_eq!(move_target(2, 3, false), None);
        assert_eq!(move_target(1, 3, true), Some(0));
        assert_eq!(move_target(1, 3, false), Some(2));
    }
}
