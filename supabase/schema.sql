-- PlaySermons.com Database Schema

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Channels table
create table public.channels (
  id uuid default uuid_generate_v4() primary key,
  youtube_channel_id text unique not null,
  channel_handle text unique not null,
  channel_name text not null,
  channel_description text,
  thumbnail_url text,
  subscriber_count bigint,
  video_count integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_synced_at timestamp with time zone,
  is_active boolean default true
);

-- Videos table
create table public.videos (
  id uuid default uuid_generate_v4() primary key,
  channel_id uuid references public.channels(id) on delete cascade not null,
  youtube_video_id text unique not null,
  title text not null,
  description text,
  thumbnail_url text,
  duration_seconds integer,
  published_at timestamp with time zone,
  view_count bigint,
  like_count integer,
  comment_count integer,
  has_transcript boolean default false,
  transcript_language text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Transcripts table
create table public.transcripts (
  id uuid default uuid_generate_v4() primary key,
  video_id uuid references public.videos(id) on delete cascade not null,
  text text not null,
  start_time numeric not null, -- in seconds
  duration numeric not null, -- in seconds
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for performance
create index idx_channels_handle on public.channels(channel_handle);
create index idx_channels_youtube_id on public.channels(youtube_channel_id);
create index idx_videos_channel_id on public.videos(channel_id);
create index idx_videos_youtube_id on public.videos(youtube_video_id);
create index idx_videos_published_at on public.videos(published_at desc);
create index idx_transcripts_video_id on public.transcripts(video_id);
create index idx_transcripts_start_time on public.transcripts(video_id, start_time);

-- Create full-text search index on transcripts
create index idx_transcripts_text_search on public.transcripts using gin(to_tsvector('english', text));

-- Create full-text search index on video titles and descriptions
create index idx_videos_text_search on public.videos using gin(
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
);

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Triggers to automatically update updated_at
create trigger update_channels_updated_at before update on public.channels
  for each row execute procedure update_updated_at_column();

create trigger update_videos_updated_at before update on public.videos
  for each row execute procedure update_updated_at_column();

-- Row Level Security (RLS) policies
alter table public.channels enable row level security;
alter table public.videos enable row level security;
alter table public.transcripts enable row level security;

-- Allow public read access
create policy "Allow public read access on channels" on public.channels
  for select using (is_active = true);

create policy "Allow public read access on videos" on public.videos
  for select using (true);

create policy "Allow public read access on transcripts" on public.transcripts
  for select using (true);

-- Create a view for search results with video and channel info
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
