-- Add has_quality_transcript field to videos table
-- This distinguishes between low-quality auto-generated transcripts (music, applause only)
-- and actual valuable transcripts with speech content

ALTER TABLE videos ADD COLUMN has_quality_transcript BOOLEAN DEFAULT false;

-- Update existing videos: assume transcripts are quality if has_transcript is true
-- We'll revalidate during next import
UPDATE videos SET has_quality_transcript = has_transcript WHERE has_transcript = true;

-- Add index for faster queries
CREATE INDEX idx_videos_has_quality_transcript ON videos(has_quality_transcript);

COMMENT ON COLUMN videos.has_quality_transcript IS 'True if the transcript contains meaningful speech content (not just music/applause). Low-quality auto-generated transcripts are excluded from search and quote generation.';
