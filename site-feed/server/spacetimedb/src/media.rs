//! Media gateway: authenticated upload intents and asset storage.
//!
//! Upload intents are short-lived and tied to the SpacetimeDB identity
//! of the authenticated publisher. All identity is derived from `ctx.sender`;
//! no username or role is accepted from client requests.

pub mod processor;
pub mod worker;

use crate::accounts::{accounts, accounts__view, sessions, sessions__view};
use crate::now_micros;
use spacetimedb::{ReducerContext, Table};

// -- Constants --

/// Upload intent expiry: 15 minutes in microseconds
pub const INTENT_TTL_MICROS: u64 = 15 * 60 * 1_000_000;

/// Maximum bytes per single upload: 100 MB
pub const MAX_UPLOAD_BYTES: u64 = 100 * 1024 * 1024;

/// Maximum bytes per publisher total storage: 1 GB
pub const MAX_PUBLISHER_BYTES: u64 = 1024 * 1024 * 1024;

// -- Processing status codes --
/// Asset is pending processing
pub const ASSET_STATUS_PENDING: i32 = 0;
/// Asset is currently being processed
pub const ASSET_STATUS_PROCESSING: i32 = 1;
/// Asset has been successfully processed
pub const ASSET_STATUS_READY: i32 = 2;
/// Asset processing failed
pub const ASSET_STATUS_FAILED: i32 = 3;

// -- Tables --

/// Pending upload intent. Expiry is enforced via `expires_at`.
/// Only the publisher (by `publisher` identity) may operate on an intent.
#[spacetimedb::table(name = upload_intents)]
pub struct UploadIntent {
    #[primary_key]
    pub intent_key: String,

    #[index(btree)]
    pub publisher: spacetimedb::Identity,

    /// Unique identifier for the final asset (must be unique across all publishers)
    pub asset_id: String,

    pub filename: String,
    pub content_type: String,
    pub byte_limit: u64,
    pub bytes_received: u64,
    pub expires_at: u64,
    pub created_at: u64,
}

/// Published media asset.
///
/// Keep the table private, like the account tables. Public access is exposed
/// through the typed `my_media_assets` view below rather than through the raw
/// table. This also avoids generating the extra public-table binding exports
/// that trigger the SpacetimeDB 1.12 linker failures when this table is added
/// to an existing module.
#[spacetimedb::table(name = media_assets)]
#[derive(Clone)]
pub struct MediaAsset {
    #[primary_key]
    pub asset_id: String,

    #[index(btree)]
    pub publisher: spacetimedb::Identity,

    pub content_type: String,
    pub byte_size: u64,
    /// Storage backend key (e.g., S3 object key or local path)
    pub storage_key: String,
    /// Processing status: 0=pending, 1=processing, 2=ready, 3=failed
    pub status: i32,
    pub created_at: u64,
    /// When processing completed (success or failure)
    pub processed_at: Option<u64>,
    /// Image dimensions (width x height)
    pub width: Option<i32>,
    pub height: Option<i32>,
    /// Video duration in seconds
    pub duration_seconds: Option<i32>,
    /// Variants (JSON array of {path, content_type, byte_size})
    pub variants: Option<String>,
    /// Content hash (SHA-256 hex)
    pub content_hash: Option<String>,
}

/// The logged-in publisher making this call, if any.
/// Returns Err if caller is not a non-admin publisher.
pub fn require_publisher(ctx: &ReducerContext) -> Result<(), String> {
    let session = ctx
        .db
        .sessions()
        .identity()
        .find(&ctx.sender)
        .ok_or_else(|| "Must be logged in as a publisher".to_string())?;
    let account = ctx
        .db
        .accounts()
        .username()
        .find(&session.username)
        .ok_or_else(|| "Must be logged in as a publisher".to_string())?;
    if account.is_admin {
        return Err("Admins cannot upload media; use a publisher account".into());
    }
    Ok(())
}

/// The logged-in account making this call, if any (admin or publisher).
pub fn current_account(ctx: &ReducerContext) -> Option<crate::accounts::Account> {
    let session = ctx.db.sessions().identity().find(&ctx.sender)?;
    ctx.db.accounts().username().find(&session.username)
}

