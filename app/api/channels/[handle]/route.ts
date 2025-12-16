import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params;

    if (!handle) {
      return NextResponse.json(
        { error: 'Channel handle is required' },
        { status: 400 }
      );
    }

    // Get channel info
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('*')
      .eq('channel_handle', handle)
      .eq('is_active', true)
      .single();

    if (channelError || !channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    // Get video count and recent videos
    const { data: videos, error: videosError } = await supabase
      .from('videos')
      .select('id, youtube_video_id, title, thumbnail_url, published_at, duration_seconds, view_count, has_transcript')
      .eq('channel_id', channel.id)
      .order('published_at', { ascending: false })
      .limit(12);

    if (videosError) {
      console.error('Error fetching videos:', videosError);
    }

    return NextResponse.json({
      channel: {
        id: channel.id,
        youtubeChannelId: channel.youtube_channel_id,
        handle: channel.channel_handle,
        name: channel.channel_name,
        description: channel.channel_description,
        thumbnail: channel.thumbnail_url,
        subscriberCount: channel.subscriber_count,
        videoCount: channel.video_count,
        lastSynced: channel.last_synced_at,
      },
      recentVideos: videos || [],
    });
  } catch (error) {
    console.error('Error fetching channel:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
