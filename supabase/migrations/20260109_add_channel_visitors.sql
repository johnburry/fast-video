-- Channel Visitors table for tracking subdomain page loads
create table public.channel_visitors (
  id uuid default uuid_generate_v4() primary key,
  channel_id uuid references public.channels(id) on delete cascade not null,
  ip_address text not null,
  user_agent text,
  visited_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for performance
create index idx_channel_visitors_channel_id on public.channel_visitors(channel_id);
create index idx_channel_visitors_visited_at on public.channel_visitors(visited_at desc);
create index idx_channel_visitors_channel_visited on public.channel_visitors(channel_id, visited_at desc);

-- Row Level Security (RLS) policies
alter table public.channel_visitors enable row level security;

-- Only allow authenticated users (admins) to read visitor data
create policy "Allow authenticated read access on channel_visitors" on public.channel_visitors
  for select using (auth.role() = 'authenticated');

-- Allow service role to insert visitor records
create policy "Allow service role insert on channel_visitors" on public.channel_visitors
  for insert with check (true);
