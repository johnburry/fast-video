import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;

    // Fetch channel name
    const { data: channel, error: channelError } = await supabaseAdmin
      .from('channels')
      .select('channel_name')
      .eq('id', channelId)
      .single();

    if (channelError || !channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    // Fetch all visitors for this channel, ordered by most recent first
    const { data: visitors, error: visitorsError } = await supabaseAdmin
      .from('channel_visitors')
      .select('id, channel_id, ip_address, user_agent, visited_at')
      .eq('channel_id', channelId)
      .order('visited_at', { ascending: false });

    if (visitorsError) {
      console.error('Error fetching visitors:', visitorsError);
      return NextResponse.json(
        { error: 'Failed to fetch visitor data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      channelName: channel.channel_name,
      visitors: visitors.map((v) => ({
        id: v.id,
        channelId: v.channel_id,
        ipAddress: v.ip_address,
        userAgent: v.user_agent,
        visitedAt: v.visited_at,
      })),
    });
  } catch (error) {
    console.error('Error in GET /api/admin/visitors/channel/[channelId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
