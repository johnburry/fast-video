-- Add override_video_thumbnail field to mux_videos table
ALTER TABLE mux_videos
ADD COLUMN override_video_thumbnail BOOLEAN DEFAULT false;

-- Add comment to explain the field
COMMENT ON COLUMN mux_videos.override_video_thumbnail IS 'When true, use channel thumbnail as video poster image instead of Mux thumbnail';
