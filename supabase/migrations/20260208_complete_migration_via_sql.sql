-- Complete the migration using SQL INSERT SELECT for remaining rows
-- This is much faster than batching through the API

-- Insert all rows from source that don't exist in destination
INSERT INTO transcript_search_context_temp
SELECT src.*
FROM transcript_search_context_new src
WHERE NOT EXISTS (
  SELECT 1
  FROM transcript_search_context_temp dest
  WHERE dest.transcript_id = src.transcript_id
)
ON CONFLICT (transcript_id) DO NOTHING;

-- Check results
SELECT
  (SELECT COUNT(*) FROM transcript_search_context_new) as source_count,
  (SELECT COUNT(*) FROM transcript_search_context_temp) as dest_count,
  (SELECT COUNT(*) FROM transcript_search_context_new) -
  (SELECT COUNT(*) FROM transcript_search_context_temp) as remaining;
