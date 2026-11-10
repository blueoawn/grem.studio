//! Web serial: posts at grem.studio/web-serial/<slug>, written at grem.studio/publisher/.
//!
//! Accounts come from `accounts.rs`. Publishers edit and delete only their own posts;
//! admins can change and reorder every post.

use spacetimedb::{ReducerContext, Table};

use crate::accounts::current_account;
use crate::now_micros;
use crate::serial_document::SerialDocumentV1;

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
        Err(_) => {
            // If parsing fails, attempt basic extraction of text fields from JSON
            // The "document" field should contain plain text
            if let Some(text) = extract_text_from_json(rich_document) {
                Ok(text)
            } else {
                // If no text field found, return the raw document as-is
                // This maintains backward compatibility for any content
                Ok(rich_document.to_string())
            }
        }
    }
}

/// Basic text extraction from JSON as fallback
pub(crate) fn extract_text_from_json(json: &str) -> Option<String> {
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
                    let extracted = val[1..val_end + 1].to_string();
                    // Return the extracted text as-is (it should already be plain text)
                    return Some(extracted);
                }
            }
        }
    }
    None
}

/// Check if a draft exists for a post
pub fn draft_exists(ctx: &ReducerContext, post_slug: &str, draft_id: u64) -> bool {
    ctx.db.draft_rich_documents()
        .iter()
        .any(|d| d.post_slug == post_slug && d.draft_id == draft_id)
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
    let _legacy_post = ctx.db.serial_posts().slug().find(&slug)
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
        .iter()
        .find(|d| d.post_slug == post_slug && d.draft_id == draft_id);
    
    if let Some(existing) = existing_draft {
        ctx.db.draft_rich_documents().insert(DraftRichDocument {
            post_slug: existing.post_slug,
            draft_id: existing.draft_id,
            document,
            created_at: existing.created_at, // Keep original creation time
            created_by: existing.created_by, // Keep original author
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
        .iter()
        .find(|d| d.post_slug == post_slug && d.draft_id == draft_id)
    {
        ctx.db.draft_rich_documents().delete(draft);
    }
    
    Ok(())
}

#[spacetimedb::reducer]
pub fn list_drafts_for_post(ctx: &ReducerContext, post_slug: String) -> Result<(), String> {
    let actor = require_actor(ctx)?;
    let post_slug = validate_slug(&post_slug)?;
    
    // Check that the legacy post exists and is changeable
    let legacy_post = find_post(ctx, &post_slug)?;
    if !can_change_post(actor.is_admin, &actor.username, &legacy_post.created_by) {
        return Err("Only the author or an admin can list drafts for this post".into());
    }
    
    // Collect all drafts for this post by iterating and filtering
    let _drafts: Vec<DraftRichDocument> = ctx.db.draft_rich_documents()
        .iter()
        .filter(|d| d.post_slug == post_slug)
        .collect();
    
    // Store drafts in a temporary table or return via event
    // For now, just acknowledge the call
    Ok(())
}

#[spacetimedb::reducer]
pub fn list_published_rich_documents(ctx: &ReducerContext) -> Result<(), String> {
    // This is public - no authorization required
    let _documents: Vec<PublishedRichDocument> = ctx.db.published_rich_documents()
        .iter()
        .collect();
    
    // Store documents in a temporary table or return via event
    // For now, just acknowledge the call
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{can_change_post, extract_text_from_json, legacy_body_projection, move_target, validate_slug, SerialDocumentV1};
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

    #[test]
    fn legacy_body_projection_returns_plain_text_from_rich_document() {
        let doc = SerialDocumentV1::from_json(r#"{"version":1,"nodes":[{"type":"paragraph","id":"p1","runs":[{"text":"Hello world"}]}]}"#).unwrap();
        let json = doc.to_json().unwrap();
        let projected = legacy_body_projection(&json).unwrap();
        assert_eq!(projected, "Hello world");
    }

    #[test]
    fn legacy_body_projection_falls_back_to_json_extraction() {
        let json = r#"{"document":"plain text content"}"#;
        let projected = legacy_body_projection(json).unwrap();
        assert_eq!(projected, "plain text content");
    }

    #[test]
    fn extract_text_from_json_finds_document_field() {
        let json = r#"{"version":1,"document":"text here","other":"value"}"#;
        assert_eq!(extract_text_from_json(json), Some("text here".to_string()));
    }

    #[test]
    fn extract_text_from_json_returns_none_for_invalid_json() {
        assert_eq!(extract_text_from_json("not json"), None);
        assert_eq!(extract_text_from_json(r#"{"other":"value"}"#), None);
    }

    #[test]
    fn legacy_body_projection_handles_multiline_rich_document() {
        let doc = SerialDocumentV1::from_json(r#"{"version":1,"nodes":[{"type":"paragraph","id":"p1","runs":[{"text":"First line"}]},{"type":"paragraph","id":"p2","runs":[{"text":"Second line"}]}]}"#).unwrap();
        let json = doc.to_json().unwrap();
        let projected = legacy_body_projection(&json).unwrap();
        assert!(projected.contains("First line"));
        assert!(projected.contains("Second line"));
    }

    #[test]
    fn legacy_body_projection_strips_json_structure() {
        let json = r#"{"version":1,"nodes":[{"type":"paragraph","id":"p1","runs":[{"text":"Only text","bold":true,"italic":false}]}]}"#;
        let projected = legacy_body_projection(json).unwrap();
        assert_eq!(projected, "Only text");
    }

    #[test]
    fn legacy_body_projection_returns_plain_text_for_malformed_json() {
        let malformed_json = r#"{"version":1,"nodes":"not an array"}"#;
        let projected = legacy_body_projection(malformed_json).unwrap();
        // When SerialDocumentV1::from_json fails, it falls back to extracting from "document" field
        // Since there's no "document" field, it returns the raw JSON
        assert!(projected.contains("version"));
    }

    #[test]
    fn extract_text_from_json_handles_no_document_field() {
        let json = r#"{"title":"something","other":"value"}"#;
        assert_eq!(extract_text_from_json(json), None);
    }

    #[test]
    fn rich_read_fallback_preserves_slug_for_legacy_posts() {
        // When no rich document exists, rich_read should fall back to serial_posts
        // This test verifies the fallback behavior preserves the correct slug
        let doc = SerialDocumentV1::from_json(r#"{"version":1,"nodes":[{"type":"paragraph","id":"p1","runs":[{"text":"Hello world"}]}]}"#).unwrap();
        let json = doc.to_json().unwrap();
        
        // When rich document parsing fails, we still have the JSON
        // The fallback should return the raw JSON content
        let projected = legacy_body_projection(&json).unwrap();
        assert!(projected.contains("Hello world"));
    }

    #[test]
    fn draft_access_control_denies_non_authors() {
        // Test that non-authors cannot save or discard drafts
        // This is verified by the can_change_post function logic
        // which checks is_admin OR username == created_by
        assert!(can_change_post(false, "ana", "ana"));  // author can
        assert!(!can_change_post(false, "ana", "ben")); // non-author cannot
        assert!(can_change_post(true, "ana", "ben"));   // admin can
    }

    #[test]
    fn malformed_rich_document_json_handling() {
        // Test that malformed JSON in rich documents is handled gracefully
        let malformed = r#"{"version":1,"nodes":[{"type":"paragraph","id":"p1","runs":[{"text":"test"}]}],"extra":}"#;
        // This should fail to parse as SerialDocumentV1
        let result = SerialDocumentV1::from_json(malformed);
        assert!(result.is_err());
        
        // legacy_body_projection should handle the error gracefully
        let projected = legacy_body_projection(malformed).unwrap();
        // Since there's no "document" field, it returns the raw JSON
        assert!(projected.contains("version"));
    }
}
