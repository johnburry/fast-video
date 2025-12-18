'use client';

import { useState, useEffect } from 'react';
import MuxPlayer from '@mux/mux-player-react';

interface VideoMetadata {
  playbackId: string;
  thumbnailUrl: string | null;
  channelName: string | null;
  channelHandle: string | null;
  altDestination: string | null;
}

export default function VideoPageClient({ videoId }: { videoId: string }) {
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const res = await fetch(`/api/videos/${videoId}`);
        if (res.ok) {
          const data = await res.json();
          setMetadata(data);

          // If there's NO alt_destination (regular Fast Video), redirect immediately to channel page
          if (!data.altDestination && data.channelHandle) {
            setRedirecting(true);
            const protocol = window.location.protocol;
            const hostname = window.location.hostname;
            const port = window.location.port ? `:${window.location.port}` : '';

            let targetUrl;
            if (hostname.includes('localhost')) {
              targetUrl = `${protocol}//${data.channelHandle}.${hostname}${port}?v=${videoId}`;
            } else {
              const baseDomain = hostname.split('.').slice(-2).join('.'); // e.g., "fast.video"
              targetUrl = `${protocol}//${data.channelHandle}.${baseDomain}?v=${videoId}`;
            }

            window.location.href = targetUrl;
          }
        }
      } catch (e) {
        console.error('Error fetching video metadata:', e);
      }
    };

    fetchMetadata();
  }, [videoId]);

  const handleVideoEnd = () => {
    setRedirecting(true);

    if (metadata?.altDestination) {
      // Redirect to alternative destination
      window.location.href = metadata.altDestination;
    } else if (metadata?.channelHandle) {
      // Redirect to channel page with video modal
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const port = window.location.port ? `:${window.location.port}` : '';

      let targetUrl;
      if (hostname.includes('localhost')) {
        targetUrl = `${protocol}//${metadata.channelHandle}.${hostname}${port}?v=${videoId}`;
      } else {
        const baseDomain = hostname.split('.').slice(-2).join('.'); // e.g., "fast.video"
        targetUrl = `${protocol}//${metadata.channelHandle}.${baseDomain}?v=${videoId}`;
      }

      window.location.href = targetUrl;
    }
  };

  if (!metadata) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-lg">Loading video...</p>
        </div>
      </div>
    );
  }

  if (redirecting) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-lg">Loading Fast Video...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <MuxPlayer
        playbackId={videoId}
        streamType="on-demand"
        autoPlay
        onEnded={handleVideoEnd}
        style={{ width: '100%', height: '100vh' }}
      />
    </div>
  );
}
