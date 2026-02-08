# Low-Quality Transcript Filtering - Implementation Summary

This document summarizes the complete implementation for detecting and excluding low-quality auto-generated transcripts (music/applause-only videos) from the application.

## Problem Statement

YouTube auto-generates transcripts for videos that contain only music, applause, or other non-speech content. These transcripts are not valuable for search or quote generation and should be excluded from the application.

Example low-quality transcript:
```
[Music]
Heat
[Applause]
[Music]
Heat
[Applause]
```

## Solution Overview

The solution adds quality detection during import and filters low-quality transcripts from:
1. Video labels ("Transcript Available" / "Quote Sharing Available")
2. Full-text search results
3. Semantic (vector) search results
4. Quote generation

## Database Changes

### Migration 1: Add `has_quality_transcript` Field
**File**: `/root/github/fast-video/supabase/migrations/20260208_add_has_quality_transcript.sql`

Adds a new boolean field to track transcript quality:
- `videos.has_quality_transcript` - TRUE only if transcript contains meaningful speech
- Defaults to FALSE for new videos
- Indexed for fast queries
- Existing videos are set to match their `has_transcript` value (will be revalidated on next import)

### Migration 2: Filter Search by Quality
**File**: `/root/github/fast-video/supabase/migrations/20260208_filter_search_by_quality_transcript.sql`

Updates search infrastructure to exclude low-quality transcripts:

1. **Materialized View**: Rebuilds `transcript_search_context` with quality filter
   - Only includes transcripts where `v.has_quality_transcript = true`
   - Music/applause-only videos won't appear in full-text search

2. **Semantic Search Function**: Updates `search_transcripts_semantic()`
   - Adds `v.has_quality_transcript = true` filter
   - Music/applause-only videos won't appear in semantic search

## Code Changes

### 1. Quality Detection Utility
**File**: `/root/github/fast-video/lib/transcriptQuality.ts` (NEW FILE)

Core quality validation logic:

```typescript
export function isQualityTranscript(transcripts: TranscriptSegment[]): boolean
```

**Detection Criteria**:
1. **Filler Word Percentage**: Detects music, applause, laughter, etc.
   - Dynamic threshold based on length:
     - Very short (<50 words): 30% max filler
     - Short (50-100 words): 40% max filler
     - Normal (>100 words): 50% max filler

2. **Unique Word Ratio**: Detects repetitive content
   - If <20% unique words (very repetitive) → Low quality
   - Example: "Heat Heat Heat" would fail this check

**Returns**:
- `true` = Quality transcript with meaningful speech
- `false` = Low-quality transcript (music/filler only)

### 2. Import Route Updates
**File**: `/root/github/fast-video/app/api/admin/import-channel/route.ts`

**Changes**:
- Import quality validation: `import { isQualityTranscript } from '@/lib/transcriptQuality';`
- Validate after saving transcripts (line ~607):
  ```typescript
  const hasQualityTranscript = isQualityTranscript(transcript);
  console.log(`[IMPORT] Transcript quality: ${hasQualityTranscript ? 'QUALITY' : 'LOW QUALITY'}`);
  ```
- Update video record with both flags:
  ```typescript
  .update({
    has_transcript: true,
    has_quality_transcript: hasQualityTranscript,
  })
  ```

**Applies to**:
- New video imports (full channel import)
- Transcript-only imports (videos without transcripts)

### 3. UI Updates
**File**: `/root/github/fast-video/app/[channelHandle]/page.tsx`

**Changes**:
- Line 595: Changed condition from `video.has_transcript` to `video.has_quality_transcript`
- **Effect**: "Transcript Available" and "Quote Sharing Available" labels only show for quality transcripts

### 4. Quote Generation (Already Fixed)
**File**: `/root/github/fast-video/app/api/quotes/[videoId]/route.ts`

**Existing Protection** (from previous fixes):
- Validates transcript content before sending to ChatGPT
- Skips quote generation if too much filler content
- Updated ChatGPT prompt to never hallucinate quotes
- Returns empty array for non-quotable content

## Deployment Steps

### 1. Run Database Migrations

Execute these SQL files in Supabase SQL Editor in order:

