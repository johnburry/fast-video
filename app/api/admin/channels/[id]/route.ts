import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: channel, error } = await supabaseAdmin
      .from('channels')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
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
        isMusicChannel: channel.is_music_channel,
        subscriptionType: channel.subscription_type,
        subscriptionStartDate: channel.subscription_start_date,
        channelHistory: channel.channel_history,
        introVideoPlaybackId: channel.intro_video_playback_id,
        tenantId: channel.tenant_id,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/admin/channels/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const {
      name,
      shortName,
      handle,
      description,
      externalLink,
      externalLinkName,
      isActive,
      isMusicChannel,
      subscriptionType,
      subscriptionStartDate,
      channelHistory,
      tenantId
    } = body;

    // Build update object dynamically to only update provided fields
    const updateData: any = {};
    if (name !== undefined) updateData.channel_name = name;
    if (shortName !== undefined) updateData.short_name = shortName;
    if (handle !== undefined) updateData.channel_handle = handle;
    if (description !== undefined) updateData.channel_description = description;
    if (externalLink !== undefined) updateData.external_link = externalLink;
    if (externalLinkName !== undefined) updateData.external_link_name = externalLinkName;
    if (isActive !== undefined) updateData.is_active = isActive;
    if (isMusicChannel !== undefined) updateData.is_music_channel = isMusicChannel;
    if (subscriptionType !== undefined) updateData.subscription_type = subscriptionType;
    if (subscriptionStartDate !== undefined) updateData.subscription_start_date = subscriptionStartDate;
    if (channelHistory !== undefined) updateData.channel_history = channelHistory;
    if (tenantId !== undefined) updateData.tenant_id = tenantId;

    const { data, error } = await supabaseAdmin
      .from('channels')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating channel:', error);
      return NextResponse.json(
        { error: 'Failed to update channel' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, channel: data });
  } catch (error) {
    console.error('Error in PATCH /api/admin/channels/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete channel (cascade will handle videos and transcripts due to foreign key constraints)
    const { error } = await supabaseAdmin
      .from('channels')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting channel:', error);
      return NextResponse.json(
        { error: 'Failed to delete channel' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/admin/channels/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
