import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch all channels for this tenant
    const { data: channels, error } = await supabaseAdmin
      .from('channels')
      .select('id, channel_name, channel_handle, thumbnail_url')
      .eq('tenant_id', id)
      .order('channel_name', { ascending: true });

    if (error) {
      console.error('Error fetching tenant channels:', error);
      return NextResponse.json(
        { error: 'Failed to fetch channels' },
        { status: 500 }
      );
    }

    // Map to expected format
    const formattedChannels = channels.map((channel) => ({
      id: channel.id,
      name: channel.channel_name,
      handle: channel.channel_handle,
      thumbnail: channel.thumbnail_url,
    }));

    return NextResponse.json({ channels: formattedChannels });
  } catch (error) {
    console.error('Error in GET /api/admin/tenants/[id]/channels:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
