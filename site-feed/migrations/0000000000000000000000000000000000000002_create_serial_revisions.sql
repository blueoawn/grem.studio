-- This migration creates the serial_revisions table for storing revision snapshots.
--
-- After publishing the database, add the serial.rs module and recompile the
-- module. For SpacetimeDB 1.12, this ordering is also the workaround for the
-- linking issue: add serial.rs AFTER the database has been published.

CREATE TABLE serial_revisions (
    id BIGINT PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    author TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    revision BIGINT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    is_published BOOLEAN NOT NULL,
    parent_revision_id BIGINT
);

-- Index for efficient lookups by slug
CREATE INDEX serial_revisions_slug_idx
    ON serial_revisions (slug);

-- Index for efficient lookups by author
CREATE INDEX serial_revisions_author_idx
    ON serial_revisions (author);

-- Index for efficient lookups by timestamp (for retention policy)
CREATE INDEX serial_revisions_timestamp_idx
    ON serial_revisions (timestamp);
