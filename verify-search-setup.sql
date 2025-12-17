-- Verify that the search_results view exists and has data
SELECT COUNT(*) as total_transcript_segments
FROM public.search_results;

-- Show sample search results
SELECT
  channel_handle,
  video_title,
  text as transcript_text,
  start_time
FROM public.search_results
LIMIT 10;

-- Check if videos have has_transcript marked correctly
SELECT
  v.youtube_video_id,
  v.title,
  v.has_transcript,
  COUNT(t.id) as transcript_count
FROM videos v
LEFT JOIN transcripts t ON v.id = t.video_id
GROUP BY v.id, v.youtube_video_id, v.title, v.has_transcript
ORDER BY v.created_at DESC
LIMIT 10;

-- Verify full-text search index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'transcripts' AND indexname = 'idx_transcripts_text_search';
