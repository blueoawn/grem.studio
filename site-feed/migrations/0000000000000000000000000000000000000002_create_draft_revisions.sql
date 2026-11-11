-- This migration creates the tables used by the draft revision preview feature.
--
-- Draft revisions are private and accessed only through authorized reducers.

-- Draft revision snapshots for preview access.
-- Each row represents a specific revision of a draft document.
CREATE TABLE draft_revisions (
    id BIGINT PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    revision_id BIGINT NOT NULL,
    document TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    author TEXT NOT NULL
);

-- Index for efficient lookups by slug
CREATE INDEX draft_revisions_slug_idx ON draft_revisions (slug);

-- Index for efficient lookups by author
CREATE INDEX draft_revisions_author_idx ON draft_revisions (author);

-- Tracks which draft revisions have been revoked/expired.
CREATE TABLE draft_revision_revocations (
    revision_id BIGINT PRIMARY KEY,
    revoked_at BIGINT NOT NULL
);
