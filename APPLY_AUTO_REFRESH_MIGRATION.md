# Apply Auto-Refresh Migration for Transcript Search

## Problem
The search uses a materialized view (`transcript_search_context`) that caches transcript data. When new videos with transcripts are imported, they don't show up in search results until the materialized view is manually refreshed.

## Solution
This migration creates an automatic trigger that refreshes the materialized view whenever new transcripts are inserted.

## How to Apply

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the contents of `supabase/migrations/20260202_auto_refresh_transcript_search.sql`
6. Click **Run** or press `Ctrl+Enter`

### Option 2: Supabase CLI

```bash
# Make sure you're logged in
npx supabase login

# Link to your project (if not already linked)
npx supabase link --project-ref your-project-ref

# Push the migration
npx supabase db push
```

### Option 3: Direct SQL Connection

If you have direct database access:

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres" \
  -f supabase/migrations/20260202_auto_refresh_transcript_search.sql
```

## Verification

After applying the migration, test it by:

1. Import a new channel or sync recent videos
2. Search for a word that appears in the newly imported transcripts
3. The new videos should appear in search results immediately

## Manual Refresh (if needed)

If you ever need to manually refresh the materialized view:

```sql
-- Option 1: Use the helper function
SELECT refresh_transcript_search_context();

-- Option 2: Direct refresh
REFRESH MATERIALIZED VIEW CONCURRENTLY public.transcript_search_context;
```

## What This Does

The migration creates:
- A trigger function `auto_refresh_transcript_search_context()` that calls the refresh
- A trigger `trigger_refresh_transcript_search_context` that fires after transcript inserts
- Uses STATEMENT-level triggering (not per-row) to avoid redundant refreshes
- Uses CONCURRENT refresh to avoid blocking ongoing searches

## Performance Notes

- The refresh happens AFTER the transaction completes (AFTER INSERT)
- CONCURRENT refresh allows searches to continue during the refresh
- The trigger is STATEMENT-level, so batch inserts only trigger one refresh
- For very large batches (1000+ segments), the refresh may take 1-2 seconds

## Immediate Fix for Current Issue

To make your existing "Lego" videos searchable right now:

```sql
SELECT refresh_transcript_search_context();
```

This will add all transcripts (including the 2/1/2026 videos) to the search index.
