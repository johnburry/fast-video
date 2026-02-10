-- Migration: Optimize transcript_search_context with chunked approach
-- This version creates the view structure first, then populates it in batches

-- Drop the existing materialized view and its indexes
DROP MATERIALIZED VIEW IF EXISTS public.transcript_search_context CASCADE;

-- Create a regular table instead of materialized view for better control
DROP TABLE IF EXISTS public.transcript_search_context CASCADE;

CREATE TABLE public.transcript_search_context (
  transcript_id UUID PRIMARY KEY,
  video_id UUID NOT NULL,
  original_text TEXT,
  start_time NUMERIC,
  duration NUMERIC,
  search_text TEXT,
  youtube_video_id TEXT,
  video_title TEXT,
  video_thumbnail TEXT,
  published_at TIMESTAMPTZ,
  video_duration INTEGER,
  channel_id UUID,
  channel_handle TEXT,
  channel_name TEXT,
  channel_thumbnail TEXT,
  tenant_id UUID
);

-- Create indexes before bulk insert (more efficient)
CREATE INDEX idx_transcript_search_context_video_id
  ON public.transcript_search_context(video_id);

CREATE INDEX idx_transcript_search_context_channel
  ON public.transcript_search_context(channel_handle);

-- Function to populate/refresh the table in chunks
CREATE OR REPLACE FUNCTION refresh_transcript_search_context()
RETURNS void AS $$
DECLARE
  v_batch_size INTEGER := 10000;
  v_offset INTEGER := 0;
  v_rows_inserted INTEGER;
BEGIN
  -- Clear existing data
  TRUNCATE TABLE public.transcript_search_context;

  LOOP
    -- Insert in batches using window functions
    WITH context_prep AS (
      SELECT
        t.id as transcript_id,
        t.video_id,
        t.text as original_text,
        t.start_time,
        t.duration,
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
        c.tenant_id,
        ROW_NUMBER() OVER (ORDER BY t.id) as rn
      FROM public.transcripts t
      JOIN public.videos v ON t.video_id = v.id
      JOIN public.channels c ON v.channel_id = c.id
      WHERE c.is_active = true
    )
    INSERT INTO public.transcript_search_context
    SELECT
      transcript_id,
      video_id,
      original_text,
      start_time,
      duration,
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
    WHERE rn > v_offset AND rn <= v_offset + v_batch_size;

    GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

    -- Exit loop when no more rows
    EXIT WHEN v_rows_inserted = 0;

    v_offset := v_offset + v_batch_size;

    -- Optional: Commit after each batch (helps avoid long transactions)
    COMMIT;
  END LOOP;

  -- Create full-text search index after all data is loaded
  DROP INDEX IF EXISTS idx_transcript_search_context_fts;
  CREATE INDEX idx_transcript_search_context_fts
    ON public.transcript_search_context
    USING gin(to_tsvector('english', search_text));

END;
$$ LANGUAGE plpgsql;

-- Grant access
GRANT SELECT ON public.transcript_search_context TO anon, authenticated;

-- Add comment explaining the purpose
COMMENT ON TABLE public.transcript_search_context IS
  'Table that includes surrounding segment context for each transcript entry. This enables full-text search to find phrases that span across segment boundaries. Refresh after adding new transcripts using refresh_transcript_search_context(). Optimized with window functions and batched processing.';
