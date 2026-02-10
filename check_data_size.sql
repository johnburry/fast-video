-- Check how much data we're dealing with
SELECT
  COUNT(*) as total_transcripts,
  COUNT(DISTINCT video_id) as total_videos,
  COUNT(DISTINCT c.id) as total_channels
FROM public.transcripts t
JOIN public.videos v ON t.video_id = v.id
JOIN public.channels c ON v.channel_id = c.id
WHERE c.is_active = true;