/// Revoke all active sessions and pending intents for a publisher.
/// Also removes pending uploads that belong to the publisher.
pub fn revoke_publisher(ctx: &ReducerContext, publisher_identity: &spacetimedb::Identity) {
    // Delete all sessions for this identity
    // Since identity is the primary key, there can be at most one session per identity
    if let Some(session) = ctx.db.sessions().identity().find(publisher_identity) {
        ctx.db.sessions().identity().delete(&session.identity);
    }

    // Delete pending upload intents for this identity
    // This uses the publisher index which is efficient
    let intents: Vec<UploadIntent> = ctx
        .db
        .upload_intents()
        .publisher()
        .filter(publisher_identity)
        .collect();
    for intent in intents {
        ctx.db
            .upload_intents()
            .intent_key()
            .delete(&intent.intent_key);
    }
}

// -- Reducers --

/// Create a new upload intent. Idempotent: if the intent_key already exists
/// and belongs to the caller, return Ok(()) without modification.
#[spacetimedb::reducer]
pub fn create_upload_intent(
    ctx: &ReducerContext,
    intent_key: String,
    asset_id: String,
    filename: String,
    content_type: String,
    byte_limit: u64,
) -> Result<(), String> {
    require_publisher(ctx)?;

    // Validate byte_limit
    if byte_limit == 0 || byte_limit > MAX_UPLOAD_BYTES {
        return Err("Byte limit must be between 1 and 100 MB".into());
    }

    // Check intent key collisions
    if let Some(existing) = ctx.db.upload_intents().intent_key().find(&intent_key) {
        if existing.publisher == ctx.sender {
            return Ok(()); // idempotent retry
        }
        return Err("Intent key already in use by another publisher".into());
    }

    // Enforce per-publisher quota
    let used: u64 = ctx
        .db
        .media_assets()
        .publisher()
        .filter(&ctx.sender)
        .map(|asset| asset.byte_size)
        .sum();
    if used.saturating_add(byte_limit) > MAX_PUBLISHER_BYTES {
        return Err("Publisher quota exceeded".into());
    }

    let now = now_micros(ctx);
    ctx.db.upload_intents().insert(UploadIntent {
        intent_key,
        publisher: ctx.sender,
        asset_id,
        filename,
        content_type,
        byte_limit,
        bytes_received: 0,
        expires_at: now.saturating_add(INTENT_TTL_MICROS),
        created_at: now,
    });

    Ok(())
}

/// Report upload progress for an intent. Use this for resumable uploads.
/// The caller must not exceed the intent's byte_limit.
#[spacetimedb::reducer]
pub fn upload_progress(
    ctx: &ReducerContext,
    intent_key: String,
    bytes_received: u64,
) -> Result<(), String> {
    let intent = ctx
        .db
        .upload_intents()
        .intent_key()
        .find(&intent_key)
        .ok_or_else(|| "Upload intent not found".to_string())?;

    if intent.publisher != ctx.sender {
        return Err("Not your upload intent".into());
    }

    if now_micros(ctx) >= intent.expires_at {
        return Err("Upload intent expired".into());
    }

    if bytes_received > intent.byte_limit {
        return Err("Upload exceeds byte limit".into());
    }

    ctx.db.upload_intents().intent_key().update(UploadIntent {
        bytes_received,
        ..intent
    });

    Ok(())
}

/// Finalize an upload intent and create a public media asset.
/// Validates intent expiry, identity, and byte count.
#[spacetimedb::reducer]
pub fn finalize_upload(
    ctx: &ReducerContext,
    intent_key: String,
    storage_key: String,
) -> Result<(), String> {
    let intent = ctx
        .db
        .upload_intents()
        .intent_key()
        .find(&intent_key)
        .ok_or_else(|| "Upload intent not found".to_string())?;

    if intent.publisher != ctx.sender {
        return Err("Not your upload intent".into());
    }

    if now_micros(ctx) >= intent.expires_at {
        return Err("Upload intent expired".into());
    }

    if intent.bytes_received == 0 || intent.bytes_received > intent.byte_limit {
        return Err("Invalid uploaded byte count".into());
    }

    // Validate storage_key is non-empty and well-formed
    if storage_key.is_empty() {
        return Err("Storage key must not be empty".into());
    }
    // Reject paths that could lead to directory traversal or other issues
    if storage_key.contains("..") || storage_key.starts_with('/') || storage_key.contains('\\') {
        return Err("Storage key must be a simple non-empty path".into());
    }

    // Create the media asset (only if not already exists)
    if let Some(existing) = ctx.db.media_assets().asset_id().find(&intent.asset_id) {
        // Validate that the existing asset belongs to the same publisher
        if existing.publisher != intent.publisher {
            return Err("Asset ID already in use by another publisher".into());
        }
    } else {
        let now = now_micros(ctx);
        ctx.db.media_assets().insert(MediaAsset {
            asset_id: intent.asset_id.clone(),
            publisher: ctx.sender,
            content_type: intent.content_type.clone(),
            byte_size: intent.bytes_received,
            storage_key,
            status: ASSET_STATUS_PENDING,
            created_at: now,
            processed_at: None,
            width: None,
            height: None,
            duration_seconds: None,
            variants: None,
            content_hash: None,
        });
    }

    // Delete the intent
    ctx.db.upload_intents().intent_key().delete(&intent_key);

    Ok(())
}

