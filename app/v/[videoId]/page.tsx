'use client';

import { use, useState, useEffect } from 'react';
import MuxPlayer from '@mux/mux-player-react';

interface VideoMetadata {
  playbackId: string;
  thumbnailUrl: string | null;
  channelName: string | null;
}

export default function VideoPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = use(params);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const res = await fetch(`/api/videos/${videoId}`);
        if (res.ok) {
          const data = await res.json();
          setMetadata(data);
        }
      } catch (e) {
        console.error('Error fetching video metadata:', e);
      }
    };

    fetchMetadata();
  }, [videoId]);

  useEffect(() => {
    // Update page title and meta tags
    const title = metadata?.channelName
      ? `A Fast Video from ${metadata.channelName}`
      : 'A Fast Video';

    document.title = title;

    // Update or create OpenGraph meta tags
    const updateMetaTag = (property: string, content: string) => {
      let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
      }
      tag.content = content;
    };

    updateMetaTag('og:title', title);
    updateMetaTag('og:type', 'video.other');
    updateMetaTag('og:url', window.location.href);

    if (metadata?.thumbnailUrl) {
      updateMetaTag('og:image', metadata.thumbnailUrl);
      updateMetaTag('og:image:width', '1200');
      updateMetaTag('og:image:height', '675');
    }

    // Twitter Card
    const updateTwitterTag = (name: string, content: string) => {
      let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', name);
        document.head.appendChild(tag);
      }
      tag.content = content;
    };

    updateTwitterTag('twitter:card', 'summary_large_image');
    updateTwitterTag('twitter:title', title);
    if (metadata?.thumbnailUrl) {
      updateTwitterTag('twitter:image', metadata.thumbnailUrl);
    }
  }, [metadata]);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Back Button Bar */}
      <div
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 11px)',
          paddingBottom: '12px'
        }}
        className="sticky top-0 z-50 bg-black"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <MuxPlayer
            playbackId={videoId}
            metadata={{
              video_title: metadata?.channelName
                ? `A Fast Video from ${metadata.channelName}`
                : 'Video',
            }}
            streamType="on-demand"
            autoPlay
          />
        </div>
      </div>
    </div>
  );
}
