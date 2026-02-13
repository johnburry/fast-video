-- Migration: Fix transcript_search_context conversion from materialized view to view
--
-- Previous migrations (20260209, 20260211) attempted to convert transcript_search_context
-- from a materialized view to a regular view, but used DROP TABLE IF EXISTS which does NOT
-- drop materialized views. This left the materialized view in place while the refresh
-- function was changed to a no-op, meaning new videos were never added to the search index.
--
-- This migration properly handles ALL cases: table, materialized view, or view.

-- Step 1: Drop whatever transcript_search_context currently is
DROP MATERIALIZED VIEW IF EXISTS transcript_search_context CASCADE;
DROP VIEW IF EXISTS transcript_search_context CASCADE;
DROP TABLE IF EXISTS transcript_search_context CASCADE;

-- Step 2: Recreate as a regular VIEW (auto-updates, no refresh needed)
CREATE VIEW transcript_search_context AS
WITH transcript_with_context AS (
  SELECT
    t.id as transcript_id,
    t.video_id,
    t.text as original_text,
    t.start_time,
    t.duration,
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
  'Dynamic view using window functions for cross-segment search context. Auto-updates when data changes.';

-- Step 3: Grant permissions
GRANT SELECT ON transcript_search_context TO anon, authenticated;

-- Step 4: Ensure refresh functions are no-ops (view auto-updates)
CREATE OR REPLACE FUNCTION refresh_transcript_search_for_videos(p_video_ids UUID[])
RETURNS TABLE(success BOOLEAN, videos_processed INTEGER, message TEXT) AS $$
BEGIN
  RETURN QUERY SELECT TRUE, array_length(p_video_ids, 1),
    format('View auto-refreshes - processed %s videos', array_length(p_video_ids, 1))::TEXT;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION perform_transcript_search_refresh()
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
BEGIN
  RETURN QUERY SELECT TRUE, 'transcript_search_context is a view and auto-refreshes. No manual refresh needed.'::TEXT;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION refresh_transcript_search_for_videos(UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION perform_transcript_search_refresh() TO service_role, anon, authenticated;