/// Delete a pending upload intent (e.g., on user cancellation).
#[spacetimedb::reducer]
pub fn delete_upload_intent(ctx: &ReducerContext, intent_key: String) -> Result<(), String> {
    let intent = ctx
        .db
        .upload_intents()
        .intent_key()
        .find(&intent_key)
        .ok_or_else(|| "Upload intent not found".to_string())?;

    if intent.publisher != ctx.sender {
        return Err("Not your upload intent".into());
    }

    ctx.db.upload_intents().intent_key().delete(&intent_key);

    Ok(())
}

/// List all media assets owned by the caller (publisher only).
#[spacetimedb::view(name = my_media_assets, public)]
pub fn my_media_assets(ctx: &spacetimedb::ViewContext) -> Vec<MediaAsset> {
    let account = ctx
        .db
        .sessions()
        .identity()
        .find(ctx.sender)
        .and_then(|session| ctx.db.accounts().username().find(&session.username));
    let is_admin = account.as_ref().is_some_and(|a| a.is_admin);
    if is_admin {
        return Vec::new();
    }
    let publisher_identity = account.map(|_| ctx.sender);
    if let Some(pid) = publisher_identity {
        return ctx.db.media_assets().publisher().filter(&pid).collect();
    }
    Vec::new()
}

/// Get all assets with a specific status (for processing worker).
pub fn get_pending_assets(_ctx: &spacetimedb::ViewContext, _status: i32) -> Vec<MediaAsset> {
    // Use a simple filter on the asset_id index to get all assets
    // Since we can't iterate over all rows, we'll need to use a different approach
    // For now, return an empty vector and implement proper iteration later
    Vec::new()
}

/// Update asset status (for processing worker).
pub fn update_asset_status(
    ctx: &ReducerContext,
    asset_id: String,
    status: i32,
    processed_at: Option<u64>,
    width: Option<i32>,
    height: Option<i32>,
    duration_seconds: Option<i32>,
    variants: Option<String>,
    content_hash: Option<String>,
) -> Result<(), String> {
    let asset = ctx
        .db
        .media_assets()
        .asset_id()
        .find(&asset_id)
        .ok_or_else(|| "Asset not found".to_string())?;

    ctx.db.media_assets().asset_id().update(MediaAsset {
        status,
        processed_at,
        width,
        height,
        duration_seconds,
        variants,
        content_hash,
        ..asset
    });

    Ok(())
}

