import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET() {
  try {
    // Check if source view exists and get count
    const { count: sourceCount, error: sourceError } = await supabaseAdmin
      .from('transcript_search_context_new')
      .select('*', { count: 'exact', head: true });

    // Check if destination table exists and get count
    const { count: destCount, error: destError } = await supabaseAdmin
      .from('transcript_search_context_temp')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      source: {
        count: sourceCount || 0,
        error: sourceError?.message,
      },
      destination: {
        count: destCount || 0,
        error: destError?.message,
      },
      remaining: (sourceCount || 0) - (destCount || 0),
      percentage: sourceCount ? Math.round(((destCount || 0) / sourceCount) * 100) : 0,
    });
  } catch (error) {
    console.error('[CHECK MIGRATION] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check migration progress' },
      { status: 500 }
    );
  }
}
