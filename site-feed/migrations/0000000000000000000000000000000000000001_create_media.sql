-- This migration creates the tables used by the media gateway feature.
--
-- After publishing the database, add the media.rs module and recompile the
-- module. For SpacetimeDB 1.12, this ordering is also the workaround for the
-- linking issue: add media.rs AFTER the database has been published.

CREATE TABLE upload_intents (
    intent_key TEXT PRIMARY KEY,
    publisher TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    byte_limit BIGINT NOT NULL,
    bytes_received BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE INDEX upload_intents_publisher_idx
    ON upload_intents (publisher);

-- media_assets is private; access it through the my_media_assets view.
CREATE TABLE media_assets (
    asset_id TEXT PRIMARY KEY,
    publisher TEXT NOT NULL,
    content_type TEXT NOT NULL,
    byte_size BIGINT NOT NULL,
    storage_key TEXT NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE INDEX media_assets_publisher_idx
    ON media_assets (publisher);
