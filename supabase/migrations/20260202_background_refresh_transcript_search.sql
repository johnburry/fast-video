-- Migration: API-based refresh for transcript_search_context
-- The materialized view is too large to refresh via trigger (times out)
-- Instead, refresh is triggered via API endpoint after transcript imports

-- Create a table to track refresh status (optional - for monitoring)
CREATE TABLE IF NOT EXISTS public.transcript_search_refresh_status (
  id INTEGER PRIMARY KEY DEFAULT 1,
  needs_refresh BOOLEAN DEFAULT FALSE,
  last_refreshed_at TIMESTAMP WITH TIME ZONE,
  refresh_in_progress BOOLEAN DEFAULT FALSE,
  CONSTRAINT single_row_check CHECK (id = 1)
);

-- Insert the initial row if it doesn't exist
INSERT INTO public.transcript_search_refresh_status (id, needs_refresh, last_refreshed_at, refresh_in_progress)
VALUES (1, TRUE, NULL, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Grant access to anon and authenticated users to read refresh status
GRANT SELECT ON public.transcript_search_refresh_status TO anon, authenticated;

-- Function to perform the actual refresh (called by API/cron)
CREATE OR REPLACE FUNCTION perform_transcript_search_refresh()
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
BEGIN
  -- Mark as in progress
  UPDATE public.transcript_search_refresh_status
  SET refresh_in_progress = TRUE
  WHERE id = 1;

  -- Perform the refresh
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.transcript_search_context;

  -- Mark as complete
  UPDATE public.transcript_search_refresh_status
  SET
    needs_refresh = FALSE,
    last_refreshed_at = NOW(),
    refresh_in_progress = FALSE
  WHERE id = 1;

  RETURN QUERY SELECT TRUE, 'Refresh completed successfully'::TEXT;
EXCEPTION WHEN OTHERS THEN
  -- Mark as not in progress on error
  UPDATE public.transcript_search_refresh_status
  SET refresh_in_progress = FALSE
  WHERE id = 1;

  RETURN QUERY SELECT FALSE, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE public.transcript_search_refresh_status IS
  'Tracks whether transcript_search_context materialized view needs refreshing. Lightweight marker set by trigger, actual refresh done by API/cron.';

COMMENT ON FUNCTION mark_transcript_search_needs_refresh() IS
  'Lightweight trigger function that marks materialized view as needing refresh. Does not perform the refresh itself.';

COMMENT ON FUNCTION perform_transcript_search_refresh() IS
  'Performs the actual materialized view refresh. Called by API endpoint or cron job, not by trigger.';
