import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Refresh the transcript search index (materialized view)
 * This can be called:
 * 1. Manually via admin panel
 * 2. Automatically after transcript imports
 * 3. Via cron job
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[SEARCH INDEX] Starting refresh of transcript_search_context...');
    const startTime = Date.now();

    // Call the database function to perform the refresh
    const { data, error } = await supabaseAdmin
      .rpc('perform_transcript_search_refresh');

    const duration = Date.now() - startTime;

    if (error) {
      console.error('[SEARCH INDEX] Error refreshing:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          duration,
        },
        { status: 500 }
      );
    }

    console.log(`[SEARCH INDEX] Refresh completed successfully in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: 'Search index refreshed successfully',
      duration,
      data,
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
 * Check if refresh is needed
 */
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('transcript_search_refresh_status')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      needsRefresh: data?.needs_refresh || false,
      lastRefreshedAt: data?.last_refreshed_at || null,
      refreshInProgress: data?.refresh_in_progress || false,
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
