import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * DELETE /api/admin/channels/[id]/videos
 * Deletes all videos and related data for a channel
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: channelId } = await params;

    // Get all video IDs for this channel
    const { data: videos, error: fetchError } = await supabaseAdmin
      .from('videos')
      .select('id')
      .eq('channel_id', channelId);

    if (fetchError) {
      console.error('Error fetching videos:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch videos' },
        { status: 500 }
      );
    }

    if (!videos || videos.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No videos found for this channel',
        videosDeleted: 0,
      });
    }

    const videoIds = videos.map(v => v.id);

    // Delete related data in order (most dependent first)
    // 1. Delete video quotes
    const { error: quotesError } = await supabaseAdmin
      .from('video_quotes')
      .delete()
      .in('video_id', videoIds);

    if (quotesError) {
      console.error('Error deleting video quotes:', quotesError);
      return NextResponse.json(
        { error: 'Failed to delete video quotes' },
        { status: 500 }
      );
    }

    // 2. Delete transcripts
    const { error: transcriptsError } = await supabaseAdmin
      .from('transcripts')
      .delete()
      .in('video_id', videoIds);

    if (transcriptsError) {
      console.error('Error deleting transcripts:', transcriptsError);
      return NextResponse.json(
        { error: 'Failed to delete transcripts' },
        { status: 500 }
      );
    }

    // 3. Delete videos
    const { error: videosError } = await supabaseAdmin
      .from('videos')
      .delete()
      .in('id', videoIds);

    if (videosError) {
      console.error('Error deleting videos:', videosError);
      return NextResponse.json(
        { error: 'Failed to delete videos' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${videos.length} videos and all related data`,
      videosDeleted: videos.length,
    });
  } catch (error) {
    console.error('Error in delete videos endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
