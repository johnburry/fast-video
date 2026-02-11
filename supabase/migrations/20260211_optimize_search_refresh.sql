-- Migration: Optimize transcript_search_context view to use window functions
-- The previous version used nested subqueries which caused severe performance issues at scale (2M+ rows)
-- This version uses window functions (LAG/LEAD) which are much more efficient

-- Drop and recreate the view with optimized query
CREATE OR REPLACE VIEW transcript_search_context AS
WITH transcript_with_context AS (
  SELECT
    t.id as transcript_id,
    t.video_id,
    t.text as original_text,
    t.start_time,
    t.duration,
    -- Use window functions to get previous and next segment text (much faster than subqueries)
    LAG(t.text) OVER (PARTITION BY t.video_id ORDER BY t.start_time) as prev_text,
    LEAD(t.text) OVER (PARTITION BY t.video_id ORDER BY t.start_time) as next_text,
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
    AND v.has_quality_transcript = true
)
SELECT
  transcript_id,
  video_id,
  original_text,
  start_time,
  duration,
  -- Combine prev + current + next for search context
  TRIM(CONCAT(
    COALESCE(prev_text, ''),
    ' ',
    original_text,
    ' ',
    COALESCE(next_text, '')
  )) as search_text,
  youtube_video_id,
  video_title,
  video_thumbnail,
  published_at,
  video_duration,
  channel_id,
  channel_handle,
  channel_name,
  channel_thumbnail,
  tenant_id
FROM transcript_with_context;

COMMENT ON VIEW transcript_search_context IS
  'Optimized dynamic view using window functions for context. Includes all videos with quality transcripts. Automatically updates when new videos are added.';

-- Grant permissions
GRANT SELECT ON transcript_search_context TO anon, authenticated;

-- Make refresh_transcript_search_for_videos a no-op since we're using a view now
-- Keeping it for backward compatibility but it doesn't need to do anything
CREATE OR REPLACE FUNCTION refresh_transcript_search_for_videos(p_video_ids UUID[])
RETURNS TABLE(success BOOLEAN, videos_processed INTEGER, message TEXT) AS $$
BEGIN
  -- This is now a no-op since transcript_search_context is a view that auto-updates
  -- We just return success
  RETURN QUERY SELECT TRUE, array_length(p_video_ids, 1),
    format('View auto-refreshes - processed %s videos', array_length(p_video_ids, 1))::TEXT;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION refresh_transcript_search_for_videos(UUID[]) TO service_role;

COMMENT ON FUNCTION refresh_transcript_search_for_videos(UUID[]) IS
  'No-op function for backward compatibility. The view auto-updates so no refresh is needed.';
