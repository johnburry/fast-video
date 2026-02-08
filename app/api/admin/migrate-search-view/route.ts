import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * API endpoint to migrate transcript_search_context data in batches
 * This solves the timeout issue when creating the materialized view
 */
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === 'get_stats') {
      // Get row counts to show progress
      const [sourceCount, destCount] = await Promise.all([
        supabaseAdmin
          .from('transcript_search_context_new')
          .select('*', { count: 'exact', head: true }),
        supabaseAdmin
          .from('transcript_search_context_temp')
          .select('*', { count: 'exact', head: true })
      ]);

      return NextResponse.json({
        source_count: sourceCount.count || 0,
        dest_count: destCount.count || 0,
        remaining: (sourceCount.count || 0) - (destCount.count || 0),
      });
    }

    if (action === 'migrate_batch') {
      const BATCH_SIZE = 500;

      console.log('[MIGRATE] Starting batch migration...');

      // Get the last transcript_id that was inserted (for cursor-based pagination)
      const { data: lastInserted } = await supabaseAdmin
        .from('transcript_search_context_temp')
        .select('transcript_id')
        .order('transcript_id', { ascending: false })
        .limit(1);

      const lastId = lastInserted?.[0]?.transcript_id;
      console.log(`[MIGRATE] Last inserted ID: ${lastId || 'none'}`);

      // Fetch next batch from source view using cursor-based pagination
      // This is much faster than offset-based pagination on large datasets
      let fetchQuery = supabaseAdmin
        .from('transcript_search_context_new')
        .select('*')
        .order('transcript_id', { ascending: true })
        .limit(BATCH_SIZE);

      // If we have a last ID, get rows after it
      if (lastId) {
        fetchQuery = fetchQuery.gt('transcript_id', lastId);
      }

      const { data: batch, error: fetchError } = await fetchQuery;

      if (fetchError) {
        console.error('[MIGRATE] Error fetching batch:', fetchError);
        return NextResponse.json({
          error: `Failed to fetch batch: ${fetchError.message}`,
          code: fetchError.code
        }, { status: 500 });
      }

      if (!batch || batch.length === 0) {
        console.log('[MIGRATE] No more rows to migrate');

        // Get final count for confirmation
        const { count: finalCount } = await supabaseAdmin
          .from('transcript_search_context_temp')
          .select('*', { count: 'exact', head: true });

        return NextResponse.json({
          completed: true,
          message: 'Migration complete!',
          rows_migrated: 0,
          total_rows: finalCount || 0,
        });
      }

      console.log(`[MIGRATE] Inserting ${batch.length} rows with ON CONFLICT handling...`);

      // Insert batch into temp table with upsert to handle duplicates
      // Using ignoreDuplicates to skip rows that already exist
      const { data: insertedData, error: insertError } = await supabaseAdmin
        .from('transcript_search_context_temp')
        .upsert(batch, {
          onConflict: 'transcript_id',
          ignoreDuplicates: true, // Skip duplicates instead of updating
        })
        .select();

      if (insertError) {
        console.error('[MIGRATE] Error inserting batch:', insertError);
        return NextResponse.json({
          error: `Failed to insert batch: ${insertError.message}`,
          code: insertError.code
        }, { status: 500 });
      }

      const actualInserted = insertedData?.length || 0;
      console.log(`[MIGRATE] Successfully inserted ${actualInserted} new rows (${batch.length - actualInserted} were duplicates)`);

      // Get updated count
      const { count: currentCount } = await supabaseAdmin
        .from('transcript_search_context_temp')
        .select('*', { count: 'exact', head: true });

      return NextResponse.json({
        completed: false,
        rows_migrated: actualInserted,
        total_migrated: currentCount || 0,
      });
    }

    if (action === 'finalize') {
      console.log('[MIGRATE] Finalizing migration...');

      return NextResponse.json({
        success: true,
        message: 'Please run the finalization SQL manually in Supabase SQL Editor. See instructions on the page.',
        sql: `
-- Step 1: Rename temp table to final name
ALTER TABLE transcript_search_context_temp RENAME TO transcript_search_context;

-- Step 2: Create indexes
CREATE UNIQUE INDEX idx_transcript_search_context_unique ON transcript_search_context (transcript_id);
CREATE INDEX idx_transcript_search_context_video_id ON transcript_search_context(video_id);
CREATE INDEX idx_transcript_search_context_channel ON transcript_search_context(channel_handle);
CREATE INDEX idx_transcript_search_context_fts ON transcript_search_context USING gin(to_tsvector('english', search_text));

-- Step 3: Grant permissions
GRANT SELECT ON transcript_search_context TO anon, authenticated;

-- Step 4: Clean up
DROP VIEW IF EXISTS transcript_search_context_new;
        `.trim(),
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[MIGRATE] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
