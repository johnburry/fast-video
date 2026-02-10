-- Migration: Optimize transcript_search_context - Create empty then populate
-- Step 1: Create the structure without data

-- Drop the existing materialized view and its indexes
DROP MATERIALIZED VIEW IF EXISTS public.transcript_search_context CASCADE;

-- Create optimized materialized view with NO DATA
CREATE MATERIALIZED VIEW public.transcript_search_context AS
WITH context_prep AS (
  SELECT
    t.id as transcript_id,
    t.video_id,
    t.text as original_text,
    t.start_time,
    t.duration,
    -- Use window functions to get previous and next segment text
    LAG(t.text, 1, '') OVER (PARTITION BY t.video_id ORDER BY t.start_time) as prev_text,
    LEAD(t.text, 1, '') OVER (PARTITION BY t.video_id ORDER BY t.start_time) as next_text,
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
)
SELECT
  transcript_id,
  video_id,
  original_text,
  start_time,
  duration,
  -- Combine previous, current, and next segments
  TRIM(CONCAT(prev_text, ' ', original_text, ' ', next_text)) as search_text,
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
FROM context_prep
WITH NO DATA;  -- Create structure only, don't populate yet

-- Create unique index on transcript_id to enable CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_transcript_search_context_transcript_id
  ON public.transcript_search_context(transcript_id);

-- Create other indexes on empty table (faster)
CREATE INDEX idx_transcript_search_context_video_id
  ON public.transcript_search_context(video_id);

CREATE INDEX idx_transcript_search_context_channel
  ON public.transcript_search_context(channel_handle);

-- Create full-text search index structure (on empty table)
CREATE INDEX idx_transcript_search_context_fts
  ON public.transcript_search_context
  USING gin(to_tsvector('english', search_text));

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_transcript_search_context()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.transcript_search_context;
END;
$$ LANGUAGE plpgsql;

-- Grant access
GRANT SELECT ON public.transcript_search_context TO anon, authenticated;

-- Add comment explaining the purpose
COMMENT ON MATERIALIZED VIEW public.transcript_search_context IS
  'Materialized view that includes surrounding segment context for each transcript entry. This enables full-text search to find phrases that span across segment boundaries. Refresh after adding new transcripts. Optimized with window functions for fast refresh.';
