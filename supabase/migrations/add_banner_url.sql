-- Add banner_url column to channels table for link preview images
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS banner_url text;

-- Add comment to explain the column
COMMENT ON COLUMN public.channels.banner_url IS 'YouTube channel banner image URL for social media link previews';
