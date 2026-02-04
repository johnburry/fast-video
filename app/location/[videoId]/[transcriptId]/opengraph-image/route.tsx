import { ImageResponse } from 'next/og';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const videoId = pathParts[2];
    const transcriptId = pathParts[3];

    // Fetch video data with channel info
    const { data: video } = await supabaseAdmin
      .from('videos')
      .select(`
        youtube_video_id,
        thumbnail_url,
        channels!inner (
          thumbnail_url
        )
      `)
      .eq('id', videoId)
      .single();

    if (!video) {
      return new Response('Video not found', { status: 404 });
    }

    // Use channel thumbnail instead of video thumbnail
    const channelData = video.channels as any;
    const thumbnailUrl = channelData?.thumbnail_url || `https://img.youtube.com/vi/${video.youtube_video_id}/maxresdefault.jpg`;

    console.log('[OG IMAGE] Location OG Image - Video ID:', videoId, 'Using thumbnail:', thumbnailUrl);

    // Fetch the thumbnail image
    const imageResponse = await fetch(thumbnailUrl);
    const imageBuffer = await imageResponse.arrayBuffer();

    return new Response(imageBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error generating OG image:', error);
    return new Response('Error generating image', { status: 500 });
  }
}
