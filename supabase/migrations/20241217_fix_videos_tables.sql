-- First, rename the mux videos table that we incorrectly created as "videos"
ALTER TABLE IF EXISTS public.videos RENAME TO mux_videos;

-- Rename the indexes
ALTER INDEX IF EXISTS idx_videos_mux_playback_id RENAME TO idx_mux_videos_playback_id;
ALTER INDEX IF EXISTS idx_videos_channel_id RENAME TO idx_mux_videos_channel_id;

-- Now recreate the proper YouTube videos table
CREATE TABLE IF NOT EXISTS public.videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  youtube_video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  published_at TIMESTAMP WITH TIME ZONE,
  view_count BIGINT,
  like_count BIGINT,
  comment_count BIGINT,
  has_transcript BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(youtube_video_id)
);

-- Create indexes for the videos table
CREATE INDEX IF NOT EXISTS idx_videos_channel_id ON public.videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_videos_youtube_id ON public.videos(youtube_video_id);
CREATE INDEX IF NOT EXISTS idx_videos_published_at ON public.videos(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_has_transcript ON public.videos(has_transcript) WHERE has_transcript = true;

-- Update comments
COMMENT ON TABLE public.videos IS 'Stores YouTube videos imported from channels';
COMMENT ON TABLE public.mux_videos IS 'Stores Mux hello videos recorded by channel owners';
COMMENT ON COLUMN public.mux_videos.mux_playback_id IS 'Mux playback ID for the video';
COMMENT ON COLUMN public.mux_videos.channel_id IS 'Associated channel (optional, for linking videos to channels)';
COMMENT ON COLUMN public.mux_videos.thumbnail_url IS 'Mux thumbnail URL for link previews';
