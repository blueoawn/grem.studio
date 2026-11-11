-- Validation script for migration 0000000000000000000000000000000000000002
-- This validates the draft_revisions and draft_revision_revocations tables

-- Verify draft_revisions table exists and has correct columns
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'draft_revisions' 
ORDER BY ordinal_position;

-- Verify draft_revision_revocations table exists and has correct columns
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'draft_revision_revocations' 
ORDER BY ordinal_position;

-- Verify indexes exist
SELECT 
    indexname, 
    tablename 
FROM pg_indexes 
WHERE tablename IN ('draft_revisions', 'draft_revision_revocations');

-- Test that tables are empty (fresh migration)
SELECT COUNT(*) as draft_revisions_count FROM draft_revisions;
SELECT COUNT(*) as draft_revocation_count FROM draft_revision_revocations;
