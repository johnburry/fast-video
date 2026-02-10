import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';

/**
 * POST /api/admin/channels/[id]/import
 * Triggers a background import job for a channel
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: channelId } = await params;
    const body = await request.json();
    const { limit = 50, includeLiveVideos = false, skipTranscripts = false } = body;

    // Get channel info
    const { data: channel, error: channelError } = await supabaseAdmin
      .from('channels')
      .select('youtube_channel_handle, tenant_id')
      .eq('id', channelId)
      .single();

    if (channelError || !channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    // Check if there's already a running import for this channel
    const { data: existingJobs } = await supabaseAdmin
      .from('channel_import_jobs')
      .select('id, status')
      .eq('channel_id', channelId)
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (existingJobs && existingJobs.length > 0) {
      return NextResponse.json(
        {
          error: 'Import already in progress for this channel',
          jobId: existingJobs[0].id,
        },
        { status: 409 }
      );
    }

    // Create a new import job record
    const { data: job, error: jobError } = await supabaseAdmin
      .from('channel_import_jobs')
      .insert({
        channel_id: channelId,
        status: 'pending',
        video_limit: limit,
        include_live_videos: includeLiveVideos,
        skip_transcripts: skipTranscripts,
        progress: { message: 'Initializing...' },
      })
      .select('id')
      .single();

    if (jobError || !job) {
      console.error('Error creating import job:', jobError);
      return NextResponse.json(
        { error: 'Failed to create import job' },
        { status: 500 }
      );
    }

    // Send event to Inngest to start the background job
    await inngest.send({
      name: 'channel/import.requested',
      data: {
        jobId: job.id,
        channelHandle: channel.youtube_channel_handle,
        limit,
        includeLiveVideos,
        skipTranscripts,
        tenantId: channel.tenant_id,
      },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Import started in background',
    });
  } catch (error) {
    console.error('Error starting import:', error);
    return NextResponse.json(
      { error: 'Failed to start import' },
      { status: 500 }
    );
  }
}
