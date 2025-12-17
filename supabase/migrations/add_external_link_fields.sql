-- Migration: Add external_link and external_link_name to channels table
-- These fields allow channels to add a custom external link (e.g., homepage, Linktree)

-- Add external_link column (URL)
ALTER TABLE public.channels
ADD COLUMN external_link TEXT;

-- Add external_link_name column (display name for the link)
ALTER TABLE public.channels
ADD COLUMN external_link_name TEXT;

-- Add comments to explain the purpose of these columns
COMMENT ON COLUMN public.channels.external_link IS 'Optional external URL for the channel (e.g., homepage, Linktree)';
COMMENT ON COLUMN public.channels.external_link_name IS 'Display name for the external link (e.g., "Visit Website", "Linktree")';
