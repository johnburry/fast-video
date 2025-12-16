import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

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
