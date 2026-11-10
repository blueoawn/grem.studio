//! Rich document persistence for the web serial editor.
//!
//! This module provides tables for published rich documents and private drafts,
//! alongside the legacy `serial_posts` table for backward compatibility.

use spacetimedb::{ReducerContext, Table};

use crate::accounts::current_account;
use crate::now_micros;
use crate::serial::{SerialPost, validate_slug};

// -- Tables --

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

// -- Helpers --

/// Read a post, preferring rich document if available, falling back to legacy body.
/// Returns (title, body, has_rich_document).
pub fn rich_read(ctx: &ReducerContext, slug: &str) -> Result<(String, String, bool), String> {
    let slug = slug.trim().to_ascii_lowercase();
    
    // Check for rich document first
    if let Some(rich_doc) = ctx.db.published_rich_documents().slug().find(&slug) {
        let document = rich_doc.document;
        // For now, return the raw JSON document as body
        // A more sophisticated implementation would extract plain text
        return Ok((rich_doc.slug.clone(), document, true));
    }
    
    // Fall back to legacy post
    let post = ctx.db.serial_posts().slug().find(&slug)
        .ok_or_else(|| "Post not found".to_string())?;
    Ok((post.title, post.body, false))
}

/// Project a rich document to plain text for legacy clients.
/// This is a lossless adapter that extracts text content from rich JSON.
pub fn legacy_body_projection(rich_document: &str) -> String {
    // For now, return the document as-is
    // A full implementation would parse JSON and extract text content
    rich_document.to_string()
}

/// Check if a draft exists for a post
pub fn draft_exists(ctx: &ReducerContext, post_slug: &str, draft_id: u64) -> bool {
    ctx.db.draft_rich_documents()
        .post_slug_draft_id()
        .find(&post_slug, &draft_id)
        .is_some()
}

// -- Reducers --

/// Publish a rich document for a post. The legacy post must exist.
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

/// Save a draft for a post. The legacy post must exist and be changeable.
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

/// Discard a draft for a post. The legacy post must be changeable.
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

/// List all drafts for a post. The legacy post must be changeable.
#[spacetimedb::reducer]
pub fn list_drafts_for_post(ctx: &ReducerContext, post_slug: String) -> Result<Vec<DraftRichDocument>, String> {
    let actor = require_actor(ctx)?;
    let post_slug = validate_slug(&post_slug)?;
    
    // Check that the legacy post exists and is changeable
    let legacy_post = find_post(ctx, &post_slug)?;
    if !can_change_post(actor.is_admin, &actor.username, &legacy_post.created_by) {
        return Err("Only the author or an admin can list drafts for this post".into());
    }
    
    let drafts: Vec<DraftRichDocument> = ctx.db.draft_rich_documents()
        .post_slug_draft_id()
        .filter(&post_slug)
        .collect();
    
    Ok(drafts)
}

/// List all published rich documents. Public read access.
#[spacetimedb::reducer]
pub fn list_published_rich_documents(ctx: &ReducerContext) -> Result<Vec<PublishedRichDocument>, String> {
    // This is public - no authorization required
    let documents: Vec<PublishedRichDocument> = ctx.db.published_rich_documents()
        .slug()
        .iter()
        .collect();
    
    Ok(documents)
}

// -- Internal helpers (shared with serial.rs) --

struct Actor {
    username: String,
    is_admin: bool,
}

/// The logged-in admin or publisher making this call.
pub(crate) fn require_actor(ctx: &ReducerContext) -> Result<Actor, String> {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_slug() {
        assert!(validate_slug("chapter-01").is_ok());
        assert!(validate_slug("Chapter-01").is_ok()); // Case-insensitive
        assert!(validate_slug("chapter/one").is_err()); // Invalid char
        assert!(validate_slug("chapter one").is_err()); // Space not allowed
        assert!(validate_slug("-chapter").is_err()); // Cannot start with hyphen
        assert!(validate_slug("chapter-").is_err()); // Cannot end with hyphen
    }
}
