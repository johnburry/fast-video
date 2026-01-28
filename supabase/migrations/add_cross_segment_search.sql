-- Migration: Add cross-segment search capability
-- This solves the problem where search phrases split across segment boundaries aren't found

-- Create a function to get combined text for a transcript segment with surrounding context
create or replace function get_transcript_context(
  p_video_id uuid,
  p_start_time numeric,
  p_context_segments integer default 1
)
returns text as $$
declare
  v_combined_text text;
begin
  -- Get the current segment plus N segments before and after
  select string_agg(text, ' ' order by start_time)
  into v_combined_text
  from (
    select text, start_time
    from transcripts
    where video_id = p_video_id
      and start_time >= (
        select coalesce(
          (select start_time
           from transcripts
           where video_id = p_video_id
             and start_time < p_start_time
           order by start_time desc
           limit 1 offset p_context_segments - 1),
          0
        )
      )
      and start_time <= (
        select coalesce(
          (select start_time
           from transcripts
           where video_id = p_video_id
             and start_time > p_start_time
           order by start_time asc
           limit 1 offset p_context_segments - 1),
          999999
        )
      )
    order by start_time
  ) t;

  return v_combined_text;
end;
$$ language plpgsql stable;

-- Create a materialized view that includes context for better search
create materialized view if not exists public.transcript_search_context as
select
  t.id as transcript_id,
  t.video_id,
  t.text as original_text,
  t.start_time,
  t.duration,
  -- Combine current segment with 1 before and 1 after for search context
  (
    select string_agg(t2.text, ' ' order by t2.start_time)
    from transcripts t2
    where t2.video_id = t.video_id
      and t2.start_time between
        coalesce(
          (select start_time from transcripts
           where video_id = t.video_id and start_time < t.start_time
           order by start_time desc limit 1),
          t.start_time
        )
        and
        coalesce(
          (select start_time from transcripts
           where video_id = t.video_id and start_time > t.start_time
           order by start_time asc limit 1),
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
from public.transcripts t
join public.videos v on t.video_id = v.id
join public.channels c on v.channel_id = c.id
where c.is_active = true;

-- Create full-text search index on the combined search_text
create index idx_transcript_search_context_fts
  on public.transcript_search_context
  using gin(to_tsvector('english', search_text));

-- Create index for faster lookups
create index idx_transcript_search_context_video_id
  on public.transcript_search_context(video_id);

create index idx_transcript_search_context_channel
  on public.transcript_search_context(channel_handle);

-- Function to refresh the materialized view
create or replace function refresh_transcript_search_context()
returns void as $$
begin
  refresh materialized view concurrently public.transcript_search_context;
end;
$$ language plpgsql;

-- Grant access
grant select on public.transcript_search_context to anon, authenticated;

-- Add comment explaining the purpose
comment on materialized view public.transcript_search_context is
  'Materialized view that includes surrounding segment context for each transcript entry. This enables full-text search to find phrases that span across segment boundaries. Refresh after adding new transcripts.';
