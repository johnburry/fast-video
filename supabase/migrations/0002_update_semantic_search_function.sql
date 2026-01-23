-- Update semantic search function to support tenant filtering

-- Drop existing function
drop function if exists search_transcripts_semantic(text, text, float, int);

-- Create updated function with tenant_id filtering
create or replace function search_transcripts_semantic(
  query_embedding text,
  channel_handle_filter text default null,
  tenant_id_filter uuid default null,
  match_threshold float default 0.7,
  match_count int default 50
)
returns table (
  transcript_id uuid,
  video_id uuid,
  youtube_video_id text,
  video_title text,
  video_thumbnail text,
  published_at timestamp with time zone,
  video_duration integer,
  channel_id uuid,
  channel_handle text,
  channel_name text,
  channel_thumbnail text,
  text text,
  start_time numeric,
  duration numeric,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    t.id as transcript_id,
    v.id as video_id,
    v.youtube_video_id,
    v.title as video_title,
    v.thumbnail_url as video_thumbnail,
    v.published_at,
    v.duration_seconds as video_duration,
    c.id as channel_id,
    c.channel_handle,
    c.channel_name,
    c.thumbnail_url as channel_thumbnail,
    t.text,
    t.start_time,
    t.duration,
    1 - (t.embedding <=> query_embedding::vector) as similarity
  from transcripts t
  join videos v on t.video_id = v.id
  join channels c on v.channel_id = c.id
  where
    c.is_active = true
    and t.embedding is not null
    and 1 - (t.embedding <=> query_embedding::vector) > match_threshold
    and (channel_handle_filter is null or c.channel_handle = channel_handle_filter)
    and (tenant_id_filter is null or c.tenant_id = tenant_id_filter)
  order by similarity desc
  limit match_count;
end;
$$;
