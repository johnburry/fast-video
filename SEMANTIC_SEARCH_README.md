# PlaySermons Semantic Search

This document explains how to set up and use the AI-powered semantic search feature for PlaySermons.

## Overview

PlaySermons now supports **semantic search** powered by OpenAI embeddings. This allows users to search for sermons using natural language and find results based on meaning and context, not just exact keyword matches.

### What is Semantic Search?

Traditional keyword search looks for exact words. Semantic search understands **intent and context**:

- ❌ **Keyword**: Searching "grace" only finds sermons with the exact word "grace"
- ✅ **Semantic**: Searching "unmerited favor" also finds sermons about grace, mercy, and God's love

### Benefits for Church Sermons

1. **Bible Verse Understanding**: Search "John 3:16" and find all references, even if the pastor said "John chapter three verse sixteen"
2. **Topic Discovery**: Search "dealing with anxiety" and find sermons about peace, worry, trust, and faith
3. **Concept Matching**: Search "salvation" and find sermons about redemption, born again, saved by grace, etc.
4. **Natural Language**: Ask "how to forgive someone who hurt me" instead of just "forgiveness"

## Setup Instructions

### 1. Database Migration

Run the migration to add vector support to your Supabase database:

```bash
# Apply the migration
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/20260115_add_semantic_search.sql
```

Or in Supabase Dashboard:
1. Go to SQL Editor
2. Paste the contents of `supabase/migrations/20260115_add_semantic_search.sql`
3. Run the query

This will:
- Enable the `pgvector` extension
- Add an `embedding` column to the `transcripts` table
- Create a vector similarity index (HNSW)
- Add a `search_transcripts_semantic()` function

### 2. Environment Variables

Add your OpenAI API key to `.env.local`:

```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
```

Get your API key from: https://platform.openai.com/api-keys

### 3. Install Dependencies

The semantic search requires the OpenAI SDK:

```bash
npm install openai
```

### 4. Generate Embeddings

After importing a channel's transcripts, generate embeddings for semantic search.

#### Option A: Admin UI (Coming Soon)

The admin interface will have a "Generate Embeddings" button for each channel.

#### Option B: API Call

```bash
# Generate embeddings for a specific video
curl -X POST http://localhost:3000/api/embeddings/generate \
  -H "Content-Type: application/json" \
  -d '{"videoId": "your-video-uuid"}'

# Check embedding status
curl http://localhost:3000/api/embeddings/generate?videoId=your-video-uuid
```

#### Option C: Batch Script

Create a script to generate embeddings for all videos in a channel:

```typescript
// scripts/generate-embeddings.ts
const channelId = 'your-channel-id';

// Get all videos for the channel
const { data: videos } = await supabase
  .from('videos')
  .select('id')
  .eq('channel_id', channelId);

// Generate embeddings for each video
for (const video of videos) {
  await fetch('/api/embeddings/generate', {
    method: 'POST',
    body: JSON.stringify({ videoId: video.id }),
  });
}
```

## API Endpoints

### 1. Semantic Search

**Endpoint**: `GET /api/search/semantic`

**Parameters**:
- `q` (required): Search query
- `channel` (optional): Filter by channel handle
- `limit` (optional, default: 50): Max results
- `threshold` (optional, default: 0.7): Minimum similarity score (0-1)

**Example**:
```bash
curl "http://localhost:3000/api/search/semantic?q=dealing%20with%20fear&channel=mychurch"
```

**Response**:
```json
{
  "query": "dealing with fear",
  "results": [
    {
      "videoId": "uuid",
      "youtubeVideoId": "abc123",
      "title": "Peace in Troubled Times",
      "matches": [
        {
          "text": "When we face uncertainty and anxiety...",
          "startTime": 1234.5,
          "similarity": 0.89
        }
      ],
      "avgSimilarity": 0.87
    }
  ],
  "searchType": "semantic"
}
```

### 2. Hybrid Search (Recommended)

**Endpoint**: `GET /api/search/hybrid`

Combines keyword and semantic search for best results.

**Parameters**: Same as semantic search

**Example**:
```bash
curl "http://localhost:3000/api/search/hybrid?q=faith&channel=mychurch"
```

### 3. Generate Embeddings

**Endpoint**: `POST /api/embeddings/generate`

**Body**:
```json
{
  "videoId": "video-uuid",
  "batchSize": 50
}
```

**Response**:
```json
{
  "message": "Successfully generated embeddings for 45 transcripts",
  "processed": 45,
  "total": 45
}
```

### 4. Check Embedding Status

**Endpoint**: `GET /api/embeddings/generate?videoId=uuid`

**Response**:
```json
{
  "total": 150,
  "withEmbeddings": 145,
  "withoutEmbeddings": 5,
  "progress": 96.67
}
```

## How It Works

### 1. Embedding Generation

When transcripts are imported, each segment is converted to a 1536-dimensional vector using OpenAI's `text-embedding-3-small` model:

```
"For God so loved the world..." → [0.023, -0.156, 0.089, ...]
```

These vectors capture the semantic meaning of the text.

### 2. Search Query

When a user searches, their query is also converted to a vector:

```
"God's love for humanity" → [0.019, -0.143, 0.091, ...]
```

### 3. Similarity Matching

The database uses cosine similarity to find transcript segments with similar meaning:

```sql
SELECT * FROM transcripts
WHERE 1 - (embedding <=> query_embedding) > 0.7
ORDER BY embedding <=> query_embedding
LIMIT 50;
```

Results are ranked by similarity score (0-1, where 1 is identical).

### 4. Hybrid Approach

The hybrid search endpoint combines:
- **50% keyword matching**: Fast, exact term matches
- **50% semantic matching**: Context-aware, conceptual matches

This provides the best of both worlds for sermon discovery.

## Cost Considerations

### OpenAI Pricing

- **Embedding Model**: text-embedding-3-small
- **Cost**: ~$0.02 per 1 million tokens
- **Estimate**: ~100 tokens per transcript segment

**Example**: A 30-minute sermon with 300 transcript segments:
- Tokens: 300 segments × 100 tokens = 30,000 tokens
- Cost: $0.0006 (less than a penny)

**For 1000 sermons**:
- Total cost: ~$0.60

### Optimization Tips

1. **Generate embeddings once**: Embeddings are stored in the database
2. **Batch processing**: Generate embeddings for multiple transcripts in one request
3. **Reuse embeddings**: Search queries are cheap (no storage needed)

## Performance

### Search Speed

- **Keyword search**: ~50-100ms
- **Semantic search**: ~200-300ms (including OpenAI API call)
- **Hybrid search**: ~300-400ms (parallel execution)

### Database Index

The HNSW (Hierarchical Navigable Small World) index provides:
- Fast approximate nearest neighbor search
- Sub-linear search time (O(log n))
- High recall (>95%) with proper parameters

## Troubleshooting

### "Extension vector does not exist"

Run the migration to enable pgvector:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### "OpenAI API key not found"

Add `OPENAI_API_KEY` to your `.env.local` file.

### "Embedding column is null"

Generate embeddings first using `/api/embeddings/generate`.

### Low similarity scores

Try lowering the threshold parameter:
```
/api/search/semantic?q=faith&threshold=0.5
```

## Future Enhancements

1. **Auto-generate embeddings**: Automatically create embeddings during import
2. **Admin dashboard**: UI for monitoring embedding progress
3. **Fine-tuned models**: Custom embeddings trained on sermon content
4. **Multi-language support**: Embeddings for non-English sermons
5. **Caching**: Cache popular search query embeddings

## Resources

- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Supabase Vector Search](https://supabase.com/docs/guides/ai/vector-indexes)
