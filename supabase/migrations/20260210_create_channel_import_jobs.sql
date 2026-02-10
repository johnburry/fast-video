-- Create table for tracking long-running channel import jobs
CREATE TABLE IF NOT EXISTS channel_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  progress JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Import parameters
  video_limit INTEGER,
  include_live_videos BOOLEAN DEFAULT FALSE,
  skip_transcripts BOOLEAN DEFAULT FALSE,

  -- Progress tracking
  videos_processed INTEGER DEFAULT 0,
  videos_total INTEGER DEFAULT 0,
  current_video_title TEXT,

  -- Results
  transcripts_downloaded INTEGER DEFAULT 0,
  embeddings_generated INTEGER DEFAULT 0
);

-- Index for quick lookups by channel
CREATE INDEX idx_channel_import_jobs_channel_id ON channel_import_jobs(channel_id);
CREATE INDEX idx_channel_import_jobs_status ON channel_import_jobs(status);
CREATE INDEX idx_channel_import_jobs_created_at ON channel_import_jobs(created_at DESC);

-- Grant access
GRANT SELECT, INSERT, UPDATE ON channel_import_jobs TO anon, authenticated;

COMMENT ON TABLE channel_import_jobs IS 'Tracks long-running channel import jobs that continue in background';
