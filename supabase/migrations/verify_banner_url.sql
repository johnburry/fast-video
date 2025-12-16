-- Verify if banner_url column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'channels'
  AND column_name = 'banner_url';

-- If the above returns no rows, run this:
-- ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS banner_url text;

-- Check current channels and their banner_url values
SELECT
  channel_name,
  channel_handle,
  banner_url,
  CASE
    WHEN banner_url IS NULL THEN 'NULL'
    WHEN banner_url = '' THEN 'EMPTY STRING'
    ELSE 'HAS VALUE'
  END as banner_status
FROM public.channels;
