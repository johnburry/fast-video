'use client';

import { use, useState, useEffect } from 'react';

interface VideoMetadata {
  playbackId: string;
  thumbnailUrl: string | null;
  channelName: string | null;
  channelHandle: string | null;
}

export default function VideoPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = use(params);
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
