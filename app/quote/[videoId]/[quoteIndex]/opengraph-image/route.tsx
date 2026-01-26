import { ImageResponse } from 'next/og';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const videoId = pathParts[2];
    const quoteIndex = parseInt(pathParts[3], 10);

    // Fetch video data
    const { data: video } = await supabaseAdmin
      .from('videos')
      .select('youtube_video_id, thumbnail_url')
      .eq('id', videoId)
      .single();

    if (!video) {
      return new Response('Video not found', { status: 404 });
    }

    // Use YouTube thumbnail
    const thumbnailUrl = video.thumbnail_url || `https://img.youtube.com/vi/${video.youtube_video_id}/maxresdefault.jpg`;

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
