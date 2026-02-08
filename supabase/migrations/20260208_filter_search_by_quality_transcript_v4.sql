-- Migration: Filter search results to exclude low-quality transcripts (v4 - Drop with CASCADE)
-- This ensures that videos with only music/applause/filler content don't appear in search results

-- 1. Drop ALL existing versions of the semantic search function using CASCADE
-- The CASCADE will handle any dependencies
-- We list all possible signatures that might exist

-- Drop the 4-parameter version (original)
DROP FUNCTION IF EXISTS public.search_transcripts_semantic(
  vector(1536),
  text,
  float,
  int
) CASCADE;

-- Drop the 5-parameter version (if it exists)
DROP FUNCTION IF EXISTS public.search_transcripts_semantic(
  vector(1536),
  text,
  uuid,
  float,
  int
) CASCADE;

-- Drop the 6-parameter version (if it exists)
DROP FUNCTION IF EXISTS public.search_transcripts_semantic(
  vector(1536),
  text,
  uuid,
  uuid,
  float,
  int
) CASCADE;

-- Alternative: Drop by matching any function with this name (nuclear option)
DO $$
DECLARE
  func_signature text;
BEGIN
  FOR func_signature IN
    SELECT pg_get_functiondef(oid)
    FROM pg_proc
    WHERE proname = 'search_transcripts_semantic'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION ' || func_signature || ' CASCADE';
  END LOOP;
END $$;

-- 2. Create the new version with quality transcript filter
CREATE FUNCTION search_transcripts_semantic(
  query_embedding vector(1536),
  channel_handle_filter text DEFAULT NULL,
  channel_id_filter uuid DEFAULT NULL,
  tenant_id_filter uuid DEFAULT NULL,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 50
)
RETURNS TABLE (
  transcript_id uuid,
  video_id uuid,
  youtube_video_id text,
  video_title text,
  video_thumbnail text,
  published_at timestamptz,
  video_duration int,
  channel_id uuid,
  channel_handle text,
  channel_name text,
  channel_thumbnail text,
  text text,
  start_time numeric,
  duration numeric,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id as transcript_id,
    v.id as video_id,
    v.youtube_video_id,
    v.title as video_title,
    v.thumbnail_url as video_thumbnail,
    v.published_at,
    v.duration_seconds as video_duration,
    c.id as channel_id,
    c.channel_handle,
    c.channel_name,
    c.thumbnail_url as channel_thumbnail,
    t.text,
    t.start_time,
    t.duration,
    1 - (t.embedding <=> query_embedding) as similarity
  FROM public.transcripts t
  JOIN public.videos v ON t.video_id = v.id
  JOIN public.channels c ON v.channel_id = c.id
  WHERE
    c.is_active = true
    AND v.has_quality_transcript = true  -- ONLY include quality transcripts
    AND t.embedding IS NOT NULL
    AND (channel_handle_filter IS NULL OR c.channel_handle = channel_handle_filter)
    AND (channel_id_filter IS NULL OR c.id = channel_id_filter)
    AND (tenant_id_filter IS NULL OR c.tenant_id = tenant_id_filter)
    AND 1 - (t.embedding <=> query_embedding) > match_threshold
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_transcripts_semantic IS
'Performs semantic search on transcript embeddings using cosine similarity.
Only returns transcripts from videos with quality transcripts (excludes music/applause-only videos).
Returns results with similarity score (higher is better, 1.0 = identical).
Uses <=> operator for cosine distance (1 - cosine_similarity).';

-- 3. Create the updated view definition (without rebuilding materialized view yet)
DROP VIEW IF EXISTS transcript_search_context_new CASCADE;

CREATE VIEW transcript_search_context_new AS
SELECT
  t.id as transcript_id,
  t.video_id,
  t.text as original_text,
  t.start_time,
  t.duration,
  -- Combine current segment with 1 before and 1 after for search context
  (
    SELECT string_agg(t2.text, ' ' ORDER BY t2.start_time)
    FROM transcripts t2
    WHERE t2.video_id = t.video_id
      AND t2.start_time BETWEEN
        COALESCE(
          (SELECT start_time FROM transcripts
           WHERE video_id = t.video_id AND start_time < t.start_time
           ORDER BY start_time DESC LIMIT 1),
          t.start_time
        )
        AND
        COALESCE(
          (SELECT start_time FROM transcripts
           WHERE video_id = t.video_id AND start_time > t.start_time
           ORDER BY start_time ASC LIMIT 1),
          t.start_time
        )
  ) as search_text,
  v.youtube_video_id,
  v.title as video_title,
  v.thumbnail_url as video_thumbnail,
  v.published_at,
  v.duration_seconds as video_duration,
  c.id as channel_id,
  c.channel_handle,
  c.channel_name,
  c.thumbnail_url as channel_thumbnail,
  c.tenant_id
FROM public.transcripts t
JOIN public.videos v ON t.video_id = v.id
JOIN public.channels c ON v.channel_id = c.id
WHERE c.is_active = true
  AND v.has_quality_transcript = true;  -- ONLY include quality transcripts

COMMENT ON VIEW transcript_search_context_new IS
  'Updated view definition that only includes videos with quality transcripts (excludes music/applause-only videos). This will replace transcript_search_context after data migration.';

-- Grant access to the new view
GRANT SELECT ON transcript_search_context_new TO anon, authenticated;
