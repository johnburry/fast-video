-- Truncate video_quotes table to remove hallucinated quotes
-- All quotes will be regenerated with improved validation and prompt

-- This removes all cached quotes so they can be regenerated with:
-- 1. Content validation (filters out music/filler-only videos)
-- 2. Strict no-hallucination rules in ChatGPT prompt
-- 3. Deduplication logic
-- 4. Minimum quality requirements

TRUNCATE TABLE video_quotes;

-- Add comment documenting why this was done
COMMENT ON TABLE video_quotes IS 'Video quotes extracted by AI. Truncated on 2026-02-08 to remove hallucinated quotes from music videos and regenerate with improved quality controls.';
