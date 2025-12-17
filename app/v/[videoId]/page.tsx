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
    // Construct the base URL for server-side API calls
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'http://localhost:3000';

    const apiUrl = `${baseUrl}/api/videos/${videoId}`;
    console.log('Fetching video metadata from:', apiUrl);

    const res = await fetch(apiUrl, {
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      console.log('Video metadata received:', data);
      return data;
    } else {
      console.error('Failed to fetch video metadata:', res.status, res.statusText);
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

  console.log('generateMetadata - videoId:', videoId);
  console.log('generateMetadata - metadata:', metadata);
  console.log('generateMetadata - channelName:', metadata?.channelName);

  // Clean the channel name - remove "Fast Video Transcript Search" and similar unwanted text
  let channelName = metadata?.channelName;
  if (channelName) {
    // Remove common unwanted suffixes/prefixes
    channelName = channelName
      .replace(/\s*Fast Video Transcript Search\s*/gi, '')
      .replace(/\s*-\s*Fast Video Transcript Search\s*/gi, '')
      .replace(/\s*\|\s*Fast Video Transcript Search\s*/gi, '')
      .trim();
  }

  const title = channelName
    ? `A Fast Video from ${channelName}`
    : 'A Fast Video';

  console.log('generateMetadata - cleaned channelName:', channelName);
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
