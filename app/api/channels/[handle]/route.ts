import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { getServerTenantConfig } from '@/lib/tenant-config';

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

    // Get tenant from hostname to validate channel belongs to this tenant
    const hostname = request.headers.get('host') || '';
    const tenantConfig = await getServerTenantConfig(hostname);

    // Get tenant_id from database
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('id')
      .eq('domain', tenantConfig.domain)
      .single();

    const tenantId = tenantData?.id;

    // If we couldn't find a tenant for this domain, return 404
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    // Get channel info with tenant validation - channel MUST belong to this tenant
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('*')
      .eq('channel_handle', handle)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (channelError || !channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    // Get all videos for the channel (Supabase has 1000 row limit, so paginate)
    let allVideos: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: pageVideos, error: videosError } = await supabase
        .from('videos')
        .select('id, youtube_video_id, title, thumbnail_url, published_at, duration_seconds, view_count, has_transcript')
        .eq('channel_id', channel.id)
        .order('published_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (videosError) {
        console.error(`Error fetching videos (page ${page}):`, videosError);
        break;
      }

      if (pageVideos && pageVideos.length > 0) {
        allVideos = allVideos.concat(pageVideos);
        hasMore = pageVideos.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    const videos = allVideos;

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
    console.error('Error fetching channel:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
