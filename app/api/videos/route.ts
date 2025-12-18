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

    const { data, error } = await supabase
      .from('mux_videos')
      .insert({
        mux_playback_id: playbackId,
        channel_id: channelId || null,
        thumbnail_url: thumbnailUrl || null,
        alt_destination: altDestination || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting video:', error);
      return NextResponse.json(
        { error: 'Failed to save video metadata' },
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
