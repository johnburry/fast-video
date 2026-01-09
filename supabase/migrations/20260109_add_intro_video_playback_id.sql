-- Add intro_video_playback_id field to channels table
ALTER TABLE public.channels ADD COLUMN intro_video_playback_id text;

-- Create index for quick lookups
CREATE INDEX idx_channels_intro_video_playback_id ON public.channels(intro_video_playback_id);
