-- Create the search_results view for full-text search
-- This view joins transcripts with videos and channels for easy searching

create or replace view public.search_results as
select
  t.id as transcript_id,
  t.text,
  t.start_time,
  t.duration,
  v.id as video_id,
  v.youtube_video_id,
  v.title as video_title,
  v.thumbnail_url as video_thumbnail,
  v.published_at,
  v.duration_seconds as video_duration,
  c.id as channel_id,
  c.channel_handle,
  c.channel_name,
  c.thumbnail_url as channel_thumbnail
from public.transcripts t
join public.videos v on t.video_id = v.id
join public.channels c on v.channel_id = c.id
where c.is_active = true;

-- Verify the view was created
SELECT COUNT(*) as total_transcript_segments
FROM public.search_results;
