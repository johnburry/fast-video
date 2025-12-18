'use client';

import { useState, useEffect } from 'react';
import MuxUploader from '@mux/mux-uploader-react';
import MuxPlayer from '@mux/mux-player-react';
import { QRCodeSVG } from 'qrcode.react';
import Image from 'next/image';

export default function RecordPage() {
  const [uploadId, setUploadId] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [channelId, setChannelId] = useState<string | null>(null);
  const [channelName, setChannelName] = useState<string | null>(null);
  const [channelHandle, setChannelHandle] = useState<string | null>(null);
  const [recordUrl, setRecordUrl] = useState<string>('');
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [channelLoading, setChannelLoading] = useState<boolean>(true);

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
          console.log('Detected subdomain:', subdomain);
          setChannelHandle(subdomain);
          const res = await fetch(`/api/channels/handle/${subdomain}`);
          if (res.ok) {
            const data = await res.json();
            console.log('Channel found:', data);
            setChannelId(data.id);
            setChannelName(data.name);
          } else {
            console.error('Channel not found for subdomain:', subdomain, 'Status:', res.status);
          }
        } else {
          console.log('No subdomain detected');
        }
      } catch (e) {
        console.error('Error fetching channel from subdomain:', e);
      } finally {
        setChannelLoading(false);
      }
    };

    getChannelFromSubdomain();
  }, []);

  // Set the current URL for QR code and detect mobile
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRecordUrl(window.location.href);
      // Detect if device is mobile
      const checkIsMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(checkIsMobile);
    }
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

          try {
            console.log('Saving video metadata with channelId:', channelId);
            const saveRes = await fetch('/api/videos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                playbackId,
                thumbnailUrl,
                channelId: channelId, // Associate with channel from subdomain
              }),
            });

            if (!saveRes.ok) {
              const errorText = await saveRes.text();
              console.error('Failed to save video metadata:', errorText);
              setError(`Failed to save video: ${errorText}`);
            } else {
              console.log('Video metadata saved successfully');
            }
          } catch (saveError) {
            console.error('Error saving video metadata:', saveError);
            setError('Error saving video metadata');
          }
        }
      } catch (e) {
        console.error('Error polling upload status:', e);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isPreparing, uploadId, channelId]);

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
            onClick={() => {
              if (channelHandle) {
                window.location.href = `/${channelHandle}`;
              } else {
                window.history.back();
              }
            }}
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
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Image
              src="/camera.png"
              alt="Camera"
              width={80}
              height={80}
              className="w-20 h-20 flex-shrink-0"
            />
            <span className="hidden md:inline">
              Record a Fast Video
            </span>
            <span className="md:hidden inline">
              Record a<br />Fast Video
            </span>
          </h1>
          {channelName && (
            <p className="text-gray-400">
              A Fast Video recorded here, after playback will send viewers to the channel: <strong className="text-white">{channelName}</strong>
            </p>
          )}
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
              noDrop={isMobile}
            >
              {!isMobile && (
                <span slot="heading">Drop a video file here to upload, or</span>
              )}
              <button slot="file-select" type="button" className="px-6 py-3 rounded font-medium transition-colors cursor-pointer" style={{ backgroundColor: '#FF0000' }}>
                {isMobile ? 'Record or Upload Video' : 'Upload Video'}
              </button>
            </MuxUploader>
            {!isMobile && (
              <div className="mt-6 text-center">
                <p className="text-gray-300 text-base mb-4">
                  Scan QR code to use your mobile for recording a Fast Video
                </p>
                {recordUrl && (
                  <div className="inline-block p-4 bg-white rounded-lg">
                    <QRCodeSVG
                      value={recordUrl}
                      size={200}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                )}
              </div>
            )}
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
