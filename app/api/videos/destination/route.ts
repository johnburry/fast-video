import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { playbackId, altDestination } = await request.json();

    if (!playbackId) {
      return NextResponse.json(
        { error: 'Playback ID is required' },
        { status: 400 }
      );
    }

    // Update the alt_destination field for this video
    const { error } = await supabase
      .from('mux_videos')
      .update({ alt_destination: altDestination })
      .eq('playback_id', playbackId);

    if (error) {
      console.error('Error updating alt_destination:', error);
      return NextResponse.json(
        { error: 'Failed to update destination' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in destination API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
