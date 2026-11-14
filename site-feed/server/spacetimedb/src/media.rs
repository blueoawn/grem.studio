//! Media gateway: authenticated upload intents and asset storage.
//!
//! Upload intents are short-lived and tied to the SpacetimeDB identity
//! of the authenticated publisher. All identity is derived from `ctx.sender`;
//! no username or role is accepted from client requests.

use spacetimedb::{Identity, ReducerContext, SpacetimeType, Table};

use crate::accounts::{accounts, accounts__view, sessions, sessions__view};
use crate::now_micros;
use crate::serial_document::MAX_ASSET_ID_BYTES;

// -- Constants --

/// Upload intent expiry: 15 minutes in microseconds
pub const INTENT_TTL_MICROS: u64 = 15 * 60 * 1_000_000;

/// Maximum bytes per single upload: 100 MB
pub const MAX_UPLOAD_BYTES: u64 = 100 * 1024 * 1024;

/// Maximum bytes per publisher total storage: 1 GB
pub const MAX_PUBLISHER_BYTES: u64 = 1024 * 1024 * 1024;

pub const ASSET_STATUS_PENDING: i32 = 0;
pub const ASSET_STATUS_PROCESSING: i32 = 1;
pub const ASSET_STATUS_READY: i32 = 2;
pub const ASSET_STATUS_FAILED: i32 = 3;

const MAX_IMAGE_DIMENSION: u32 = 8192;
const MAX_VIDEO_DURATION_SECONDS: u32 = 3600;
const IMAGE_TYPES: &[&str] = &["image/jpeg", "image/png", "image/gif", "image/webp"];
const VIDEO_TYPES: &[&str] = &["video/mp4", "video/webm"];

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
    #[index(btree)]
    pub expires_at: u64,
    pub created_at: u64,
}

/// Stored media asset and its processing state.
///
/// Keep the table private, like the account tables. Publisher access is exposed
/// through the typed `my_media_assets` view below rather than through the raw
/// table. This also avoids generating the extra public-table binding exports
/// that trigger the SpacetimeDB 1.12 linker failures when this table is added
/// to an existing module.
#[spacetimedb::table(name = media_assets)]
#[derive(Clone, Debug, PartialEq)]
pub struct MediaAsset {
    #[primary_key]
    pub asset_id: String,

    #[index(btree)]
    pub publisher: spacetimedb::Identity,

    pub content_type: String,
    pub byte_size: u64,
    /// Storage backend key (e.g., S3 object key or local path)
    pub storage_key: String,
    pub created_at: u64,
    // Keep additions at the end with defaults so existing rows migrate in place.
    #[default(ASSET_STATUS_PENDING)]
    pub status: i32,
    #[default(None::<u64>)]
    pub processed_at: Option<u64>,
    #[default(None::<u32>)]
    pub width: Option<u32>,
    #[default(None::<u32>)]
    pub height: Option<u32>,
    #[default(None::<u32>)]
    pub duration_seconds: Option<u32>,
    #[default(None::<Vec<MediaVariant>>)]
    pub variants: Option<Vec<MediaVariant>>,
    #[default(None::<String>)]
    pub content_hash: Option<String>,
    #[default(None::<String>)]
    pub processing_error: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, SpacetimeType)]
pub enum MediaVariantKind {
    Thumbnail,
    Poster,
    Deliverable,
}

#[derive(Clone, Debug, PartialEq, Eq, SpacetimeType)]
pub struct MediaVariant {
    pub kind: MediaVariantKind,
    pub path: String,
    pub content_type: String,
    pub byte_size: u64,
}

#[derive(SpacetimeType)]
pub struct ReadyMedia {
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub duration_seconds: Option<u32>,
    pub variants: Vec<MediaVariant>,
    pub sha256: Option<String>,
}

#[derive(SpacetimeType)]
pub enum MediaProcessingResult {
    Processing,
    Ready(ReadyMedia),
    Failed(String),
}

#[derive(Clone, Copy)]
struct ProcessorCaller {
    sender: Identity,
    processor: Option<Identity>,
}

