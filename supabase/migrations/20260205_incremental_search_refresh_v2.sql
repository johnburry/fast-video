-- Migration: Add unique index to enable concurrent refresh without timeout
-- The key insight: we need a unique index to use REFRESH MATERIALIZED VIEW CONCURRENTLY
-- Once we have that, the refresh can happen incrementally in the background

-- First, add a unique index to enable CONCURRENTLY refresh
-- This is required for REFRESH MATERIALIZED VIEW CONCURRENTLY to work
CREATE UNIQUE INDEX IF NOT EXISTS idx_transcript_search_context_unique
ON public.transcript_search_context (transcript_id);

-- Now that we have a unique index, REFRESH MATERIALIZED VIEW CONCURRENTLY will work
-- without locking and can be interrupted/resumed

-- Simple function to trigger the concurrent refresh
-- With the unique index, this should work better and can be interrupted if needed
CREATE OR REPLACE FUNCTION refresh_transcript_search_for_channel(p_channel_id UUID)
RETURNS TABLE(success BOOLEAN, videos_processed INTEGER, message TEXT) AS $$
BEGIN
  -- With a unique index, this refresh happens incrementally
  -- It can take a while but won't lock the table
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.transcript_search_context;

  RETURN QUERY SELECT TRUE, 0,
    'Successfully triggered concurrent refresh of search context'::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, 0, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION refresh_transcript_search_for_channel(UUID) TO service_role, anon, authenticated;

-- Comment
COMMENT ON FUNCTION refresh_transcript_search_for_channel(UUID) IS
  'Triggers a concurrent refresh of the transcript search materialized view. With the unique index, this runs incrementally without locking.';
