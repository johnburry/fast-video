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
  channelShortName: string | null;
  channelHandle: string | null;
  overrideVideoThumbnail: boolean;
  channelThumbnail: string | null;
}

async function getVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
  try {
    console.log('Fetching video metadata for playbackId:', videoId);

    const { data: video, error } = await supabase
      .from('mux_videos')
      .select('*, channels(channel_name, short_name, channel_handle, thumbnail_url)')
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
      channelShortName: video.channels?.short_name || null,
      channelHandle: video.channels?.channel_handle || null,
      overrideVideoThumbnail: video.override_video_thumbnail || false,
      channelThumbnail: video.channels?.thumbnail_url || null,
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
  console.log('generateMetadata - channelShortName from API:', metadata?.channelShortName);

  // Use short_name if available, otherwise fall back to channel_name
  const displayName = metadata?.channelShortName || metadata?.channelName;

  // Use "A Fast Audio" for audio-only recordings (when override is true)
  const contentType = metadata?.overrideVideoThumbnail ? 'Audio' : 'Video';
  const title = displayName
    ? `A Fast ${contentType} from ${displayName}`
    : `A Fast ${contentType}`;

  console.log('generateMetadata - final title:', title);

  // Use channel thumbnail if override is true, otherwise use video thumbnail
  let thumbnailUrl = `https://image.mux.com/${videoId}/thumbnail.jpg`;

  if (metadata?.overrideVideoThumbnail && metadata?.channelThumbnail) {
    // Use channel thumbnail for audio-only
    thumbnailUrl = metadata.channelThumbnail;
  } else if (metadata?.thumbnailUrl) {
    // Use video's custom thumbnail if set
    thumbnailUrl = metadata.thumbnailUrl;
  }

  // Ensure absolute URL for OpenGraph
  if (!thumbnailUrl.startsWith('http://') && !thumbnailUrl.startsWith('https://')) {
    thumbnailUrl = `https://fast.video${thumbnailUrl.startsWith('/') ? '' : '/'}${thumbnailUrl}`;
  }

  console.log('generateMetadata - thumbnailUrl for OpenGraph:', thumbnailUrl);
  console.log('generateMetadata - overrideVideoThumbnail:', metadata?.overrideVideoThumbnail);
  console.log('generateMetadata - channelThumbnail:', metadata?.channelThumbnail);

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
