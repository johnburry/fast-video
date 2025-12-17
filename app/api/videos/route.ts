import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { playbackId, channelId, thumbnailUrl } = await request.json();

    if (!playbackId) {
      return NextResponse.json(
        { error: 'playbackId is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('videos')
      .insert({
        playback_id: playbackId,
        channel_id: channelId || null,
        thumbnail_url: thumbnailUrl || null,
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

    return NextResponse.json({ success: true, video: data });
  } catch (error) {
    console.error('Error in POST /api/videos:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
