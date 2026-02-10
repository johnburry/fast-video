import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/admin/channels/[id]/import/status
 * Get the current import status for a channel
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: channelId } = await params;

    // Get the most recent import job for this channel
    const { data: jobs, error } = await supabaseAdmin
      .from('channel_import_jobs')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching import status:', error);
      return NextResponse.json(
        { error: 'Failed to fetch import status' },
        { status: 500 }
      );
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({
        hasJob: false,
      });
    }

    const job = jobs[0];

    return NextResponse.json({
      hasJob: true,
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        videosProcessed: job.videos_processed,
        videosTotal: job.videos_total,
        currentVideoTitle: job.current_video_title,
        transcriptsDownloaded: job.transcripts_downloaded,
        embeddingsGenerated: job.embeddings_generated,
        errorMessage: job.error_message,
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
      },
    });
  } catch (error) {
    console.error('Error in import status endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/channels/[id]/import/status
 * Cancel a running import job
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: channelId } = await params;

    // Find the running job
    const { data: jobs } = await supabaseAdmin
      .from('channel_import_jobs')
      .select('id')
      .eq('channel_id', channelId)
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (!jobs || jobs.length === 0) {
      return NextResponse.json(
        { error: 'No running import found' },
        { status: 404 }
      );
    }

    // Mark the job as failed/cancelled
    const { error } = await supabaseAdmin
      .from('channel_import_jobs')
      .update({
        status: 'failed',
        error_message: 'Cancelled by user',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobs[0].id);

    if (error) {
      console.error('Error cancelling import:', error);
      return NextResponse.json(
        { error: 'Failed to cancel import' },
        { status: 500 }
      );
    }

    // Note: Inngest jobs will continue running but won't update the database
    // We could implement proper cancellation with Inngest's cancellation API later

    return NextResponse.json({
      success: true,
      message: 'Import cancelled',
    });
  } catch (error) {
    console.error('Error in cancel import endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
