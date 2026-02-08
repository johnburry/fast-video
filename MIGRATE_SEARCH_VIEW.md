# Migrate Search View to Filter Low-Quality Transcripts

This guide helps you update the search materialized view without timing out.

## Problem
The original migration times out because it tries to rebuild the entire materialized view at once, which can take too long for large databases.

## Solution: Step-by-Step Migration

### Step 1: Run the Optimized Migration
Run this SQL file in Supabase SQL Editor:
**File**: `supabase/migrations/20260208_filter_search_by_quality_transcript_v5.sql`

**Note**: Use v5. V5 uses `oid::regprocedure::text` to get the correct DROP signature format.

This will:
- ✅ Drop all existing versions of the semantic search function (using corrected dynamic SQL)
- ✅ Create new version with quality transcript filter (fast, no timeout)
- ✅ Create a new regular view `transcript_search_context_new` with the quality filter
- ❌ Does NOT rebuild the materialized view yet (to avoid timeout)

### Step 2: Drop and Recreate the Materialized View

Instead of trying to refresh the existing view, we'll drop it and create a new one.

**IMPORTANT**: This will cause search to be unavailable for a few minutes while rebuilding.

Run these commands in Supabase SQL Editor:

```sql
-- Drop the old materialized view and its indexes
DROP MATERIALIZED VIEW IF EXISTS public.transcript_search_context CASCADE;

-- Create the new materialized view from our updated definition
CREATE MATERIALIZED VIEW public.transcript_search_context AS
SELECT * FROM transcript_search_context_new;

-- Recreate all indexes (this happens on the already-built view, so it's faster)
CREATE INDEX idx_transcript_search_context_fts
  ON public.transcript_search_context
  USING gin(to_tsvector('english', search_text));

CREATE INDEX idx_transcript_search_context_video_id
  ON public.transcript_search_context(video_id);

CREATE INDEX idx_transcript_search_context_channel
  ON public.transcript_search_context(channel_handle);

CREATE UNIQUE INDEX idx_transcript_search_context_unique
  ON public.transcript_search_context (transcript_id);

-- Grant access
GRANT SELECT ON public.transcript_search_context TO anon, authenticated;

-- Add comment
COMMENT ON MATERIALIZED VIEW public.transcript_search_context IS
  'Materialized view that includes surrounding segment context for each transcript entry. Only includes videos with quality transcripts (excludes music/applause-only videos). This enables full-text search to find phrases that span across segment boundaries. Refresh after adding new transcripts.';

-- Clean up the temporary view
DROP VIEW IF EXISTS transcript_search_context_new;
```

### Step 3: Verify It Worked

Check that the materialized view was created successfully:

```sql
-- Count rows in the new materialized view
SELECT COUNT(*) FROM public.transcript_search_context;

-- Check that it's only showing quality transcripts
SELECT
  COUNT(*) as total_transcripts,
  COUNT(DISTINCT video_id) as videos_with_quality_transcripts
FROM public.transcript_search_context;
```

### Alternative: If Step 2 Still Times Out

If the DROP and CREATE still times out, you can use this background approach:

```sql
-- Option A: Create with NO DATA (instant), then refresh in background
DROP MATERIALIZED VIEW IF EXISTS public.transcript_search_context CASCADE;

CREATE MATERIALIZED VIEW public.transcript_search_context AS
SELECT * FROM transcript_search_context_new
WITH NO DATA;  -- Creates structure only, no data yet

-- Add indexes before populating (can be faster)
CREATE UNIQUE INDEX idx_transcript_search_context_unique
  ON public.transcript_search_context (transcript_id);

CREATE INDEX idx_transcript_search_context_video_id
  ON public.transcript_search_context(video_id);

CREATE INDEX idx_transcript_search_context_channel
  ON public.transcript_search_context(channel_handle);

-- Now populate it (this might still take time, but won't timeout the SQL editor)
-- Run this as a separate query:
REFRESH MATERIALIZED VIEW CONCURRENTLY public.transcript_search_context;

-- Add the full-text search index after data is populated
-- Run this as another separate query:
CREATE INDEX idx_transcript_search_context_fts
  ON public.transcript_search_context
  USING gin(to_tsvector('english', search_text));

-- Grant access
GRANT SELECT ON public.transcript_search_context TO anon, authenticated;

-- Clean up
DROP VIEW IF EXISTS transcript_search_context_new;
```

## Why This Works

1. **Semantic search function** - Updated immediately, no data processing needed
2. **Regular view** - Just a definition, no data stored, instant
3. **Materialized view** - We recreate it from scratch instead of trying to update existing data
4. **Indexes** - Created after the data is already in place

## Monitoring Progress

If using the background refresh approach, you can check progress with:

```sql
-- Check if the refresh is still running
SELECT * FROM pg_stat_activity
WHERE query LIKE '%transcript_search_context%';

-- Check current row count (will grow as refresh progresses)
SELECT COUNT(*) FROM public.transcript_search_context;
```

## Expected Timing

- **Small DB** (<10k transcripts): 10-30 seconds
- **Medium DB** (10k-100k transcripts): 1-5 minutes
- **Large DB** (>100k transcripts): 5-15 minutes

The concurrent refresh won't block other queries, so your site will continue working during the migration.

## Rollback Plan

If something goes wrong, you can restore the old view without the quality filter:

```sql
DROP MATERIALIZED VIEW IF EXISTS public.transcript_search_context CASCADE;

CREATE MATERIALIZED VIEW public.transcript_search_context AS
SELECT
  t.id as transcript_id,
  t.video_id,
  t.text as original_text,
  t.start_time,
  t.duration,
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
WHERE c.is_active = true;
-- NOTE: No quality filter here - back to original

-- Recreate indexes...
```
