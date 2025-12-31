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
      .from('mux_videos')
      .select('*, channels(channel_name, channel_handle, thumbnail_url, external_link, external_link_name)')
      .eq('mux_playback_id', playbackId)
      .maybeSingle();

    if (videoError) {
      console.error('Database error fetching video:', videoError);
      return NextResponse.json(
        { error: 'Database error', details: videoError.message },
        { status: 500 }
      );
    }

    if (!video) {
      console.error('Video not found for playback ID:', playbackId);
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    const response = {
      playbackId: video.mux_playback_id,
      thumbnailUrl: video.thumbnail_url,
      channelName: video.channels?.channel_name || null,
      channelHandle: video.channels?.channel_handle || null,
      altDestination: video.alt_destination || null,
      overrideVideoThumbnail: video.override_video_thumbnail || false,
      channelThumbnail: video.channels?.thumbnail_url || null,
      externalLink: video.channels?.external_link || null,
      externalLinkName: video.channels?.external_link_name || null,
      createdAt: video.created_at,
    };

    console.log('API /api/videos/[playbackId] response:', {
      playbackId,
      overrideVideoThumbnail: response.overrideVideoThumbnail,
      channelThumbnail: response.channelThumbnail,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in GET /api/videos/[playbackId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
