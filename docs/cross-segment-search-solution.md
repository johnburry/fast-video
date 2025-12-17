# Cross-Segment Search Solution

## Problem
Transcript segments are stored as individual records in the database, with each record containing a portion of a sentence. When searching for phrases like "affordable house", the search may fail if:
- "affordable" is the last word in one segment
- "house" is the first word in the next segment

PostgreSQL's full-text search only searches within individual records, not across record boundaries.

## Solution: Materialized View with Context

We create a materialized view that combines each transcript segment with its adjacent segments, giving the full-text search engine the context it needs to find cross-boundary phrases.

### How It Works

1. **Materialized View (`transcript_search_context`)**:
   - For each transcript segment, combines the text from:
     - 1 segment before
     - Current segment
     - 1 segment after
   - Stores this as `search_text` column for full-text search
   - Preserves `original_text` for display purposes

2. **Full-Text Search Index**:
   - Created on the `search_text` column
   - Enables efficient searching across segment boundaries

3. **Search API Update**:
   - Queries `transcript_search_context` instead of `search_results`
   - Returns `original_text` for display (not the combined context)

## Implementation Steps

### 1. Run the Migration

Execute the migration file to create the materialized view:

```bash
# If using Supabase CLI
supabase db push

# Or run the SQL directly in Supabase Studio
# Copy contents of: supabase/migrations/add_cross_segment_search.sql
```

### 2. Initial Population

After creating the view, populate it with existing data:

```sql
refresh materialized view public.transcript_search_context;
```

### 3. Update Search Route

Replace the current search route with the updated version:

```bash
mv app/api/search/route-updated.ts app/api/search/route.ts
```

### 4. Update Transcript Import

Modify the transcript import process to refresh the materialized view after adding new transcripts:

```typescript
// After saving transcripts
await supabaseAdmin.rpc('refresh_transcript_search_context');
```

## Maintenance

### Refreshing the View

The materialized view needs to be refreshed when new transcripts are added:

**Option A: Manual Refresh** (during import)
```typescript
await supabaseAdmin.rpc('refresh_transcript_search_context');
```

**Option B: Scheduled Refresh** (periodic update)
```sql
-- Create a cron job (if using pg_cron extension)
select cron.schedule(
  'refresh-transcript-search',
  '*/30 * * * *', -- Every 30 minutes
  'refresh materialized view concurrently public.transcript_search_context'
);
```

**Option C: Trigger-Based** (real-time, but has performance impact)
```sql
-- Create a function to refresh after transcript insert/update
create or replace function refresh_search_context_trigger()
returns trigger as $$
begin
  refresh materialized view concurrently public.transcript_search_context;
  return new;
end;
$$ language plpgsql;

-- Create trigger
create trigger transcript_search_refresh
  after insert or update or delete on transcripts
  for each statement
  execute function refresh_search_context_trigger();
```

## Alternative Solutions Considered

### Option 2: Application-Level Post-Processing
**Pros**: No database changes needed
**Cons**: Slower, more complex code, doesn't scale well

```typescript
// After initial search, fetch adjacent segments and search again
// This is not recommended due to performance issues
```

### Option 3: Overlapping Text Storage
**Pros**: Real-time updates, no refresh needed
**Cons**: Data duplication, storage overhead

```typescript
// When storing transcripts, include last 5 words from previous segment
// This increases storage by ~30-50%
```

## Performance Considerations

### Index Size
- The materialized view adds ~2-3x the storage of original transcripts
- Full-text index on `search_text` adds another ~20-30% overhead
- Total additional storage: ~2.5-4x original transcript data

### Query Performance
- Searching the materialized view is **faster** than the original approach
- No need for multiple queries or post-processing
- Index-based search is highly efficient

### Refresh Performance
- Concurrent refresh: ~5-10 seconds for 100k segments
- Non-blocking: searches continue during refresh
- Can be scheduled during low-traffic periods

## Testing

Test with phrases that span boundaries:

```sql
-- Test query
select *
from transcript_search_context
where to_tsvector('english', search_text) @@ websearch_to_tsquery('english', 'affordable house')
limit 10;
```

## Monitoring

Track materialized view freshness:

```sql
-- Check last refresh time
select schemaname, matviewname, last_refresh
from pg_matviews
where matviewname = 'transcript_search_context';
```

## Rollback Plan

If issues arise, revert to original search:

```sql
-- Drop the materialized view
drop materialized view if exists public.transcript_search_context cascade;

-- Restore original search route from git
git checkout HEAD~1 -- app/api/search/route.ts
```

## Future Enhancements

1. **Configurable Context Window**
   - Allow searching with 1, 2, or 3 segments of context
   - Trade-off between accuracy and performance

2. **Highlighting Context**
   - Show which segments contain the match
   - Highlight the exact phrase across boundaries

3. **Smart Refresh**
   - Only refresh affected video segments
   - Incremental updates instead of full refresh

4. **Search Analytics**
   - Track queries that benefit from cross-segment search
   - Optimize context window based on actual usage
