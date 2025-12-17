'use client';

import { useState, useEffect } from 'react';

interface VideoMetadata {
  playbackId: string;
  thumbnailUrl: string | null;
  channelName: string | null;
  channelHandle: string | null;
}

export default function VideoPageClient({ videoId }: { videoId: string }) {
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const fetchMetadataAndRedirect = async () => {
      try {
        const res = await fetch(`/api/videos/${videoId}`);
        if (res.ok) {
          const data = await res.json();
          setMetadata(data);

          // If we have a channel handle, redirect to the channel page with video modal
          if (data.channelHandle) {
            setRedirecting(true);
            const protocol = window.location.protocol;
            const hostname = window.location.hostname;
            const port = window.location.port ? `:${window.location.port}` : '';

            // Construct subdomain URL
            let targetUrl;
            if (hostname.includes('localhost')) {
              targetUrl = `${protocol}//${data.channelHandle}.${hostname}${port}?v=${videoId}`;
            } else {
              // For production, use subdomain
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

    fetchMetadataAndRedirect();
  }, [videoId]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        {redirecting || metadata?.channelHandle ? (
          <>
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-lg">Redirecting to channel...</p>
          </>
        ) : (
          <>
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-lg">Loading video...</p>
          </>
        )}
      </div>
    </div>
  );
}
