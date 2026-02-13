-- Migration: Fix transcript_search_context search index
--
-- The search index must be a MATERIALIZED VIEW (not a regular view) because:
--   1. Full-text search requires a GIN index on to_tsvector('english', search_text)
--   2. Regular views cannot have indexes
--   3. Supabase .textSearch() relies on this GIN index
--
-- The original bug: migration 20260211_optimize_search_refresh.sql made the
-- refresh_transcript_search_for_videos function a no-op (assuming it was converted
-- to a regular view). But the object was still a materialized view, so new videos
-- imported after that point were never added to the search index.
--
-- This migration:
--   1. Drops whatever transcript_search_context currently is (view, matview, or table)
--   2. Recreates it as a MATERIALIZED VIEW with proper GIN indexes
--   3. Fixes the refresh functions to actually perform a refresh

-- Step 1: Drop whatever exists
DROP VIEW IF EXISTS transcript_search_context CASCADE;
DROP MATERIALIZED VIEW IF EXISTS transcript_search_context CASCADE;
DROP TABLE IF EXISTS transcript_search_context CASCADE;

-- Step 2: Recreate as MATERIALIZED VIEW with optimized window functions
CREATE MATERIALIZED VIEW transcript_search_context AS
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

-- Step 3: Create indexes for full-text search and filtering
-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX idx_tsc_transcript_id
  ON transcript_search_context(transcript_id);

-- GIN index for full-text search (this is what makes .textSearch() work)
CREATE INDEX idx_tsc_fts
  ON transcript_search_context
  USING gin(to_tsvector('english', search_text));

-- Filtering indexes
CREATE INDEX idx_tsc_video_id ON transcript_search_context(video_id);
CREATE INDEX idx_tsc_channel_handle ON transcript_search_context(channel_handle);
CREATE INDEX idx_tsc_tenant_id ON transcript_search_context(tenant_id);

-- Step 4: Grant permissions
GRANT SELECT ON transcript_search_context TO anon, authenticated;

-- Step 5: Fix refresh functions to ACTUALLY refresh (not no-op)
CREATE OR REPLACE FUNCTION refresh_transcript_search_for_videos(p_video_ids UUID[])
RETURNS TABLE(success BOOLEAN, videos_processed INTEGER, message TEXT) AS $$
BEGIN
  -- Refresh the entire materialized view concurrently (non-blocking)
  -- CONCURRENTLY requires the unique index on transcript_id
  REFRESH MATERIALIZED VIEW CONCURRENTLY transcript_search_context;

  RETURN QUERY SELECT TRUE, array_length(p_video_ids, 1),
    format('Materialized view refreshed for %s videos', array_length(p_video_ids, 1))::TEXT;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, 0, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION perform_transcript_search_refresh()
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
BEGIN
  -- Update status tracking
  UPDATE public.transcript_search_refresh_status
  SET refresh_in_progress = TRUE
  WHERE id = 1;

  -- Refresh the materialized view
  REFRESH MATERIALIZED VIEW CONCURRENTLY transcript_search_context;

  -- Mark as complete
  UPDATE public.transcript_search_refresh_status
  SET
    needs_refresh = FALSE,
    last_refreshed_at = NOW(),
    refresh_in_progress = FALSE
  WHERE id = 1;

  RETURN QUERY SELECT TRUE, 'Materialized view refreshed successfully'::TEXT;
EXCEPTION WHEN OTHERS THEN
  UPDATE public.transcript_search_refresh_status
  SET refresh_in_progress = FALSE
  WHERE id = 1;

  RETURN QUERY SELECT FALSE, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Grant execute permissions on refresh functions
GRANT EXECUTE ON FUNCTION refresh_transcript_search_for_videos(UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION perform_transcript_search_refresh() TO service_role, anon, authenticated;

COMMENT ON MATERIALIZED VIEW transcript_search_context IS
  'Materialized view with GIN index for full-text search across transcript segments. Must be refreshed after video imports using refresh_transcript_search_for_videos() or perform_transcript_search_refresh().';
