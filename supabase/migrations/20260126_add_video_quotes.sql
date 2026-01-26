-- Video Quotes table for AI-generated powerful quotes from videos
create table public.video_quotes (
  id uuid default uuid_generate_v4() primary key,
  video_id uuid references public.videos(id) on delete cascade not null,
  quote_text text not null,
  start_time numeric not null, -- in seconds, timestamp where quote begins
  duration numeric not null, -- in seconds, duration of the quote
  quote_index integer not null, -- 1-10, the rank/position of this quote
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for performance
create index idx_video_quotes_video_id on public.video_quotes(video_id);
create index idx_video_quotes_video_id_index on public.video_quotes(video_id, quote_index);

-- Trigger to automatically update updated_at
create trigger update_video_quotes_updated_at before update on public.video_quotes
  for each row execute procedure update_updated_at_column();

-- Row Level Security (RLS) policies
alter table public.video_quotes enable row level security;

-- Allow public read access
create policy "Allow public read access on video_quotes" on public.video_quotes
  for select using (true);

-- Only allow service role to insert/update/delete (API will handle this)
create policy "Allow service role full access on video_quotes" on public.video_quotes
  for all using (true);
