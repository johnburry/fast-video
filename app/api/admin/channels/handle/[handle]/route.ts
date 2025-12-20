import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

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

    // Get channel info (no is_active filter for admin access)
    const { data: channel, error: channelError } = await supabaseAdmin
      .from('channels')
      .select('*')
      .eq('channel_handle', handle)
      .single();

    if (channelError || !channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    // Get all videos for the channel
    const { data: videos, error: videosError } = await supabaseAdmin
      .from('videos')
      .select('id, youtube_video_id, title, thumbnail_url, published_at, duration_seconds, view_count, has_transcript')
      .eq('channel_id', channel.id)
      .order('published_at', { ascending: false });

    if (videosError) {
      console.error('Error fetching videos:', videosError);
    }

    return NextResponse.json({
      channel: {
        id: channel.id,
        youtubeChannelId: channel.youtube_channel_id,
        handle: channel.channel_handle,
        youtubeHandle: channel.youtube_channel_handle,
        name: channel.channel_name,
        shortName: channel.short_name,
        description: channel.channel_description,
        thumbnail: channel.thumbnail_url,
        bannerUrl: channel.banner_url,
        subscriberCount: channel.subscriber_count,
        videoCount: channel.video_count,
        lastSynced: channel.last_synced_at,
        externalLink: channel.external_link,
        externalLinkName: channel.external_link_name,
        helloVideoUrl: channel.hello_video_url,
        isActive: channel.is_active,
        subscriptionType: channel.subscription_type,
        subscriptionStartDate: channel.subscription_start_date,
        channelHistory: channel.channel_history,
      },
      recentVideos: videos || [],
    });
  } catch (error) {
    console.error('Error fetching channel for admin:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
