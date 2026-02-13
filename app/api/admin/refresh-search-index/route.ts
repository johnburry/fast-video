import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

const BATCH_SIZE = 20;

/**
 * Rebuild the transcript search index table in batches.
 * Each batch processes BATCH_SIZE videos at a time to avoid timeouts.
 * The endpoint loops through all batches and returns when complete.
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[SEARCH INDEX] Starting batched rebuild of transcript_search_context...');
    const startTime = Date.now();

    let offset = 0;
    let totalVideos = 0;
    let totalRowsInserted = 0;
    let batchCount = 0;
    let done = false;

    while (!done) {
      const { data, error } = await supabaseAdmin
        .rpc('populate_search_context_batch', {
          p_batch_size: BATCH_SIZE,
          p_offset: offset,
        });

      if (error) {
        console.error(`[SEARCH INDEX] Error at batch offset ${offset}:`, error);
        return NextResponse.json(
          {
            success: false,
            error: error.message,
            batchesCompleted: batchCount,
            offset,
          },
          { status: 500 }
        );
      }

      const result = data?.[0] || data;

      if (!result?.success) {
        console.error(`[SEARCH INDEX] Batch failed at offset ${offset}:`, result?.message);
        return NextResponse.json(
          {
            success: false,
            error: result?.message || 'Batch failed',
            batchesCompleted: batchCount,
            offset,
          },
          { status: 500 }
        );
      }

      totalVideos = result.total_eligible || 0;
      const videosInBatch = result.videos_in_batch || 0;
      batchCount++;

      console.log(`[SEARCH INDEX] Batch ${batchCount}: ${result.message}`);

      if (videosInBatch === 0 || videosInBatch < BATCH_SIZE) {
        done = true;
      } else {
        offset += BATCH_SIZE;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[SEARCH INDEX] Rebuild completed: ${batchCount} batches, ${totalVideos} videos in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: `Search index rebuilt: ${totalVideos} videos processed in ${batchCount} batches`,
      totalVideos,
      batchCount,
      duration,
    });
  } catch (error) {
    console.error('[SEARCH INDEX] Fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Check current state of the search index
 */
export async function GET(request: NextRequest) {
  try {
    // Count rows in the search index table
    const { count, error: countError } = await supabaseAdmin
      .from('transcript_search_context')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      return NextResponse.json(
        { error: countError.message },
        { status: 500 }
      );
    }

    // Count total eligible transcripts for comparison
    const { data: videoCount } = await supabaseAdmin
      .rpc('populate_search_context_batch', {
        p_batch_size: 0,
        p_offset: 0,
      });

    const totalEligible = videoCount?.[0]?.total_eligible || videoCount?.total_eligible || null;

    return NextResponse.json({
      indexedRows: count || 0,
      totalEligibleVideos: totalEligible,
      needsRebuild: count === 0,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
