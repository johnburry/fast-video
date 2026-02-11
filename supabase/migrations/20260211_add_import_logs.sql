-- Create table for tracking individual video imports in a job
CREATE TABLE IF NOT EXISTS channel_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES channel_import_jobs(id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  youtube_video_id TEXT NOT NULL,
  video_title TEXT NOT NULL,
  video_published_at TIMESTAMPTZ,
  action_type TEXT NOT NULL CHECK (action_type IN ('video_imported', 'transcript_downloaded', 'transcript_skipped', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups by job
CREATE INDEX idx_channel_import_logs_job_id ON channel_import_logs(job_id, created_at);
CREATE INDEX idx_channel_import_logs_video_id ON channel_import_logs(video_id);

-- Grant access
GRANT SELECT, INSERT ON channel_import_logs TO anon, authenticated;

COMMENT ON TABLE channel_import_logs IS 'Detailed log of each video processed during a channel import job';
