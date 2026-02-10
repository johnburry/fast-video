-- Add transcripts_only parameter to channel_import_jobs table
ALTER TABLE channel_import_jobs
ADD COLUMN IF NOT EXISTS transcripts_only BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN channel_import_jobs.transcripts_only IS 'When true, only fetch missing transcripts for existing videos';
