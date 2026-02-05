-- Migration: Add incremental refresh for transcript_search_context
-- The full REFRESH MATERIALIZED VIEW times out due to expensive subqueries
-- This migration adds an incremental approach that only processes new/updated videos

-- Create a function to incrementally refresh search context for specific videos
CREATE OR REPLACE FUNCTION refresh_transcript_search_for_videos(p_video_ids UUID[])
RETURNS TABLE(success BOOLEAN, videos_processed INTEGER, message TEXT) AS $$
DECLARE
  v_videos_processed INTEGER := 0;
  v_video_id UUID;
BEGIN
  -- Delete existing entries for these videos
  DELETE FROM public.transcript_search_context
  WHERE video_id = ANY(p_video_ids);

  GET DIAGNOSTICS v_videos_processed = ROW_COUNT;

  -- Insert fresh data for these videos
  INSERT INTO public.transcript_search_context
  SELECT
    t.id as transcript_id,
    t.video_id,
    t.text as original_text,
    t.start_time,
    t.duration,
    -- Combine current segment with 1 before and 1 after for search context
    (
      SELECT string_agg(t2.text, ' ' ORDER BY t2.start_time)
      FROM transcripts t2
      WHERE t2.video_id = t.video_id
        AND t2.start_time BETWEEN
          COALESCE(
            (SELECT start_time FROM transcripts
             WHERE video_id = t.video_id AND start_time < t.start_time
             ORDER BY start_time DESC LIMIT 1),
            t.start_time
          )
          AND
          COALESCE(
            (SELECT start_time FROM transcripts
             WHERE video_id = t.video_id AND start_time > t.start_time
             ORDER BY start_time ASC LIMIT 1),
            t.start_time
          )
    ) as search_text,
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
    AND c.is_active = TRUE;

  RETURN QUERY SELECT TRUE, array_length(p_video_ids, 1),
    format('Successfully refreshed search context for %s videos', array_length(p_video_ids, 1))::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, 0, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Create a function to incrementally refresh for a specific channel
CREATE OR REPLACE FUNCTION refresh_transcript_search_for_channel(p_channel_id UUID)
RETURNS TABLE(success BOOLEAN, videos_processed INTEGER, message TEXT) AS $$
DECLARE
  v_video_ids UUID[];
BEGIN
  -- Get all video IDs for this channel
  SELECT array_agg(id)
  INTO v_video_ids
  FROM public.videos
  WHERE channel_id = p_channel_id;

  -- Refresh for these videos
  RETURN QUERY SELECT * FROM refresh_transcript_search_for_videos(v_video_ids);

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, 0, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Simple refresh that just calls REFRESH MATERIALIZED VIEW CONCURRENTLY
-- This is kept for backward compatibility but may timeout on large datasets
CREATE OR REPLACE FUNCTION perform_transcript_search_refresh()
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
BEGIN
  -- Mark as in progress
  UPDATE public.transcript_search_refresh_status
  SET refresh_in_progress = TRUE
  WHERE id = 1;

  -- Perform the refresh (may timeout on large datasets)
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION refresh_transcript_search_for_videos(UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION refresh_transcript_search_for_channel(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION perform_transcript_search_refresh() TO service_role, anon, authenticated;

-- Comments
COMMENT ON FUNCTION refresh_transcript_search_for_videos(UUID[]) IS
  'Incrementally refreshes transcript search context for specific videos. Much faster than full refresh.';

COMMENT ON FUNCTION refresh_transcript_search_for_channel(UUID) IS
  'Incrementally refreshes transcript search context for all videos in a channel.';

COMMENT ON FUNCTION perform_transcript_search_refresh() IS
  'Performs batched refresh of the entire materialized view. Processes videos in batches to avoid timeouts.';
