import { Metadata } from 'next';
import VideoPageClient from './VideoPageClient';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface VideoMetadata {
  playbackId: string;
  thumbnailUrl: string | null;
  channelName: string | null;
  channelHandle: string | null;
}

async function getVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
  try {
    console.log('Fetching video metadata for playbackId:', videoId);

    const { data: video, error } = await supabase
      .from('mux_videos')
      .select('*, channels(channel_name, channel_handle)')
      .eq('mux_playback_id', videoId)
      .maybeSingle();

    if (error) {
      console.error('Database error fetching video metadata:', error);
      return null;
    }

    if (!video) {
      console.error('Video not found for playbackId:', videoId);
      return null;
    }

    const metadata = {
      playbackId: video.mux_playback_id,
      thumbnailUrl: video.thumbnail_url,
      channelName: video.channels?.channel_name || null,
      channelHandle: video.channels?.channel_handle || null,
    };

    console.log('Video metadata retrieved:', metadata);
    return metadata;
  } catch (e) {
    console.error('Error fetching video metadata for OpenGraph:', e);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ videoId: string }>;
}): Promise<Metadata> {
  const { videoId } = await params;
  const metadata = await getVideoMetadata(videoId);

  console.log('generateMetadata - videoId:', videoId);
  console.log('generateMetadata - metadata:', metadata);
  console.log('generateMetadata - channelName from API:', metadata?.channelName);

  const title = metadata?.channelName
    ? `A Fast Video from ${metadata.channelName}`
    : 'A Fast Video';

  console.log('generateMetadata - final title:', title);

  const thumbnailUrl = metadata?.thumbnailUrl || `https://image.mux.com/${videoId}/thumbnail.jpg`;

  return {
    title,
    openGraph: {
      title,
      type: 'video.other',
      images: [
        {
          url: thumbnailUrl,
          width: 1200,
          height: 675,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      images: [thumbnailUrl],
    },
  };
}

export default async function VideoPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;

  return <VideoPageClient videoId={videoId} />;
}
