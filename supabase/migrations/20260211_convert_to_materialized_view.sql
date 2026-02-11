-- Convert transcript_search_context back to MATERIALIZED VIEW
-- Regular views can't have indexes, which breaks full-text search
-- This version uses optimized window functions for performance

DROP VIEW IF EXISTS transcript_search_context;

CREATE MATERIALIZED VIEW transcript_search_context AS
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

-- Create unique index on transcript_id to enable CONCURRENT refresh
CREATE UNIQUE INDEX idx_transcript_search_context_transcript_id
  ON transcript_search_context(transcript_id);

-- Create full-text search index
CREATE INDEX idx_transcript_search_context_fts
  ON transcript_search_context
  USING gin(to_tsvector('english', search_text));

-- Create index on video_id for faster filtering
CREATE INDEX idx_transcript_search_context_video_id
  ON transcript_search_context(video_id);

-- Create index on channel_handle for faster filtering
CREATE INDEX idx_transcript_search_context_channel_handle
  ON transcript_search_context(channel_handle);

-- Create index on tenant_id for multi-tenant filtering
CREATE INDEX idx_transcript_search_context_tenant_id
  ON transcript_search_context(tenant_id);

-- Grant permissions
GRANT SELECT ON transcript_search_context TO anon, authenticated;

-- Update the refresh function to actually refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_transcript_search_for_videos(p_video_ids UUID[])
RETURNS TABLE(success BOOLEAN, videos_processed INTEGER, message TEXT) AS $$
BEGIN
  -- Since it's a materialized view again, we refresh it concurrently
  -- This updates the entire view but does it without blocking queries
  REFRESH MATERIALIZED VIEW CONCURRENTLY transcript_search_context;

  RETURN QUERY SELECT TRUE, array_length(p_video_ids, 1),
    format('Materialized view refreshed for %s videos', array_length(p_video_ids, 1))::TEXT;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION refresh_transcript_search_for_videos(UUID[]) TO service_role;

COMMENT ON MATERIALIZED VIEW transcript_search_context IS
  'Optimized materialized view using window functions for context. Includes all videos with quality transcripts. Supports full-text search with GIN index.';
