'use client';

import { useState, useEffect } from 'react';
import MuxUploader from '@mux/mux-uploader-react';
import MuxPlayer from '@mux/mux-player-react';

export default function RecordPage() {
  const [uploadId, setUploadId] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [channelId, setChannelId] = useState<string | null>(null);
  const [channelName, setChannelName] = useState<string | null>(null);

  // Detect subdomain and fetch channel info
  useEffect(() => {
    const getChannelFromSubdomain = async () => {
      try {
        const hostname = window.location.hostname;
        const parts = hostname.split('.');

        let subdomain: string | null = null;

        if (hostname.includes('localhost')) {
          if (parts.length >= 2 && parts[0] !== 'localhost') {
            subdomain = parts[0];
          }
        } else {
          if (parts.length >= 3 && parts[0] !== 'www' && parts[0] !== 'all') {
            subdomain = parts[0];
          }
        }

        if (subdomain) {
          const res = await fetch(`/api/channels/handle/${subdomain}`);
          if (res.ok) {
            const data = await res.json();
            setChannelId(data.id);
            setChannelName(data.name);
          }
        }
      } catch (e) {
        console.error('Error fetching channel from subdomain:', e);
      }
    };

    getChannelFromSubdomain();
  }, []);

  const createUpload = async () => {
    try {
      const res = await fetch('/api/mux/upload', { method: 'POST' });
      if (!res.ok) {
        throw new Error('Failed to create upload');
      }
      const { id, url } = await res.json();
      setUploadId(id);
      return url;
    } catch (e) {
      console.error('Error in createUpload', e);
      setError('Error creating upload. Please check your Mux credentials.');
      return null;
    }
  };

  const handleUploadStart = () => {
    setIsUploading(true);
    setError('');
  };

  const handleSuccess = () => {
    setIsPreparing(true);
    setIsUploading(false);
  };

  const handleError = (event: any) => {
    setIsUploading(false);
    setError(event.detail?.message || 'Upload failed');
  };

  // Poll for upload status
  useEffect(() => {
    if (!isPreparing || !uploadId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/mux/upload/${uploadId}`);
        const data = await res.json();

        if (data.playbackUrl) {
          setPlaybackUrl(data.playbackUrl);
          setIsPreparing(false);
          clearInterval(pollInterval);

          // Save video metadata to database
          const playbackId = data.playbackUrl.split('/').pop()?.replace('.m3u8', '') || '';
          const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg`;

          await fetch('/api/videos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playbackId,
              thumbnailUrl,
              channelId: channelId, // Associate with channel from subdomain
            }),
          });
        }
      } catch (e) {
        console.error('Error polling upload status:', e);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isPreparing, uploadId]);

  const getShareableUrl = () => {
    // Extract playback ID from Mux URL (e.g., https://stream.mux.com/PLAYBACK_ID.m3u8)
    const playbackId = playbackUrl.split('/').pop()?.replace('.m3u8', '') || '';
    // Get current hostname to construct the shareable URL
    const hostname = window.location.hostname;
    return `${window.location.protocol}//${hostname}/v/${playbackId}`;
  };

  const copyShareLink = () => {
    const shareUrl = getShareableUrl();
    navigator.clipboard.writeText(shareUrl);
    alert('Video link copied to clipboard!');
  };

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
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Record a Hello Video</h1>
          <p className="text-gray-400">
            Record or upload a video message for your channel visitors
          </p>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 text-white px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {!playbackUrl && !isPreparing && (
          <div className="bg-gray-900 rounded-lg p-8">
            <MuxUploader
              endpoint={createUpload}
              onUploadStart={handleUploadStart}
              onSuccess={handleSuccess}
              onUploadError={handleError}
            >
              <button slot="file-select" type="button" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors cursor-pointer">
                Record or Upload a Video
              </button>
            </MuxUploader>
            <div className="mt-4 text-center text-gray-400 text-sm">
              Record feature is only available on mobile devices.
            </div>
            {isUploading && (
              <div className="mt-4 text-center">
                <p className="text-lg">Uploading your video...</p>
              </div>
            )}
          </div>
        )}

        {isPreparing && (
          <div className="bg-gray-900 rounded-lg p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-lg">Processing your video...</p>
            <p className="text-gray-400 text-sm mt-2">This may take a minute</p>
          </div>
        )}

        {playbackUrl && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-lg overflow-hidden">
              <MuxPlayer
                playbackId={playbackUrl.split('/').pop()?.replace('.m3u8', '') || ''}
                metadata={{
                  video_title: 'Hello Video',
                }}
              />
            </div>

            <div className="text-center">
              <button
                onClick={copyShareLink}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors text-lg"
              >
                Copy Video Link for Sharing
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
