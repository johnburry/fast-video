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
        }
      } catch (e) {
        console.error('Error polling upload status:', e);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isPreparing, uploadId]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(playbackUrl);
    alert('Playback URL copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-black text-white">
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

            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Your Video is Ready!</h2>
              <p className="text-gray-400 mb-4">
                Copy this playback URL and add it to your channel settings:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={playbackUrl}
                  readOnly
                  className="flex-1 bg-gray-800 text-white px-4 py-2 rounded border border-gray-700"
                />
                <button
                  onClick={copyToClipboard}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors"
                >
                  Copy URL
                </button>
              </div>
              <div className="mt-4 p-4 bg-gray-800 rounded">
                <p className="text-sm text-gray-300 mb-2">
                  <strong>To set this as your channel's hello video:</strong>
                </p>
                <pre className="text-xs text-gray-400 overflow-x-auto">
{`UPDATE channels
SET hello_video_url = '${playbackUrl}'
WHERE channel_handle = 'your-channel-handle';`}
                </pre>
              </div>
            </div>

            <div className="text-center">
              <a
                href="/"
                className="inline-block px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded font-medium transition-colors"
              >
                Record Another Video
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