```sql
-- Migration 1: Add has_quality_transcript field
-- File: 20260208_add_has_quality_transcript.sql
ALTER TABLE videos ADD COLUMN has_quality_transcript BOOLEAN DEFAULT false;
UPDATE videos SET has_quality_transcript = has_transcript WHERE has_transcript = true;
CREATE INDEX idx_videos_has_quality_transcript ON videos(has_quality_transcript);
COMMENT ON COLUMN videos.has_quality_transcript IS 'True if transcript contains meaningful speech (not just music/applause).';
```

```sql
-- Migration 2: Filter search by quality
-- File: 20260208_filter_search_by_quality_transcript.sql
-- (Full SQL in the migration file - rebuilds materialized view and updates search function)
```

### 2. Refresh Materialized View

After running migration 2, refresh the search context:

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY public.transcript_search_context;
```

This may take a few minutes depending on database size.

### 3. Deploy Code Changes

The code changes are already in place:
- ✅ Quality detection utility (`lib/transcriptQuality.ts`)
- ✅ Import route updates (`app/api/admin/import-channel/route.ts`)
- ✅ UI label filtering (`app/[channelHandle]/page.tsx`)
- ✅ Quote generation protection (`app/api/quotes/[videoId]/route.ts`)

### 4. Re-import Channels (Optional but Recommended)

To validate existing videos with the new quality checks:
1. Go to `/admin` page
2. Use "Fetch Metadata" for each channel to re-check all videos
3. This will revalidate transcripts and update `has_quality_transcript` field

## Testing

### Test Case 1: Music Video with Low-Quality Transcript
**Video ID**: `e8698147-f884-49a1-9e01-bafc2c503343`
**Expected Behavior**:
- ❌ No "Transcript Available" label
- ❌ No "Quote Sharing Available" label
- ❌ Does not appear in search results
- ❌ No quotes generated

### Test Case 2: Real Video with Quality Transcript
**Expected Behavior**:
- ✅ Shows "Transcript Available" label
- ✅ Shows "Quote Sharing Available" label
- ✅ Appears in search results
- ✅ Generates quality quotes

### Test Case 3: Short Video with Meaningful Content
**Video ID**: `dd7c99b0-6761-4eff-bd4b-c9b7ef68a79e`
**Expected Behavior**:
- ✅ Passes quality check (uses 30% filler threshold for short transcripts)
- ✅ Shows labels
- ✅ Generates 1-3 quotes (not forced to 10)

## Console Logging

Quality validation logs will appear during import:

```
[TRANSCRIPT QUALITY] Analysis: 150 words, 80 filler (53.3%)
[TRANSCRIPT QUALITY] Unique word ratio: 15.0%
[TRANSCRIPT QUALITY] ❌ Low quality: too repetitive (15.0% unique words)
[IMPORT] Transcript quality check for VIDEO_ID: LOW QUALITY (music/filler)
```

Or for quality transcripts:

```
[TRANSCRIPT QUALITY] Analysis: 500 words, 20 filler (4.0%)
[TRANSCRIPT QUALITY] Unique word ratio: 65.0%
[TRANSCRIPT QUALITY] ✅ High quality transcript
[IMPORT] Transcript quality check for VIDEO_ID: QUALITY
```

## Benefits

1. **Cleaner Search Results**: Users only see videos with meaningful transcripts
2. **No Hallucinated Quotes**: Music videos won't generate fake quotes
3. **Better User Experience**: Labels accurately reflect transcript availability
4. **Accurate Metadata**: Database accurately tracks which videos have usable transcripts

## Future Enhancements

Potential improvements:
1. Admin page showing counts of quality vs low-quality transcripts per channel
2. Ability to manually override quality detection for edge cases
3. More sophisticated AI-based quality detection (currently rule-based)
4. Transcript quality score (0-100) instead of binary true/false

## Related Files

- `/root/github/fast-video/lib/transcriptQuality.ts` - Quality detection utility
- `/root/github/fast-video/app/api/admin/import-channel/route.ts` - Import with validation
- `/root/github/fast-video/app/[channelHandle]/page.tsx` - UI label filtering
- `/root/github/fast-video/app/api/quotes/[videoId]/route.ts` - Quote generation protection
- `/root/github/fast-video/supabase/migrations/20260208_add_has_quality_transcript.sql` - Database field
- `/root/github/fast-video/supabase/migrations/20260208_filter_search_by_quality_transcript.sql` - Search filtering
