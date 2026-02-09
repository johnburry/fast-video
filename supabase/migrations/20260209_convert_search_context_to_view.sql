-- Migration: Convert transcript_search_context from static table back to dynamic view
-- This ensures new videos and updated videos automatically appear in search results

-- Step 1: Drop the static table and its indexes
DROP TABLE IF EXISTS transcript_search_context CASCADE;

-- Step 2: Recreate as a VIEW (not a table) so it stays up-to-date automatically
CREATE VIEW transcript_search_context AS
SELECT
  t.id as transcript_id,
  t.video_id,
  t.text as original_text,
  t.start_time,
  t.duration,
  -- Combine current segment with 1 before and 1 after for search context
  (
    SELECT string_agg(t2.text, ' ' ORDER BY t2.start_time)
    FROM transcripts t2
    WHERE t2.video_id = t.video_id
      AND t2.start_time BETWEEN
        COALESCE(
          (SELECT start_time FROM transcripts
           WHERE video_id = t.video_id AND start_time < t.start_time
           ORDER BY start_time DESC LIMIT 1),
          t.start_time
        )
        AND
        COALESCE(
          (SELECT start_time FROM transcripts
           WHERE video_id = t.video_id AND start_time > t.start_time
           ORDER BY start_time ASC LIMIT 1),
          t.start_time
        )
  ) as search_text,
  v.youtube_video_id,
  v.title as video_title,
  v.thumbnail_url as video_thumbnail,
  v.published_at,
  v.duration_seconds as video_duration,
  c.id as channel_id,
  c.channel_handle,
  c.channel_name,
  c.thumbnail_url as channel_thumbnail,
  c.tenant_id
FROM public.transcripts t
JOIN public.videos v ON t.video_id = v.id
JOIN public.channels c ON v.channel_id = c.id
WHERE c.is_active = true
  AND v.has_quality_transcript = true;  -- ONLY include quality transcripts

COMMENT ON VIEW transcript_search_context IS
  'Dynamic view that includes all videos with quality transcripts. Automatically updates when new videos are added or has_quality_transcript is changed.';

-- Step 3: Grant permissions
GRANT SELECT ON transcript_search_context TO anon, authenticated;

-- Step 4: Clean up temp table if it still exists
DROP TABLE IF EXISTS transcript_search_context_temp;
