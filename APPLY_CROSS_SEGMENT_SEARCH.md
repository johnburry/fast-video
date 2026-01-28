# Apply Cross-Segment Search Migration

This document explains how to apply the cross-segment search migration to enable finding phrases that span across transcript segments.

## Problem
When searching for phrases like "a generation trained to chase comfort" that span multiple transcript segments, the search fails because it only searches within individual segments.

## Solution
The migration `supabase/migrations/add_cross_segment_search.sql` creates:
1. A materialized view `transcript_search_context` that combines each segment with adjacent segments
2. A full-text search index on the combined text
3. A function to refresh the materialized view when new transcripts are added

## Steps to Apply

### Option 1: Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/migrations/add_cross_segment_search.sql`
4. Execute the SQL

### Option 2: Using Supabase CLI
```bash
# Make sure you're in the project directory
cd /root/github/fast-video

# Run the migration
supabase db push

# Or apply the specific migration file
psql $DATABASE_URL -f supabase/migrations/add_cross_segment_search.sql
```

### Option 3: Direct SQL (if you have database access)
```bash
# Connect to your database and run:
psql $DATABASE_URL -f supabase/migrations/add_cross_segment_search.sql
```

## After Applying the Migration

### Initial Setup
After applying the migration, you need to populate the materialized view:
```sql
REFRESH MATERIALIZED VIEW public.transcript_search_context;
```

### Ongoing Maintenance
Whenever you add new transcripts, refresh the materialized view:
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY public.transcript_search_context;
```

Or call the convenience function:
```sql
SELECT refresh_transcript_search_context();
```

### Automating the Refresh
You can automate the refresh by:
1. Adding it to your transcript import process
2. Setting up a periodic cron job
3. Creating a database trigger (though this may impact performance)

## Code Changes
The search route has been updated to use `transcript_search_context` instead of `search_results`:
- File: `app/api/search/route.ts`
- Changed: `.from('search_results')` → `.from('transcript_search_context')`
- Changed: `.textSearch('text', query, ...)` → `.textSearch('search_text', query, ...)`

## Testing
After applying the migration and refreshing the view, test with the example:
- Search for: "a generation trained to chase comfort"
- Expected: Should find the segment even though it spans:
  - Segment 1: "destiny for dopamine. A generation"
  - Segment 2: "trained to chase comfort will never"
