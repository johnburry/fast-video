-- Add channels_gallery field to tenants table
alter table public.tenants add column channels_gallery boolean default false;

-- Add comment to describe the field
comment on column public.tenants.channels_gallery is 'When true, the tenant homepage displays a gallery of all channels instead of redirecting. This overrides the redirect_url field.';
