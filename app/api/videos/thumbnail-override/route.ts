import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { playbackId, overrideVideoThumbnail } = await request.json();

    if (!playbackId) {
      return NextResponse.json(
        { error: 'Playback ID is required' },
        { status: 400 }
      );
    }

    // Update the override_video_thumbnail field for this video
    const { error } = await supabase
      .from('mux_videos')
      .update({ override_video_thumbnail: overrideVideoThumbnail })
      .eq('mux_playback_id', playbackId);

    if (error) {
      console.error('Error updating override_video_thumbnail:', error);
      return NextResponse.json(
        { error: 'Failed to update thumbnail override' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in thumbnail-override API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