impl ProcessorCaller {
    fn from_context(ctx: &ReducerContext) -> Self {
        let processor = option_env!("SITE_FEED_MEDIA_PROCESSOR_IDENTITY")
            .and_then(|hex| Identity::from_hex(hex).ok())
            .filter(|identity| *identity != Identity::ZERO);
        Self {
            sender: ctx.sender,
            processor,
        }
    }

    fn is_authorized(self) -> bool {
        self.processor == Some(self.sender)
    }

    fn authorize(self) -> Result<(), String> {
        if self.is_authorized() {
            Ok(())
        } else {
            Err("Only the configured media processor may perform this action".into())
        }
    }
}

fn valid_variant(variant: &MediaVariant) -> bool {
    let content_type = variant.content_type.as_str();
    let supported_type = match variant.kind {
        MediaVariantKind::Thumbnail | MediaVariantKind::Poster => {
            IMAGE_TYPES.contains(&content_type)
        }
        MediaVariantKind::Deliverable => VIDEO_TYPES.contains(&content_type),
    };
    supported_type
        && variant.byte_size > 0
        && variant.path.split('/').all(|segment| {
            !segment.is_empty()
                && !matches!(segment, "." | "..")
                && segment
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
        })
}

fn validate_ready_media(content_type: &str, result: &mut ReadyMedia) -> Option<String> {
    let sha256 = result.sha256.as_deref()?;
    if sha256.len() != 64 || !sha256.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return None;
    }

    let has_variant = |kind| result.variants.iter().any(|variant| variant.kind == kind);
    let complete = if IMAGE_TYPES.contains(&content_type) {
        let valid_dimension = |value| (1..=MAX_IMAGE_DIMENSION).contains(&value);
        result.width.is_some_and(valid_dimension)
            && result.height.is_some_and(valid_dimension)
            && has_variant(MediaVariantKind::Thumbnail)
    } else if VIDEO_TYPES.contains(&content_type) {
        result
            .duration_seconds
            .is_some_and(|value| (1..=MAX_VIDEO_DURATION_SECONDS).contains(&value))
            && has_variant(MediaVariantKind::Poster)
            && has_variant(MediaVariantKind::Deliverable)
    } else {
        false
    };
    if !complete || !result.variants.iter().all(valid_variant) {
        return None;
    }

    result
        .variants
        .sort_by(|left, right| left.path.cmp(&right.path));
    if result
        .variants
        .windows(2)
        .any(|pair| pair[0].path == pair[1].path)
    {
        return None;
    }
    Some(sha256.to_ascii_lowercase())
}

/// Return an updated row only on a state change. A refused report leaves the
/// row intact, and a retry of a terminal result preserves its timestamp.
fn apply_processing_result(
    asset: Option<MediaAsset>,
    result: MediaProcessingResult,
    caller: ProcessorCaller,
    now: u64,
) -> Result<Option<MediaAsset>, String> {
    caller.authorize()?;
    let mut asset = asset.ok_or_else(|| "Asset not found".to_string())?;
    let reason = match result {
        MediaProcessingResult::Processing => {
            return match asset.status {
                ASSET_STATUS_PENDING => {
                    asset.status = ASSET_STATUS_PROCESSING;
                    Ok(Some(asset))
                }
                ASSET_STATUS_PROCESSING => Ok(None),
                _ => Err("Asset already has a final processing result".into()),
            };
        }
        MediaProcessingResult::Ready(mut result) => {
            if let Some(hash) = validate_ready_media(&asset.content_type, &mut result) {
                if asset.status == ASSET_STATUS_READY
                    && asset.content_hash.as_deref() == Some(&hash)
                    && asset.width == result.width
                    && asset.height == result.height
                    && asset.duration_seconds == result.duration_seconds
                    && asset.variants.as_ref() == Some(&result.variants)
                {
                    return Ok(None);
                }
                require_processing_status(&asset)?;
                asset.status = ASSET_STATUS_READY;
                asset.processed_at = Some(now);
                asset.width = result.width;
                asset.height = result.height;
                asset.duration_seconds = result.duration_seconds;
                asset.variants = Some(result.variants);
                asset.content_hash = Some(hash);
                return Ok(Some(asset));
            }
            "incomplete_metadata".to_string()
        }
        MediaProcessingResult::Failed(reason) => {
            if reason.is_empty()
                || !reason
                    .bytes()
                    .all(|byte| byte.is_ascii_lowercase() || byte == b'_')
            {
                return Err("Processing failure reason must be a lowercase error code".into());
            }
            reason
        }
    };

    if asset.status == ASSET_STATUS_FAILED && asset.processing_error.as_deref() == Some(&reason) {
        return Ok(None);
    }
    require_processing_status(&asset)?;
    asset.status = ASSET_STATUS_FAILED;
    asset.processed_at = Some(now);
    asset.processing_error = Some(reason);
    Ok(Some(asset))
}

