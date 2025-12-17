import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playbackId: string }> }
) {
  try {
    const { playbackId } = await params;

    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*, channels(name, channel_handle)')
      .eq('playback_id', playbackId)
      .single();

    if (videoError || !video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      playbackId: video.playback_id,
      thumbnailUrl: video.thumbnail_url,
      channelName: video.channels?.name || null,
      channelHandle: video.channels?.channel_handle || null,
      createdAt: video.created_at,
    });
  } catch (error) {
    console.error('Error in GET /api/videos/[playbackId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
