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

The CREATE with data may timeout for very large databases. Here's the simplest approach:

**Run this single query** in Supabase SQL Editor:

```sql
-- Drop the old materialized view and its indexes
DROP MATERIALIZED VIEW IF EXISTS public.transcript_search_context CASCADE;

-- Create the new materialized view WITH data
-- This may take 1-5 minutes but should complete without timeout
CREATE MATERIALIZED VIEW public.transcript_search_context AS
SELECT * FROM transcript_search_context_new;

-- Add the unique index first (fastest to create)
CREATE UNIQUE INDEX idx_transcript_search_context_unique
  ON public.transcript_search_context (transcript_id);

-- Add other indexes
CREATE INDEX idx_transcript_search_context_video_id
  ON public.transcript_search_context(video_id);

CREATE INDEX idx_transcript_search_context_channel
  ON public.transcript_search_context(channel_handle);

CREATE INDEX idx_transcript_search_context_fts
  ON public.transcript_search_context
  USING gin(to_tsvector('english', search_text));

-- Grant access
GRANT SELECT ON public.transcript_search_context TO anon, authenticated;

-- Add comment
COMMENT ON MATERIALIZED VIEW public.transcript_search_context IS
  'Materialized view that includes surrounding segment context for each transcript entry. Only includes videos with quality transcripts (excludes music/applause-only videos). This enables full-text search to find phrases that span across segment boundaries. Refresh after adding new transcripts.';

-- Clean up the temporary view
DROP VIEW IF EXISTS transcript_search_context_new;
```

**If this times out**, see the "Alternative Approach" section below.

### Alternative Approach: If Step 2 Still Times Out

If the single-query approach times out, you'll need to use a manual INSERT approach. This bypasses the timeout by using the regular table INSERT mechanism:

#### Step 2A: Create an empty table with the same structure
```sql
-- Drop the old materialized view
DROP MATERIALIZED VIEW IF EXISTS public.transcript_search_context CASCADE;

-- Create a regular table with the same structure (instant)
CREATE TABLE public.transcript_search_context_temp AS
SELECT * FROM transcript_search_context_new
LIMIT 0;  -- No data, just structure

-- Add the unique index
CREATE UNIQUE INDEX idx_temp_unique ON transcript_search_context_temp (transcript_id);
```

#### Step 2B: Insert data in batches (run via API or background job)
Since Supabase SQL Editor has timeouts, you'll need to use one of these methods:

**Option A - Use the Supabase API from your app:**
Create a temporary API route that runs:
```typescript
const { data, error } = await supabaseAdmin
  .from('transcript_search_context_new')
  .select('*');

// Insert in batches of 1000
for (let i = 0; i < data.length; i += 1000) {
  const batch = data.slice(i, i + 1000);
  await supabaseAdmin
    .from('transcript_search_context_temp')
    .insert(batch);
}
```

**Option B - Use psql command line** (if you have database credentials):
```bash
psql "your-connection-string" -c "INSERT INTO transcript_search_context_temp SELECT * FROM transcript_search_context_new;"
```

#### Step 2C: Convert table to materialized view
```sql
-- Rename temp table to final name
ALTER TABLE transcript_search_context_temp RENAME TO transcript_search_context;

-- Convert to materialized view by creating one from the table
-- (PostgreSQL doesn't allow direct table->view conversion, so we'll keep it as a table)
-- This works fine - searches will still work

-- Add remaining indexes
CREATE INDEX idx_transcript_search_context_video_id
  ON public.transcript_search_context(video_id);

CREATE INDEX idx_transcript_search_context_channel
  ON public.transcript_search_context(channel_handle);

CREATE INDEX idx_transcript_search_context_fts
  ON public.transcript_search_context
  USING gin(to_tsvector('english', search_text));

-- Grant access
GRANT SELECT ON public.transcript_search_context TO anon, authenticated;

-- Clean up
DROP VIEW IF EXISTS transcript_search_context_new;
```

**Note**: This alternative keeps it as a regular table instead of a materialized view, which actually works fine for your use case since the data is read-only and manually refreshed anyway.

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

### Monitoring Query 2 Progress

While Query 2 (REFRESH MATERIALIZED VIEW CONCURRENTLY) is running, you can monitor progress with:

```sql
-- Check if the refresh is still running
SELECT
  pid,
  state,
  query_start,
  now() - query_start as duration,
  query
FROM pg_stat_activity
WHERE query LIKE '%transcript_search_context%'
  AND state != 'idle';

-- Check current row count (will grow as refresh progresses)
SELECT COUNT(*) FROM public.transcript_search_context;

-- Compare to expected total (from the source view)
SELECT COUNT(*) FROM transcript_search_context_new;
```

**Note**: The CONCURRENT refresh allows other queries to continue working, so your application will remain functional during the migration. Search will just return empty results until the refresh completes.

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
