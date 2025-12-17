-- Migration: Add hello_video_url to channels table
-- This field stores the Mux playback URL for a channel's "Hello" video message

-- Add hello_video_url column
ALTER TABLE public.channels
ADD COLUMN hello_video_url TEXT;

-- Add comment to explain the purpose
COMMENT ON COLUMN public.channels.hello_video_url IS 'Mux playback URL for the channel''s hello video message that plays when users visit the channel';

-- Example usage:
-- UPDATE channels
-- SET hello_video_url = 'https://stream.mux.com/[playback-id].m3u8'
-- WHERE channel_handle = 'your-channel';
