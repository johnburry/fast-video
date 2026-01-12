-- Create transcript_jobs table to track async transcript processing
CREATE TABLE IF NOT EXISTS transcript_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(video_id, job_id)
);

-- Create index for efficient querying of pending jobs
CREATE INDEX IF NOT EXISTS idx_transcript_jobs_status ON transcript_jobs(status);
CREATE INDEX IF NOT EXISTS idx_transcript_jobs_video_id ON transcript_jobs(video_id);
CREATE INDEX IF NOT EXISTS idx_transcript_jobs_created_at ON transcript_jobs(created_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_transcript_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transcript_jobs_updated_at
  BEFORE UPDATE ON transcript_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_transcript_jobs_updated_at();
