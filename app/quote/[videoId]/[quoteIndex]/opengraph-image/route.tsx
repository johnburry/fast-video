import { ImageResponse } from 'next/og';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const videoId = pathParts[2];
    const quoteIndex = parseInt(pathParts[3], 10);

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

    // Use video thumbnail for link preview
    const thumbnailUrl = video.thumbnail_url || `https://img.youtube.com/vi/${video.youtube_video_id}/maxresdefault.jpg`;

    console.log('[OG IMAGE] Quote OG Image - Video ID:', videoId, 'Using thumbnail:', thumbnailUrl);

    // Fetch the thumbnail image
    const imageResponse = await fetch(thumbnailUrl);
    const imageBuffer = await imageResponse.arrayBuffer();

    return new Response(imageBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        // Use shorter cache to allow updates, but still cache for performance
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    });
  } catch (error) {
    console.error('Error generating OG image:', error);
    return new Response('Error generating image', { status: 500 });
  }
}
