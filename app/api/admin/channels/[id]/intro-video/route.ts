import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { playbackId } = await request.json();

    if (!playbackId) {
      return NextResponse.json(
        { error: 'playbackId is required' },
        { status: 400 }
      );
    }

    // Update channel with intro video playback ID
    const { data, error } = await supabaseAdmin
      .from('channels')
      .update({ intro_video_playback_id: playbackId })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating channel intro video:', error);
      return NextResponse.json(
        { error: 'Failed to update intro video' },
        { status: 500 }
      );
    }

    return NextResponse.json({ channel: data }, { status: 200 });
  } catch (error) {
    console.error('Error in intro video upload:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Remove intro video from channel
    const { data, error } = await supabaseAdmin
      .from('channels')
      .update({ intro_video_playback_id: null })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error removing channel intro video:', error);
      return NextResponse.json(
        { error: 'Failed to remove intro video' },
        { status: 500 }
      );
    }

    return NextResponse.json({ channel: data }, { status: 200 });
  } catch (error) {
    console.error('Error in intro video removal:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
