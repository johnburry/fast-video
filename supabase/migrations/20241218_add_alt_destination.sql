-- Add alt_destination field to mux_videos table
ALTER TABLE mux_videos
ADD COLUMN alt_destination TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN mux_videos.alt_destination IS 'Alternative destination URL to redirect to after video ends, overrides default channel redirect';
