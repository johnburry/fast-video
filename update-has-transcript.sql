-- Update has_transcript flag for all videos that have transcripts
UPDATE public.videos
SET has_transcript = true
WHERE id IN (
  SELECT DISTINCT video_id
  FROM public.transcripts
)
AND has_transcript = false;

-- Verify the update
SELECT
  COUNT(*) FILTER (WHERE has_transcript = true) AS videos_with_transcripts,
  COUNT(*) FILTER (WHERE has_transcript = false) AS videos_without_transcripts,
  COUNT(*) AS total_videos
FROM public.videos;

-- Show sample of updated videos
SELECT
  youtube_video_id,
  title,
  has_transcript,
  (SELECT COUNT(*) FROM public.transcripts WHERE video_id = videos.id) AS transcript_count
FROM public.videos
WHERE has_transcript = true
LIMIT 10;
