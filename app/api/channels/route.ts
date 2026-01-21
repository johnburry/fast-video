import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// Sanitize handle for use as subdomain (replace invalid characters with hyphens)
function sanitizeHandleForSubdomain(handle: string): string {
  // Subdomains can only contain: a-z, 0-9, and hyphens (-)
  // Cannot start or end with hyphen, cannot have consecutive hyphens
  return handle
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-') // Replace invalid chars with hyphen
    .replace(/^-+|-+$/g, '')      // Remove leading/trailing hyphens
    .replace(/-{2,}/g, '-');       // Replace consecutive hyphens with single hyphen
}

export async function GET(request: NextRequest) {
  try {
    const { data: channels, error } = await supabaseAdmin
      .from('channels')
      .select('id, channel_handle, channel_name, channel_description, thumbnail_url, subscriber_count, video_count')
      .order('channel_name', { ascending: true });

    if (error) {
      console.error('Error fetching channels:', error);
      return NextResponse.json(
        { error: 'Failed to fetch channels' },
        { status: 500 }
      );
    }

    const formattedChannels = channels.map((channel) => ({
      id: channel.id,
      handle: channel.channel_handle,
      name: channel.channel_name,
      description: channel.channel_description,
      thumbnail: channel.thumbnail_url,
      subscriberCount: channel.subscriber_count || 0,
      videoCount: channel.video_count || 0,
    }));

    return NextResponse.json({
      channels: formattedChannels,
    });
  } catch (error) {
    console.error('Error in channels API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch channels' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      channelName,
      channelHandle,
      youtubeChannelHandle,
      description,
      thumbnailUrl,
      bannerUrl,
      subscriberCount,
      externalLink,
      externalLinkName
    } = body;

    // Validate required fields
    if (!channelName || !channelHandle) {
      return NextResponse.json(
        { error: 'Channel name and handle are required' },
        { status: 400 }
      );
    }

    // Sanitize handle for subdomain
    const sanitizedHandle = sanitizeHandleForSubdomain(channelHandle);

    // Check if channel with this handle already exists
    const { data: existingChannel } = await supabaseAdmin
      .from('channels')
      .select('id, channel_handle')
      .eq('channel_handle', sanitizedHandle)
      .single();

    if (existingChannel) {
      return NextResponse.json(
        { error: `Channel with handle "${sanitizedHandle}" already exists` },
        { status: 409 }
      );
    }

    // Create new channel
    const { data: newChannel, error: insertError } = await supabaseAdmin
      .from('channels')
      .insert({
        channel_handle: sanitizedHandle,
        youtube_channel_handle: youtubeChannelHandle || null,
        channel_name: channelName,
        channel_description: description || null,
        thumbnail_url: thumbnailUrl || null,
        banner_url: bannerUrl || null,
        subscriber_count: subscriberCount || 0,
        video_count: 0,
        external_link: externalLink || null,
        external_link_name: externalLinkName || null,
        last_synced_at: new Date().toISOString(),
      })
      .select('id, channel_handle, channel_name, channel_description, thumbnail_url, subscriber_count, video_count')
      .single();

    if (insertError) {
      console.error('Error creating channel:', insertError);
      return NextResponse.json(
        { error: 'Failed to create channel' },
        { status: 500 }
      );
    }

    // Format response
    const formattedChannel = {
      id: newChannel.id,
      handle: newChannel.channel_handle,
      name: newChannel.channel_name,
      description: newChannel.channel_description,
      thumbnail: newChannel.thumbnail_url,
      subscriberCount: newChannel.subscriber_count || 0,
      videoCount: newChannel.video_count || 0,
    };

    return NextResponse.json({
      channel: formattedChannel,
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/channels:', error);
    return NextResponse.json(
      { error: 'Failed to create channel' },
      { status: 500 }
    );
  }
}
