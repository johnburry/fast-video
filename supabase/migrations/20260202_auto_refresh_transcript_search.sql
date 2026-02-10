-- Migration: Automatically refresh transcript_search_context materialized view
-- This trigger refreshes the materialized view after transcript inserts/updates

-- Create a function to refresh the materialized view (idempotent)
CREATE OR REPLACE FUNCTION auto_refresh_transcript_search_context()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh the materialized view concurrently (non-blocking)
  -- This allows searches to continue while the refresh happens
  PERFORM refresh_transcript_search_context();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS trigger_refresh_transcript_search_context ON public.transcripts;

-- Create a trigger that runs AFTER INSERT on transcripts
-- STATEMENT level (not per row) to avoid multiple refreshes
CREATE TRIGGER trigger_refresh_transcript_search_context
  AFTER INSERT ON public.transcripts
  FOR EACH STATEMENT
  EXECUTE FUNCTION auto_refresh_transcript_search_context();

-- Add comment explaining the trigger
COMMENT ON TRIGGER trigger_refresh_transcript_search_context ON public.transcripts IS
  'Automatically refreshes the transcript_search_context materialized view after new transcripts are inserted. This ensures search results include newly imported videos without manual intervention.';

-- Add comment on the function
COMMENT ON FUNCTION auto_refresh_transcript_search_context() IS
  'Trigger function that refreshes transcript_search_context materialized view. Called automatically after transcript inserts.';