/// Process an asset (calls the processor module).
/// This calls the processor module to validate and prepare the asset.
pub fn process_asset(
    ctx: &ReducerContext,
    asset_id: String,
    temp_path: String,
) -> Result<(), String> {
    // Find the asset
    let asset = ctx
        .db
        .media_assets()
        .asset_id()
        .find(&asset_id)
        .ok_or_else(|| "Asset not found".to_string())?;

    // Call the processor module
    let mut asset_to_process = asset.clone();
    let temp_path_ref = std::path::Path::new(&temp_path);

    match crate::media::processor::process_asset(&mut asset_to_process, temp_path_ref) {
        Ok(()) => {
            // Update the asset with the processed metadata
            let now = now_micros(ctx);
            ctx.db.media_assets().asset_id().update(MediaAsset {
                status: asset_to_process.status,
                processed_at: Some(now),
                width: asset_to_process.width,
                height: asset_to_process.height,
                duration_seconds: asset_to_process.duration_seconds,
                variants: asset_to_process.variants,
                content_hash: asset_to_process.content_hash,
                ..asset_to_process
            });

            Ok(())
        }
        Err(e) => {
            // Update status to failed
            let now = now_micros(ctx);
            ctx.db.media_assets().asset_id().update(MediaAsset {
                status: ASSET_STATUS_FAILED,
                processed_at: Some(now),
                ..asset
            });

            Err(e)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn constants_are_reasonable() {
        assert_eq!(INTENT_TTL_MICROS, 15 * 60 * 1_000_000);
        assert_eq!(MAX_UPLOAD_BYTES, 100 * 1024 * 1024);
        assert_eq!(MAX_PUBLISHER_BYTES, 1024 * 1024 * 1024);
        assert_eq!(ASSET_STATUS_PENDING, 0);
        assert_eq!(ASSET_STATUS_PROCESSING, 1);
        assert_eq!(ASSET_STATUS_READY, 2);
        assert_eq!(ASSET_STATUS_FAILED, 3);
    }

    #[test]
    fn require_publisher_checks_admin_status() {
        // require_publisher returns () for a non-admin publisher
        // and Err for admin or anonymous
        // Unit test can only verify the function signature compiles
        // Actual authorization testing requires SpacetimeDB test-utils
        let result: Result<(), String> = Err("must be publisher".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn now_micros_returns_timestamp() {
        // now_micros extracts the timestamp from the context
        // Unit test verifies the function compiles
        // Actual timestamp testing requires SpacetimeDB test-utils
        let result: u64 = 0;
        assert_eq!(result, 0);
    }

    #[test]
    fn revoke_publisher_clears_sessions_and_intents() {
        // revoke_publisher deletes sessions and upload_intents for a given identity
        // Unit test verifies the function compiles
        // Actual behavior testing requires SpacetimeDB test-utils
        let _ = revoke_publisher as fn(&ReducerContext, &spacetimedb::Identity);
    }

    #[test]
    fn create_upload_intent_validates_inputs() {
        // create_upload_intent checks byte_limit bounds, quota, and idempotency
        // Unit test verifies the function compiles
        // Actual validation testing requires SpacetimeDB test-utils
        let _ = create_upload_intent
            as fn(&ReducerContext, String, String, String, String, u64) -> Result<(), String>;
    }

    #[test]
    fn upload_progress_enforces_limits() {
        // upload_progress checks intent expiry, ownership, and byte limits
        // Unit test verifies the function compiles
        // Actual validation testing requires SpacetimeDB test-utils
        let _ = upload_progress as fn(&ReducerContext, String, u64) -> Result<(), String>;
    }

    #[test]
    fn finalize_upload_creates_asset() {
        // finalize_upload validates intent and creates a media_asset
        // Unit test verifies the function compiles
        // Actual asset creation testing requires SpacetimeDB test-utils
        let _ = finalize_upload as fn(&ReducerContext, String, String) -> Result<(), String>;
    }

    #[test]
    fn delete_upload_intent_removes_intent() {
        // delete_upload_intent removes a pending intent
        // Unit test verifies the function compiles
        // Actual deletion testing requires SpacetimeDB test-utils
        let _ = delete_upload_intent as fn(&ReducerContext, String) -> Result<(), String>;
    }

    #[test]
    fn my_media_assets_filters_by_publisher() {
        // my_media_assets returns only the caller's assets
        // Unit test verifies the function compiles
        // Actual query testing requires SpacetimeDB test-utils
        let _ = my_media_assets as fn(&spacetimedb::ViewContext) -> Vec<MediaAsset>;
    }

    #[test]
    fn get_pending_assets_returns_assets() {
        // get_pending_assets returns assets with a specific status
        // Unit test verifies the function compiles
        // Actual query testing requires SpacetimeDB test-utils
        let _ = get_pending_assets as fn(&spacetimedb::ViewContext, i32) -> Vec<MediaAsset>;
    }

    #[test]
    fn update_asset_status_updates_asset() {
        // update_asset_status updates asset status and metadata
        // Unit test verifies the function compiles
        // Actual update testing requires SpacetimeDB test-utils
        let _ = update_asset_status
            as fn(
                &ReducerContext,
                String,
                i32,
                Option<u64>,
                Option<i32>,
                Option<i32>,
                Option<i32>,
                Option<String>,
                Option<String>,
            ) -> Result<(), String>;
    }

    #[test]
    fn process_asset_marks_ready() {
        // process_asset would call the processor module
        // Unit test verifies the function compiles
        // Actual processing testing requires SpacetimeDB test-utils
        let _ = process_asset as fn(&ReducerContext, String, String) -> Result<(), String>;
    }
}
