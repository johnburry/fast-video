'use client';

import { useState, useEffect, useRef } from 'react';
import MuxPlayer from '@mux/mux-player-react';

interface VideoMetadata {
  playbackId: string;
  thumbnailUrl: string | null;
  channelName: string | null;
  channelHandle: string | null;
  altDestination: string | null;
  overrideVideoThumbnail: boolean;
  channelThumbnail: string | null;
  introVideoPlaybackId: string | null;
}

export default function VideoPageClient({ videoId }: { videoId: string }) {
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [showAudioPlayer, setShowAudioPlayer] = useState(false);
  const [showingIntro, setShowingIntro] = useState(false);
  const [currentPlaybackId, setCurrentPlaybackId] = useState<string>(videoId);
  const audioPlayerRef = useRef<any>(null);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const res = await fetch(`/api/videos/${videoId}`);
        if (res.ok) {
          const data = await res.json();
          console.log('VideoPageClient - metadata received:', {
            overrideVideoThumbnail: data.overrideVideoThumbnail,
            channelThumbnail: data.channelThumbnail,
            altDestination: data.altDestination,
            introVideoPlaybackId: data.introVideoPlaybackId,
          });
          setMetadata(data);

          // If there's an intro video, show it first
          if (data.introVideoPlaybackId) {
            setShowingIntro(true);
            setCurrentPlaybackId(data.introVideoPlaybackId);
          } else {
            setCurrentPlaybackId(videoId);
          }

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
    // If we're showing the intro video, transition to the main video
    if (showingIntro) {
      setShowingIntro(false);
      setCurrentPlaybackId(videoId);
      return;
    }

    // Otherwise, handle the main video end
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

  // Determine which poster image to use
  const posterUrl = metadata.overrideVideoThumbnail && metadata.channelThumbnail
    ? metadata.channelThumbnail
    : `https://image.mux.com/${currentPlaybackId}/thumbnail.jpg?width=1200&height=675&fit_mode=smartcrop`;

  console.log('VideoPageClient - rendering with:', {
    overrideVideoThumbnail: metadata.overrideVideoThumbnail,
    channelThumbnail: metadata.channelThumbnail,
    willShowAudioPlayer: metadata.overrideVideoThumbnail,
    willShowChannelThumbnail: metadata.overrideVideoThumbnail && metadata.channelThumbnail,
    showingIntro,
    currentPlaybackId,
  });

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      {/* Channel Thumbnail for Audio-Only (when override is true) */}
      {metadata.overrideVideoThumbnail && metadata.channelThumbnail && (
        <div className="mb-6 max-w-2xl w-full flex flex-col items-center">
          <img
            src={metadata.channelThumbnail}
            alt={metadata.channelName || 'Channel'}
            className="rounded-lg w-full"
          />
          {!showAudioPlayer && (
            <button
              onClick={() => {
                setShowAudioPlayer(true);
                // Small delay to ensure player is mounted before playing
                setTimeout(() => {
                  if (audioPlayerRef.current) {
                    audioPlayerRef.current.play();
                  }
                }, 100);
              }}
              className="mt-6 px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-full font-medium transition-colors text-lg shadow-lg"
            >
              Play Audio
            </button>
          )}
        </div>
      )}
      <div className="w-full max-w-4xl" style={{ aspectRatio: '16/9' }}>
        {metadata.overrideVideoThumbnail && !showingIntro ? (
          /* Audio Player for Audio-Only Mode */
          showAudioPlayer && (
            <div className="bg-gray-900 rounded-lg p-8 flex justify-center">
              <MuxPlayer
                ref={audioPlayerRef}
                playbackId={currentPlaybackId}
                streamType="on-demand"
                audio
                onEnded={handleVideoEnd}
                style={{ width: '100%', maxWidth: '700px' }}
              />
            </div>
          )
        ) : (
          /* Video Player for Video Mode (or Intro Video) */
          <MuxPlayer
            key={currentPlaybackId}
            playbackId={currentPlaybackId}
            streamType="on-demand"
            autoPlay
            poster={posterUrl}
            onEnded={handleVideoEnd}
            style={{ width: '100%', height: '100%', aspectRatio: '16/9' }}
          />
        )}
      </div>
    </div>
  );
}
