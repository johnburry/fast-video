-- Create search analytics table to track all searches performed

create table if not exists search_analytics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  tenant_name text not null,
  channel_id uuid references channels(id) on delete set null,
  channel_name text,
  search_query text not null,
  results_count integer default 0,
  search_type text, -- 'hybrid', 'keyword', 'semantic'
  searched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Add indexes for common queries
create index if not exists search_analytics_tenant_id_idx on search_analytics(tenant_id);
create index if not exists search_analytics_channel_id_idx on search_analytics(channel_id);
create index if not exists search_analytics_searched_at_idx on search_analytics(searched_at desc);
create index if not exists search_analytics_tenant_searched_at_idx on search_analytics(tenant_id, searched_at desc);

-- Add comment
comment on table search_analytics is 'Tracks all search queries performed across all tenants and channels';
comment on column search_analytics.tenant_name is 'Denormalized tenant name for easier reporting';
comment on column search_analytics.channel_name is 'Denormalized channel name for easier reporting (null for cross-channel searches)';
comment on column search_analytics.search_type is 'Type of search performed: hybrid, keyword, or semantic';
comment on column search_analytics.results_count is 'Number of results returned for this search';
