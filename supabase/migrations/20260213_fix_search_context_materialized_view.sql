-- Migration: Fix transcript_search_context search index
--
-- Problem: The search index was a MATERIALIZED VIEW with a no-op refresh function,
-- so new videos never appeared in search results.
--
-- Solution: Use a TABLE instead of a materialized view. This allows:
--   1. GIN indexes for full-text search (unlike regular views)
--   2. Incremental INSERT/DELETE for specific videos (unlike materialized views)
--   3. Batched population to avoid timeouts on large datasets (1.6M+ transcripts)
--
-- After running this migration, call the populate function via the admin API
-- (POST /api/admin/refresh-search-index) to rebuild the search index in batches.

-- Step 1: Drop whatever currently exists
DROP VIEW IF EXISTS transcript_search_context CASCADE;
DROP MATERIALIZED VIEW IF EXISTS transcript_search_context CASCADE;
DROP TABLE IF EXISTS transcript_search_context CASCADE;

-- Step 2: Create as a TABLE
CREATE TABLE transcript_search_context (
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

-- Step 3: Create indexes
-- GIN index for full-text search (this is what makes .textSearch() work)
CREATE INDEX idx_tsc_fts
  ON transcript_search_context
  USING gin(to_tsvector('english', search_text));

CREATE INDEX idx_tsc_video_id ON transcript_search_context(video_id);
CREATE INDEX idx_tsc_channel_handle ON transcript_search_context(channel_handle);
CREATE INDEX idx_tsc_tenant_id ON transcript_search_context(tenant_id);

-- Step 4: Grant permissions
GRANT SELECT ON transcript_search_context TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON transcript_search_context TO service_role;

-- Step 5: Incremental refresh for specific videos (called after imports)
CREATE OR REPLACE FUNCTION refresh_transcript_search_for_videos(p_video_ids UUID[])
RETURNS TABLE(success BOOLEAN, videos_processed INTEGER, message TEXT) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Delete existing entries for these videos
  DELETE FROM transcript_search_context
  WHERE video_id = ANY(p_video_ids);

  -- Insert fresh data for these videos using window functions
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
    WHERE t.video_id = ANY(p_video_ids)
      AND c.is_active = true
      AND v.has_quality_transcript = true
  )
  INSERT INTO transcript_search_context
  SELECT
    transcript_id, video_id, original_text, start_time, duration,
    TRIM(CONCAT(COALESCE(prev_text, ''), ' ', original_text, ' ', COALESCE(next_text, ''))) as search_text,
    youtube_video_id, video_title, video_thumbnail, published_at, video_duration,
    channel_id, channel_handle, channel_name, channel_thumbnail, tenant_id
  FROM transcript_with_context;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT TRUE, array_length(p_video_ids, 1),
    format('Refreshed %s transcript rows for %s videos', v_count, array_length(p_video_ids, 1))::TEXT;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, 0, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Batch populate function - processes one batch of videos at a time
-- Called repeatedly by the API endpoint to populate the full table
CREATE OR REPLACE FUNCTION populate_search_context_batch(
  p_batch_size INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(success BOOLEAN, videos_in_batch INTEGER, total_eligible INTEGER, message TEXT) AS $$
DECLARE
  v_video_ids UUID[];
  v_total INTEGER;
  v_count INTEGER;
BEGIN
  -- Count total eligible videos
  SELECT count(*)::INTEGER INTO v_total
  FROM public.videos v
  JOIN public.channels c ON v.channel_id = c.id
  WHERE c.is_active = true AND v.has_quality_transcript = true;

  -- Get the batch of video IDs
  SELECT array_agg(id) INTO v_video_ids
  FROM (
    SELECT v.id
    FROM public.videos v
    JOIN public.channels c ON v.channel_id = c.id
    WHERE c.is_active = true AND v.has_quality_transcript = true
    ORDER BY v.id
    LIMIT p_batch_size OFFSET p_offset
  ) sub;

  IF v_video_ids IS NULL OR array_length(v_video_ids, 1) IS NULL THEN
    RETURN QUERY SELECT TRUE, 0, v_total,
      'No more videos to process'::TEXT;
    RETURN;
  END IF;

  -- Delete any existing entries for this batch
  DELETE FROM transcript_search_context
  WHERE video_id = ANY(v_video_ids);

  -- Insert data for this batch
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
    WHERE t.video_id = ANY(v_video_ids)
      AND c.is_active = true
      AND v.has_quality_transcript = true
  )
  INSERT INTO transcript_search_context
  SELECT
    transcript_id, video_id, original_text, start_time, duration,
    TRIM(CONCAT(COALESCE(prev_text, ''), ' ', original_text, ' ', COALESCE(next_text, ''))) as search_text,
    youtube_video_id, video_title, video_thumbnail, published_at, video_duration,
    channel_id, channel_handle, channel_name, channel_thumbnail, tenant_id
  FROM transcript_with_context;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT TRUE, array_length(v_video_ids, 1), v_total,
    format('Inserted %s rows for %s videos (offset %s of %s total)', v_count, array_length(v_video_ids, 1), p_offset, v_total)::TEXT;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, 0, v_total, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Keep perform_transcript_search_refresh for manual full refresh via admin
-- (The API endpoint will call populate_search_context_batch in a loop)
CREATE OR REPLACE FUNCTION perform_transcript_search_refresh()
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
BEGIN
  -- For large datasets, use the batch populate API endpoint instead.
  -- This function does a single-video-batch approach for smaller datasets.
  RETURN QUERY SELECT TRUE,
    'Use POST /api/admin/refresh-search-index for batched rebuild'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Grant execute
GRANT EXECUTE ON FUNCTION refresh_transcript_search_for_videos(UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION populate_search_context_batch(INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION perform_transcript_search_refresh() TO service_role, anon, authenticated;

-- Notify PostgREST to reload schema cache (picks up the new table)
NOTIFY pgrst, 'reload schema';
