-- Check if the perform_transcript_search_refresh function exists
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'perform_transcript_search_refresh';

-- If it doesn't exist, check what refresh-related functions DO exist
SELECT proname
FROM pg_proc
WHERE proname LIKE '%refresh%' OR proname LIKE '%search%';