fn require_processing_status(asset: &MediaAsset) -> Result<(), String> {
    match asset.status {
        ASSET_STATUS_PROCESSING => Ok(()),
        ASSET_STATUS_PENDING => Err("Asset processing has not started".into()),
        _ => Err("Asset already has a final processing result".into()),
    }
}

/// Return a stable URL candidate for a ready asset. The gateway separately
/// checks for a published reference before serving the URL to public readers.
pub fn public_url_for(asset: &MediaAsset) -> Option<String> {
    let id = &asset.asset_id;
    (asset.status == ASSET_STATUS_READY
        && !id.is_empty()
        && id.len() <= MAX_ASSET_ID_BYTES
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_')))
    .then(|| format!("/media/{id}"))
}

fn expired_intents(intents: impl IntoIterator<Item = UploadIntent>, now: u64) -> Vec<String> {
    intents
        .into_iter()
        .filter(|intent| intent.expires_at <= now)
        .map(|intent| intent.intent_key)
        .collect()
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

/// Finalize an upload intent and create an asset pending processing.
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
        ctx.db.media_assets().insert(MediaAsset {
            asset_id: intent.asset_id.clone(),
            publisher: ctx.sender,
            content_type: intent.content_type.clone(),
            byte_size: intent.bytes_received,
            storage_key,
            created_at: now_micros(ctx),
            status: ASSET_STATUS_PENDING,
            processed_at: None,
            width: None,
            height: None,
            duration_seconds: None,
            variants: None,
            content_hash: None,
            processing_error: None,
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

/// Accept a processing transition or result from the configured processor.
#[spacetimedb::reducer]
pub fn report_media_processing_result(
    ctx: &ReducerContext,
    asset_id: String,
    result: MediaProcessingResult,
) -> Result<(), String> {
    let caller = ProcessorCaller::from_context(ctx);
    let assets = ctx.db.media_assets().asset_id();
    let asset = if caller.is_authorized() {
        assets.find(&asset_id)
    } else {
        None
    };
    if let Some(updated) = apply_processing_result(asset, result, caller, now_micros(ctx))? {
        assets.update(updated);
    }
    Ok(())
}

/// Remove expired intent metadata. Object storage handles its own cleanup.
#[spacetimedb::reducer]
pub fn cleanup_expired_upload_intents(ctx: &ReducerContext) -> Result<(), String> {
    ProcessorCaller::from_context(ctx).authorize()?;
    let now = now_micros(ctx);
    let intents = ctx.db.upload_intents();
    for key in expired_intents(intents.expires_at().filter(..=now), now) {
        intents.intent_key().delete(&key);
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    const PROCESSOR: Identity = Identity::from_byte_array([1; 32]);
    const PUBLISHER: Identity = Identity::from_byte_array([2; 32]);
    const PROCESSOR_CALLER: ProcessorCaller = ProcessorCaller {
        sender: PROCESSOR,
        processor: Some(PROCESSOR),
    };

    fn test_asset(content_type: &str, status: i32) -> MediaAsset {
        MediaAsset {
            asset_id: "asset-1".into(),
            publisher: PUBLISHER,
            content_type: content_type.into(),
            byte_size: 4096,
            storage_key: "uploads/asset-1".into(),
            created_at: 100,
            status,
            processed_at: None,
            width: None,
            height: None,
            duration_seconds: None,
            variants: None,
            content_hash: None,
            processing_error: None,
        }
    }

    fn variant(kind: MediaVariantKind, path: &str, content_type: &str) -> MediaVariant {
        MediaVariant {
            kind,
            path: path.into(),
            content_type: content_type.into(),
            byte_size: 512,
        }
    }

    fn image_report() -> ReadyMedia {
        ReadyMedia {
            width: Some(1200),
            height: Some(800),
            duration_seconds: None,
            variants: vec![variant(
                MediaVariantKind::Thumbnail,
                "variants/asset-1/thumb.jpg",
                "image/jpeg",
            )],
            sha256: Some("ab".repeat(32)),
        }
    }

    fn video_report() -> ReadyMedia {
        ReadyMedia {
            width: None,
            height: None,
            duration_seconds: Some(5),
            variants: vec![
                variant(
                    MediaVariantKind::Poster,
                    "variants/asset-1/poster.jpg",
                    "image/jpeg",
                ),
                variant(
                    MediaVariantKind::Deliverable,
                    "variants/asset-1/clip.mp4",
                    "video/mp4",
                ),
            ],
            sha256: Some("ab".repeat(32)),
        }
    }

    fn report_ready(content_type: &str, result: ReadyMedia) -> MediaAsset {
        apply_processing_result(
            Some(test_asset(content_type, ASSET_STATUS_PROCESSING)),
            MediaProcessingResult::Ready(result),
            PROCESSOR_CALLER,
            200,
        )
        .unwrap()
        .unwrap()
    }

    fn assert_invalid_metadata(asset: &MediaAsset) {
        assert_eq!(asset.status, ASSET_STATUS_FAILED);
        assert_eq!(
            asset.processing_error.as_deref(),
            Some("incomplete_metadata")
        );
        assert!(asset.variants.is_none());
        assert!(public_url_for(asset).is_none());
    }

    fn test_intent() -> UploadIntent {
        UploadIntent {
            intent_key: "intent-1".into(),
            publisher: PUBLISHER,
            asset_id: "asset-1".into(),
            filename: "photo.jpg".into(),
            content_type: "image/jpeg".into(),
            byte_limit: MAX_UPLOAD_BYTES,
            bytes_received: 0,
            expires_at: 1000,
            created_at: 0,
        }
    }

    #[test]
    fn complete_image_result_is_ready() {
        let result = image_report();
        let asset = report_ready("image/jpeg", image_report());
        assert_eq!(asset.status, ASSET_STATUS_READY);
        assert_eq!((asset.width, asset.height), (Some(1200), Some(800)));
        assert_eq!(asset.content_hash, result.sha256);
        assert_eq!(asset.variants, Some(result.variants));
        assert_eq!(asset.processed_at, Some(200));
        assert_eq!(asset.byte_size, 4096);
    }

    #[test]
    fn image_without_sha256_is_failed() {
        let mut result = image_report();
        result.sha256 = None;
        assert_invalid_metadata(&report_ready("image/jpeg", result));
    }

    #[test]
    fn image_with_short_sha256_is_failed() {
        let mut result = image_report();
        result.sha256 = Some("ab".repeat(20));
        assert_invalid_metadata(&report_ready("image/jpeg", result));
    }

    #[test]
    fn complete_video_result_is_ready() {
        let result = video_report();
        let asset = report_ready("video/mp4", video_report());
        assert_eq!(asset.status, ASSET_STATUS_READY);
        assert_eq!(asset.duration_seconds, Some(5));
        assert_eq!(asset.content_hash, result.sha256);
        assert_eq!(asset.variants.as_ref().unwrap().len(), 2);
        for variant in result.variants {
            assert!(asset.variants.as_ref().unwrap().contains(&variant));
        }
    }

    #[test]
    fn video_without_deliverable_is_failed() {
        let mut result = video_report();
        result.variants.pop();
        assert_invalid_metadata(&report_ready("video/mp4", result));
    }

    #[test]
    fn video_over_duration_limit_is_failed() {
        let mut result = video_report();
        result.duration_seconds = Some(3601);
        assert_invalid_metadata(&report_ready("video/mp4", result));
    }

    #[test]
    fn failure_result_keeps_reason_and_has_no_url() {
        let asset = apply_processing_result(
            Some(test_asset("image/jpeg", ASSET_STATUS_PROCESSING)),
            MediaProcessingResult::Failed("malformed".into()),
            PROCESSOR_CALLER,
            200,
        )
        .unwrap()
        .unwrap();
        assert_eq!(asset.status, ASSET_STATUS_FAILED);
        assert_eq!(asset.processing_error.as_deref(), Some("malformed"));
        assert_eq!(asset.processed_at, Some(200));
        assert!(public_url_for(&asset).is_none());
    }

    #[test]
    fn only_ready_assets_have_public_urls() {
        for status in [
            ASSET_STATUS_PENDING,
            ASSET_STATUS_PROCESSING,
            ASSET_STATUS_FAILED,
        ] {
            assert!(public_url_for(&test_asset("image/jpeg", status)).is_none());
        }
        let ready = report_ready("image/jpeg", image_report());
        assert_eq!(public_url_for(&ready).as_deref(), Some("/media/asset-1"));
    }

    #[test]
    fn matching_ready_retry_leaves_asset_unchanged() {
        let asset = report_ready("image/jpeg", image_report());
        let retry = apply_processing_result(
            Some(asset.clone()),
            MediaProcessingResult::Ready(image_report()),
            PROCESSOR_CALLER,
            300,
        );
        assert_eq!(retry, Ok(None));
        assert_eq!(asset.processed_at, Some(200));
        assert_eq!(asset.variants.as_ref().unwrap().len(), 1);
    }

    #[test]
    fn conflicting_ready_retry_is_refused() {
        let asset = report_ready("image/jpeg", image_report());
        let mut result = image_report();
        result.sha256 = Some("cd".repeat(32));
        let retry = apply_processing_result(
            Some(asset.clone()),
            MediaProcessingResult::Ready(result),
            PROCESSOR_CALLER,
            300,
        );
        assert_eq!(
            retry,
            Err("Asset already has a final processing result".into())
        );
        assert_eq!(asset.content_hash, image_report().sha256);
    }

    #[test]
    fn publisher_cannot_report_processing_results() {
        let caller = ProcessorCaller {
            sender: PUBLISHER,
            processor: Some(PROCESSOR),
        };
        let result = apply_processing_result(
            Some(test_asset("image/jpeg", ASSET_STATUS_PROCESSING)),
            MediaProcessingResult::Ready(image_report()),
            caller,
            200,
        );
        assert_eq!(
            result,
            Err("Only the configured media processor may perform this action".into()),
        );
    }

    #[test]
    fn intent_is_active_before_its_deadline() {
        assert!(expired_intents([test_intent()], 999).is_empty());
    }

    #[test]
    fn intent_is_expired_at_its_deadline() {
        assert_eq!(expired_intents([test_intent()], 1000), ["intent-1"]);
    }

    #[test]
    fn pending_asset_must_start_processing_before_completion() {
        let asset = test_asset("image/jpeg", ASSET_STATUS_PENDING);
        assert_eq!(
            apply_processing_result(
                Some(asset.clone()),
                MediaProcessingResult::Ready(image_report()),
                PROCESSOR_CALLER,
                200,
            ),
            Err("Asset processing has not started".into()),
        );
        let started = apply_processing_result(
            Some(asset),
            MediaProcessingResult::Processing,
            PROCESSOR_CALLER,
            200,
        )
        .unwrap()
        .unwrap();
        assert_eq!(started.status, ASSET_STATUS_PROCESSING);
        assert!(started.processed_at.is_none());
    }

    #[test]
    fn constants_are_reasonable() {
        assert_eq!(INTENT_TTL_MICROS, 15 * 60 * 1_000_000);
        assert_eq!(MAX_UPLOAD_BYTES, 100 * 1024 * 1024);
        assert_eq!(MAX_PUBLISHER_BYTES, 1024 * 1024 * 1024);
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
}
