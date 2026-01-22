'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { AdminToolbar } from '@/components/AdminToolbar';

export default function AdminPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [channelHandle, setChannelHandle] = useState('');
  const [importLimit, setImportLimit] = useState<number>(1000);
  const [includeLiveVideos, setIncludeLiveVideos] = useState(false);
  const [skipTranscripts, setSkipTranscripts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [currentVideo, setCurrentVideo] = useState<{ current: number; total: number; title: string } | null>(null);
  useEffect(() => {
    // Set page title
    document.title = 'FV Admin: Import';

    // Check for querystring parameter first
    const urlParams = new URLSearchParams(window.location.search);
    const channelParam = urlParams.get('channel');

    if (channelParam) {
      setChannelHandle(channelParam);
      return;
    }

    // Extract subdomain from hostname
    const hostname = window.location.hostname;
    const parts = hostname.split('.');

    let subdomain: string | null = null;

    if (hostname.includes('localhost')) {
      // Local development: subdomain.localhost:3000
      if (parts.length >= 2 && parts[0] !== 'localhost') {
        subdomain = parts[0];
      }
    } else {
      // Production: subdomain.fast.video
      if (parts.length >= 3 && parts[0] !== 'www') {
        subdomain = parts[0];
      }
    }

    // Prefill channel handle with subdomain if available
    if (subdomain && !channelHandle) {
      setChannelHandle(subdomain);
    }
  }, [channelHandle]);


  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setProgressStatus('');
    setCurrentVideo(null);

    try {
      const response = await fetch('/api/admin/import-channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channelHandle, limit: importLimit, includeLiveVideos, skipTranscripts }),
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            if (data.type === 'status') {
              setProgressStatus(data.message);
            } else if (data.type === 'progress') {
              setCurrentVideo({
                current: data.current,
                total: data.total,
                title: data.videoTitle,
              });
            } else if (data.type === 'complete') {
              setResult(data);
              setChannelHandle('');
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }
          } catch (parseErr) {
            console.error('Error parsing progress:', parseErr);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setProgressStatus('');
      setCurrentVideo(null);
    }
  };

  // Show loading state while checking auth or if not authenticated
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <p className="text-gray-600 text-center">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminToolbar />
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Import Channel
            </h1>
            <p className="text-gray-600 mb-8">
              Import YouTube channels and their transcripts
            </p>

          <form onSubmit={handleImport} className="space-y-6">
            <div>
              <label
                htmlFor="channelHandle"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                YouTube Channel Handle
              </label>
              <input
                type="text"
                id="channelHandle"
                value={channelHandle}
                onChange={(e) => setChannelHandle(e.target.value)}
                onBlur={(e) => setChannelHandle(e.target.value.toLowerCase())}
                placeholder="@channelhandle"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={loading}
              />
              <p className="mt-2 text-sm text-gray-500">
                Enter the channel handle (e.g., @mkbhd, @veritasium)
              </p>
            </div>

            <div>
              <label
                htmlFor="importLimit"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Import Limit
              </label>
              <input
                type="number"
                id="importLimit"
                value={importLimit}
                onChange={(e) => setImportLimit(parseInt(e.target.value) || 1000)}
                min="1"
                max="1000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={loading}
              />
              <p className="mt-2 text-sm text-gray-500">
                Maximum number of videos to import (default: 1000, max: 1000)
              </p>
            </div>

            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="includeLiveVideos"
                  type="checkbox"
                  checked={includeLiveVideos}
                  onChange={(e) => setIncludeLiveVideos(e.target.checked)}
                  disabled={loading}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
              </div>
              <div className="ml-3">
                <label htmlFor="includeLiveVideos" className="text-sm font-medium text-gray-700">
                  Include Live Videos
                </label>
                <p className="text-sm text-gray-500">
                  Import ALL YouTube live videos in addition to standard videos (processes all live videos first, then regular videos)
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="skipTranscripts"
                  type="checkbox"
                  checked={skipTranscripts}
                  onChange={(e) => setSkipTranscripts(e.target.checked)}
                  disabled={loading}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
              </div>
              <div className="ml-3">
                <label htmlFor="skipTranscripts" className="text-sm font-medium text-gray-700">
                  Skip Transcript Download (Recommended ✓)
                </label>
                <p className="text-sm text-gray-500">
                  Skip downloading transcripts during import to prevent timeouts. Import will complete in seconds instead of timing out after ~10 videos. Videos will be created without transcripts - you'll need to download transcripts separately later.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Importing...' : 'Import Channel'}
            </button>
          </form>

          {loading && (
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 font-medium mb-3">
                {progressStatus || 'Importing channel...'}
              </p>
              {currentVideo && (
                <div className="space-y-2">
                  <p className="text-blue-900 font-semibold">
                    Processing {currentVideo.current} of {currentVideo.total}
                  </p>
                  <p className="text-blue-700 text-sm">
                    {currentVideo.title}
                  </p>
                </div>
              )}
              <p className="text-blue-600 text-sm mt-3">
                Please keep this page open while the import is in progress.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-4">
                {result.channel.thumbnailUrl && (
                  <img
                    src={result.channel.thumbnailUrl}
                    alt={result.channel.name}
                    className="w-[150px] h-[150px] rounded-lg object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1">
                  <h2 className="text-green-800 font-bold text-lg mb-4">
                    Import Successful!
                  </h2>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-700">
                      <span className="font-medium">Channel:</span> {result.channel.name}
                    </p>
                    <p className="text-gray-700">
                      <span className="font-medium">Handle:</span> @{result.channel.handle}
                    </p>
                    <p className="text-gray-700">
                      <span className="font-medium">Videos Processed:</span>{' '}
                      {result.videosProcessed}
                    </p>
                    <p className="text-gray-700">
                      <span className="font-medium">Transcripts Downloaded:</span>{' '}
                      {result.transcriptsDownloaded}
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-green-200">
                    <a
                      href={`https://${result.channel.channelHandle}.playsermons.com`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View channel page →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
