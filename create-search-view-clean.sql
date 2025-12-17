CREATE OR REPLACE VIEW public.search_results AS
SELECT
  t.id AS transcript_id,
  t.text,
  t.start_time,
  t.duration,
  v.id AS video_id,
  v.youtube_video_id,
  v.title AS video_title,
  v.thumbnail_url AS video_thumbnail,
  v.published_at,
  v.duration_seconds AS video_duration,
  c.id AS channel_id,
  c.channel_handle,
  c.channel_name,
  c.thumbnail_url AS channel_thumbnail
FROM public.transcripts t
JOIN public.videos v ON t.video_id = v.id
JOIN public.channels c ON v.channel_id = c.id
WHERE c.is_active = true;
