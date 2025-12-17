-- Create videos table for storing uploaded hello videos
CREATE TABLE IF NOT EXISTS public.videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  playback_id TEXT NOT NULL UNIQUE,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster lookups by playback_id
CREATE INDEX IF NOT EXISTS idx_videos_playback_id ON public.videos(playback_id);

-- Add index for channel_id
CREATE INDEX IF NOT EXISTS idx_videos_channel_id ON public.videos(channel_id);

COMMENT ON TABLE public.videos IS 'Stores hello videos uploaded by channel owners';
COMMENT ON COLUMN public.videos.playback_id IS 'Mux playback ID for the video';
COMMENT ON COLUMN public.videos.channel_id IS 'Associated channel (optional, for linking videos to channels)';
COMMENT ON COLUMN public.videos.thumbnail_url IS 'Mux thumbnail URL for link previews';
