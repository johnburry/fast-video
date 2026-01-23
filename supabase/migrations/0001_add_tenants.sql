-- Add tenants table for multi-tenant support

-- Create tenants table
create table public.tenants (
  id uuid default uuid_generate_v4() primary key,
  domain text unique not null,
  name text not null,
  logo_type text not null check (logo_type in ('text', 'image')),
  logo_text text,
  logo_image_url text,
  logo_alt_text text not null,
  tagline text,
  search_placeholder text not null,
  search_results_heading text not null,
  features jsonb,
  colors jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  is_active boolean default true
);

-- Add tenant_id to channels table
alter table public.channels add column tenant_id uuid references public.tenants(id) on delete set null;

-- Create indexes
create index idx_tenants_domain on public.tenants(domain);
create index idx_channels_tenant_id on public.channels(tenant_id);

-- Add updated_at trigger for tenants
create trigger update_tenants_updated_at before update on public.tenants
  for each row execute procedure update_updated_at_column();

-- Enable RLS for tenants
alter table public.tenants enable row level security;

-- Allow public read access to active tenants
create policy "Allow public read access on tenants" on public.tenants
  for select using (is_active = true);

-- Update search_results view to include tenant_id
drop view if exists public.search_results;
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
  c.thumbnail_url as channel_thumbnail,
  c.tenant_id
from public.transcripts t
join public.videos v on t.video_id = v.id
join public.channels c on v.channel_id = c.id
where c.is_active = true;

-- Insert initial tenants
insert into public.tenants (
  domain,
  name,
  logo_type,
  logo_image_url,
  logo_alt_text,
  tagline,
  search_placeholder,
  search_results_heading,
  features,
  is_active
) values (
  'playsermons.com',
  'Play Sermons',
  'image',
  '/playsermons-logo-2.png',
  'Play Sermons',
  'Search and discover sermons from churches worldwide',
  'Search all churches',
  'Searching across all church sermons',
  '[
    {
      "icon": "🎥",
      "title": "10,000+ Sermons",
      "description": "Access thousands of sermons from churches around the world"
    },
    {
      "icon": "🔍",
      "title": "Smart Search",
      "description": "Find exactly what you are looking for with AI-powered search"
    },
    {
      "icon": "⚡",
      "title": "Fast & Easy",
      "description": "Search through hours of content in seconds"
    }
  ]'::jsonb,
  true
);

insert into public.tenants (
  domain,
  name,
  logo_type,
  logo_text,
  logo_alt_text,
  search_placeholder,
  search_results_heading,
  is_active
) values (
  'fast.video',
  'Fast.Video',
  'text',
  'Fast.Video',
  'Fast.Video',
  'Search all videos',
  'Searching videos across all channels',
  true
);

-- Get the tenant IDs for reference
do $$
declare
  playsermons_tenant_id uuid;
  fastvideo_tenant_id uuid;
begin
  -- Get tenant IDs
  select id into playsermons_tenant_id from public.tenants where domain = 'playsermons.com';
  select id into fastvideo_tenant_id from public.tenants where domain = 'fast.video';

  -- You can manually assign existing channels to tenants here if needed
  -- Example:
  -- update public.channels set tenant_id = playsermons_tenant_id where channel_handle = 'some-channel';
end $$;
