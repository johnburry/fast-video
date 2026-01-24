-- Add IP address column to search_analytics table

alter table search_analytics add column if not exists ip_address text;

-- Add index for IP address lookups
create index if not exists search_analytics_ip_address_idx on search_analytics(ip_address);

-- Add comment
comment on column search_analytics.ip_address is 'IP address of the user who performed the search';
