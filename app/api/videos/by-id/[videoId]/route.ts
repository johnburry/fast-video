import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;

    const { data: video, error } = await supabaseAdmin
      .from('videos')
      .select(`
        id,
        youtube_video_id,
        title,
        thumbnail_url,
        channel_id,
        channels!inner (
          channel_handle,
          channel_name
        )
      `)
      .eq('id', videoId)
      .single();

    if (error || !video) {
      console.error('Error fetching video:', error);
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // TypeScript workaround: channels is returned as an array by Supabase
    const channels = video.channels as any;
    const channelData = Array.isArray(channels) ? channels[0] : channels;

    return NextResponse.json({
      id: video.id,
      youtube_video_id: video.youtube_video_id,
      title: video.title,
      thumbnail_url: video.thumbnail_url,
      channel: {
        channel_handle: channelData.channel_handle,
        channel_name: channelData.channel_name,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/videos/by-id/[videoId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
