import { Metadata } from 'next';
import VideoPageClient from './VideoPageClient';

interface VideoMetadata {
  playbackId: string;
  thumbnailUrl: string | null;
  channelName: string | null;
  channelHandle: string | null;
}

async function getVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const res = await fetch(`${baseUrl}/api/videos/${videoId}`, {
      cache: 'no-store',
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error('Error fetching video metadata for OpenGraph:', e);
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ videoId: string }>;
}): Promise<Metadata> {
  const { videoId } = await params;
  const metadata = await getVideoMetadata(videoId);

  const title = metadata?.channelName
    ? `A Fast Video from ${metadata.channelName}`
    : 'A Fast Video';

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
