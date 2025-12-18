-- Add short_name field to channels table
ALTER TABLE channels
ADD COLUMN short_name TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN channels.short_name IS 'Short display name for the channel, used in video titles and previews';
