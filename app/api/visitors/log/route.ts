import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { channelHandle, ipAddress, userAgent } = await request.json();

    if (!channelHandle || !ipAddress) {
      return NextResponse.json(
        { error: 'channelHandle and ipAddress are required' },
        { status: 400 }
      );
    }

    // Get channel ID from channel_handle
    const { data: channel, error: channelError } = await supabaseAdmin
      .from('channels')
      .select('id')
      .eq('channel_handle', channelHandle)
      .single();

    if (channelError || !channel) {
      console.error('Channel not found:', channelError);
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    // Insert visitor record
    const { error: insertError } = await supabaseAdmin
      .from('channel_visitors')
      .insert({
        channel_id: channel.id,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

    if (insertError) {
      console.error('Error logging visitor:', insertError);
      return NextResponse.json(
        { error: 'Failed to log visitor' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error in visitor logging:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
