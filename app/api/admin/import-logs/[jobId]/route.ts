import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/admin/import-logs/[jobId]
 * Get detailed logs for an import job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    // Fetch all logs for this job, ordered by creation time
    const { data: logs, error } = await supabaseAdmin
      .from('channel_import_logs')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching import logs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch import logs' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      logs: logs || [],
    });
  } catch (error) {
    console.error('Error in import logs endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
