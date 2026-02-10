import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getChannelVideos, getChannelLiveVideos } from '@/lib/youtube/client';

/**
 * GET /api/admin/channels/[id]/metrics
 * Get YouTube metrics for a channel
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: channelId } = await params;

    // Get channel info from database
    const { data: channel, error: channelError } = await supabaseAdmin
      .from('channels')
      .select('youtube_channel_id, channel_name')
      .eq('id', channelId)
      .single();

    if (channelError || !channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    // Fetch total videos from YouTube (both regular uploads and live streams)
    // Note: Fetch up to 10000 from each source
    const [regularVideos, liveVideos] = await Promise.all([
      getChannelVideos(channel.youtube_channel_id, 10000),
      getChannelLiveVideos(channel.youtube_channel_id, 10000),
    ]);

    const totalOnYouTube = regularVideos.length + liveVideos.length;

    console.log(`[METRICS] Fetched ${regularVideos.length} regular + ${liveVideos.length} live = ${totalOnYouTube} total videos`);

    // Get imported video stats from database
    const { data: importedVideos, error: videosError } = await supabaseAdmin
      .from('videos')
      .select('id, has_transcript, youtube_video_id')
      .eq('channel_id', channelId);

    if (videosError) {
      console.error('Error fetching imported videos:', videosError);
      return NextResponse.json(
        { error: 'Failed to fetch video stats' },
        { status: 500 }
      );
    }

    const totalImported = importedVideos?.length || 0;
    const withTranscripts = importedVideos?.filter(v => v.has_transcript).length || 0;
    const withoutTranscripts = totalImported - withTranscripts;
    const notImported = totalOnYouTube - totalImported;

    return NextResponse.json({
      channelName: channel.channel_name,
      metrics: {
        totalOnYouTube,
        totalImported,
        notImported,
        needTranscripts: withoutTranscripts,
        hasTranscripts: withTranscripts,
      },
    });
  } catch (error) {
    console.error('Error fetching channel metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
