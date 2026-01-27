-- Add is_music_channel column to channels table
-- When set to true, transcription will be skipped during video import

ALTER TABLE public.channels
ADD COLUMN is_music_channel BOOLEAN DEFAULT false NOT NULL;

COMMENT ON COLUMN public.channels.is_music_channel IS 'Flag to skip transcription for music channels where transcripts are not needed';
