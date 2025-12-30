import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { playbackId, channelId, thumbnailUrl, altDestination } = await request.json();

    console.log('Saving video with:', { playbackId, channelId, thumbnailUrl, altDestination });

    if (!playbackId) {
      return NextResponse.json(
        { error: 'playbackId is required' },
        { status: 400 }
      );
    }

    if (!channelId) {
      console.warn('WARNING: Saving video without channelId!');
    }

    // If channelId is provided and no altDestination is specified, fetch the channel's external_link
    let finalAltDestination = altDestination || null;

    if (channelId && !altDestination) {
      const { data: channelData } = await supabase
        .from('channels')
        .select('external_link')
        .eq('id', channelId)
        .single();

      if (channelData?.external_link) {
        finalAltDestination = channelData.external_link;
        console.log('Using channel external_link as alt_destination:', finalAltDestination);
      }
    }

    const { data, error } = await supabase
      .from('mux_videos')
      .insert({
        mux_playback_id: playbackId,
        channel_id: channelId || null,
        thumbnail_url: thumbnailUrl || null,
        alt_destination: finalAltDestination,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting video:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return NextResponse.json(
        { error: 'Failed to save video metadata', details: error.message },
        { status: 500 }
      );
    }

    console.log('Video saved successfully:', data);
    return NextResponse.json({ success: true, video: data });
  } catch (error) {
    console.error('Error in POST /api/videos:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
