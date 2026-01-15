-- Enable pgvector extension for vector similarity search
create extension if not exists vector;

-- Add embedding column to transcripts table
-- Using 1536 dimensions for OpenAI text-embedding-3-small
alter table public.transcripts
add column embedding vector(1536);

-- Create index for vector similarity search using HNSW (Hierarchical Navigable Small World)
-- This index is optimized for approximate nearest neighbor search
create index on public.transcripts using hnsw (embedding vector_cosine_ops);

-- Function to search transcripts semantically using vector similarity
create or replace function search_transcripts_semantic(
  query_embedding vector(1536),
  channel_handle_filter text default null,
  match_threshold float default 0.7,
  match_count int default 50
)
returns table (
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
language plpgsql
as $$
begin
  return query
  select
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
  from public.transcripts t
  join public.videos v on t.video_id = v.id
  join public.channels c on v.channel_id = c.id
  where
    c.is_active = true
    and t.embedding is not null
    and (channel_handle_filter is null or c.channel_handle = channel_handle_filter)
    and 1 - (t.embedding <=> query_embedding) > match_threshold
  order by t.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Add comment explaining the similarity score
comment on function search_transcripts_semantic is
'Performs semantic search on transcript embeddings using cosine similarity.
Returns results with similarity score (higher is better, 1.0 = identical).
Uses <=> operator for cosine distance (1 - cosine_similarity).';
