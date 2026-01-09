import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // Get all channels with their visitor statistics
    const { data: channels, error: channelsError } = await supabaseAdmin
      .from('channels')
      .select('id, channel_handle, channel_name')
      .eq('is_active', true)
      .order('channel_name');

    if (channelsError) {
      console.error('Error fetching channels:', channelsError);
      return NextResponse.json(
        { error: 'Failed to fetch channels' },
        { status: 500 }
      );
    }

    // Get visitor statistics for each channel
    const statsPromises = channels.map(async (channel) => {
      // Get total page loads count
      const { count: pageLoads, error: countError } = await supabaseAdmin
        .from('channel_visitors')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', channel.id);

      if (countError) {
        console.error(`Error counting visitors for channel ${channel.id}:`, countError);
        return {
          channelId: channel.id,
          channelHandle: channel.channel_handle,
          channelName: channel.channel_name,
          pageLoads: 0,
          lastPageLoad: null,
        };
      }

      // Get last page load time
      const { data: lastVisit, error: lastVisitError } = await supabaseAdmin
        .from('channel_visitors')
        .select('visited_at')
        .eq('channel_id', channel.id)
        .order('visited_at', { ascending: false })
        .limit(1)
        .single();

      if (lastVisitError && lastVisitError.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" error, which is fine
        console.error(`Error fetching last visit for channel ${channel.id}:`, lastVisitError);
      }

      return {
        channelId: channel.id,
        channelHandle: channel.channel_handle,
        channelName: channel.channel_name,
        pageLoads: pageLoads || 0,
        lastPageLoad: lastVisit?.visited_at || null,
      };
    });

    const stats = await Promise.all(statsPromises);

    // Sort by last page load time (most recent first), with null values at the end
    stats.sort((a, b) => {
      if (a.lastPageLoad === null && b.lastPageLoad === null) return 0;
      if (a.lastPageLoad === null) return 1;
      if (b.lastPageLoad === null) return -1;
      return new Date(b.lastPageLoad).getTime() - new Date(a.lastPageLoad).getTime();
    });

    return NextResponse.json({ stats }, { status: 200 });
  } catch (error) {
    console.error('Error fetching visitor stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
