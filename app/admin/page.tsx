'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { AdminToolbar } from '@/components/AdminToolbar';

export default function AdminPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [channelHandle, setChannelHandle] = useState('');
  const [importLimit, setImportLimit] = useState<number>(5000);
  const [includeLiveVideos, setIncludeLiveVideos] = useState(false);
  const [skipTranscripts, setSkipTranscripts] = useState(true);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [currentVideo, setCurrentVideo] = useState<{ current: number; total: number; title: string } | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [processingVideo, setProcessingVideo] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [processedVideos, setProcessedVideos] = useState<Set<string>>(new Set());
  useEffect(() => {
    // Set page title
    document.title = 'FV Admin: Import';

    // Fetch tenants
    if (user) {
      fetch('/api/admin/tenants')
        .then(res => res.json())
        .then(data => {
          if (data.tenants) {
            setTenants(data.tenants);
          }
        })
        .catch(err => console.error('Error fetching tenants:', err));
    }

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
  }, [channelHandle, user]);

  const handleGetPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingPreview(true);
    setError(null);
    setPreview(null);

    try {
      const response = await fetch('/api/admin/import-channel/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelHandle,
          limit: importLimit,
          includeLiveVideos,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch preview');
      }

      const data = await response.json();
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleProcessSingleVideo = async (video: any, fetchTranscript: boolean) => {
    setProcessingVideo(video.videoId);
    setProcessingStatus(fetchTranscript ? 'Importing video and fetching transcript...' : 'Importing video...');

    try {
      const response = await fetch('/api/admin/import-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelId: preview.channelId,
          video: video,
          fetchTranscript: fetchTranscript,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Mark video as processed
        setProcessedVideos((prev) => new Set(prev).add(video.videoId));

        // Update preview data to reflect changes
        if (fetchTranscript || data.transcriptFetched) {
          // Remove from video list entirely if transcript was fetched
          setPreview((prev: any) => ({
            ...prev,
            videos: prev.videos.filter((v: any) => v.videoId !== video.videoId),
            breakdown: {
              ...prev.breakdown,
              newToImport: video.status === 'needs_import' ? prev.breakdown.newToImport - 1 : prev.breakdown.newToImport,
              alreadyImported: video.status === 'needs_import' ? prev.breakdown.alreadyImported + 1 : prev.breakdown.alreadyImported,
              needsTranscripts: prev.breakdown.needsTranscripts > 0 ? prev.breakdown.needsTranscripts - 1 : 0,
              importedWithTranscripts: prev.breakdown.importedWithTranscripts + 1,
            },
          }));
        } else {
          // Update status to needs_transcript if only imported without transcript
          setPreview((prev: any) => ({
            ...prev,
            videos: prev.videos.map((v: any) =>
              v.videoId === video.videoId
                ? { ...v, status: 'needs_transcript' }
                : v
            ),
            breakdown: {
              ...prev.breakdown,
              newToImport: prev.breakdown.newToImport - 1,
              alreadyImported: prev.breakdown.alreadyImported + 1,
              needsTranscripts: prev.breakdown.needsTranscripts + 1,
            },
          }));
        }
      } else {
        setError(data.message || 'Failed to process video');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process video');
    } finally {
      setProcessingVideo(null);
      setProcessingStatus('');
    }
  };

  const handleFetchTranscript = async (video: any) => {
    setProcessingVideo(video.videoId);
    setProcessingStatus('Fetching transcript...');

    try {
      const response = await fetch('/api/admin/fetch-transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelId: preview.channelId,
          youtubeVideoId: video.videoId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Mark video as processed and remove from list
        setProcessedVideos((prev) => new Set(prev).add(video.videoId));

        setPreview((prev: any) => ({
          ...prev,
          videos: prev.videos.filter((v: any) => v.videoId !== video.videoId),
          breakdown: {
            ...prev.breakdown,
            needsTranscripts: prev.breakdown.needsTranscripts > 0 ? prev.breakdown.needsTranscripts - 1 : 0,
            importedWithTranscripts: prev.breakdown.importedWithTranscripts + 1,
          },
        }));
      } else {
        setError(data.message || 'Failed to fetch transcript');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transcript');
    } finally {
      setProcessingVideo(null);
      setProcessingStatus('');
    }
  };

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
        body: JSON.stringify({
          channelHandle,
          limit: importLimit,
          includeLiveVideos,
          skipTranscripts,
          tenantId: selectedTenantId || undefined
        }),
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
              console.log('[IMPORT STATUS]', data.message);
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

          <form onSubmit={preview ? handleImport : handleGetPreview} className="space-y-6">
            <div>
              <label
                htmlFor="tenantId"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Tenant
              </label>
              <select
                id="tenantId"
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              >
                <option value="">Auto-detect from domain</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.domain})
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm text-gray-500">
                Select which tenant this channel belongs to. Leave as "Auto-detect" to determine based on current domain.
              </p>
            </div>

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
                onChange={(e) => setImportLimit(parseInt(e.target.value) || 5000)}
                min="1"
                max="5000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={loading}
              />
              <p className="mt-2 text-sm text-gray-500">
                Maximum number of videos to import (default: 5000, max: 5000)
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

            {!preview ? (
              <button
                type="submit"
                disabled={loadingPreview}
                className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loadingPreview ? 'Loading...' : 'Get Import Preview'}
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    setError(null);
                  }}
                  disabled={loading}
                  className="flex-1 bg-gray-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  ← Back to Settings
                </button>
                <button
                  type="submit"
                  disabled={loading || (preview.breakdown.newToImport === 0 && (skipTranscripts || preview.breakdown.needsTranscripts === 0))}
                  className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Importing...' : 'Start Import'}
                </button>
              </div>
            )}
          </form>

          {/* Preview Breakdown */}
          {preview && !loading && (
            <div className="mt-8 p-6 bg-indigo-50 border border-indigo-200 rounded-lg">
              <div className="flex items-start gap-4 mb-6">
                {preview.channel.thumbnailUrl && (
                  <img
                    src={preview.channel.thumbnailUrl}
                    alt={preview.channel.name}
                    className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1">
                  <h2 className="text-indigo-900 font-bold text-xl mb-1">
                    {preview.channel.name}
                  </h2>
                  <p className="text-indigo-700 text-sm">
                    @{preview.channel.handle}
                  </p>
                  <p className="text-indigo-600 text-sm mt-1">
                    {preview.channel.subscriberCount?.toLocaleString()} subscribers
                  </p>
                </div>
              </div>

              <div className="border-t border-indigo-200 pt-4">
                <h3 className="text-indigo-900 font-semibold mb-3">Import Breakdown</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-lg border border-indigo-100">
                    <p className="text-2xl font-bold text-indigo-900">
                      {preview.breakdown.totalOnYouTube.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">Total videos on YouTube</p>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-indigo-100">
                    <p className="text-2xl font-bold text-green-700">
                      {preview.breakdown.alreadyImported.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">Already imported</p>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-indigo-100">
                    <p className="text-2xl font-bold text-blue-700">
                      {preview.breakdown.newToImport.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">New videos to import</p>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-indigo-100">
                    <p className="text-2xl font-bold text-purple-700">
                      {preview.breakdown.importedWithTranscripts.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">Imported with transcripts</p>
                  </div>
                </div>

                {preview.breakdown.newToImport === 0 && preview.breakdown.needsTranscripts === 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800 text-sm font-medium">
                      All videos have already been imported and have transcripts. Nothing to import.
                    </p>
                  </div>
                )}

                {preview.breakdown.newToImport === 0 && preview.breakdown.needsTranscripts > 0 && skipTranscripts && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-blue-800 text-sm font-medium">
                      No new videos to import, but {preview.breakdown.needsTranscripts.toLocaleString()} imported video{preview.breakdown.needsTranscripts !== 1 ? 's' : ''} need{preview.breakdown.needsTranscripts === 1 ? 's' : ''} transcripts. Uncheck "Skip Transcript Download" to download them.
                    </p>
                  </div>
                )}

                {preview.breakdown.newToImport === 0 && preview.breakdown.needsTranscripts > 0 && !skipTranscripts && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-800 text-sm font-medium">
                      No new videos to import. Will download transcripts for {preview.breakdown.needsTranscripts.toLocaleString()} existing video{preview.breakdown.needsTranscripts !== 1 ? 's' : ''}.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Video List for Manual Processing */}
          {preview && !loading && preview.videos && preview.videos.length > 0 && (
            <div className="mt-8 p-6 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="text-gray-900 font-semibold mb-4">
                Videos Needing Action ({preview.videos.length})
              </h3>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {preview.videos.map((video: any) => (
                  <div
                    key={video.videoId}
                    className="bg-white rounded-lg border border-gray-200 p-4 flex gap-4 items-start"
                  >
                    {/* Thumbnail */}
                    <div className="flex-shrink-0 w-40 h-24 bg-black rounded overflow-hidden">
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Video Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 mb-1 line-clamp-2">
                        {video.title}
                      </h4>
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                            video.status === 'needs_import'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {video.status === 'needs_import' ? 'Needs Import' : 'Needs Transcript'}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {video.status === 'needs_import' ? (
                          <>
                            <button
                              onClick={() => handleProcessSingleVideo(video, false)}
                              disabled={processingVideo === video.videoId}
                              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                            >
                              {processingVideo === video.videoId && !processingStatus.includes('transcript')
                                ? 'Importing...'
                                : 'Import'}
                            </button>
                            <button
                              onClick={() => handleProcessSingleVideo(video, true)}
                              disabled={processingVideo === video.videoId}
                              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                            >
                              {processingVideo === video.videoId && processingStatus.includes('transcript')
                                ? 'Importing...'
                                : 'Import + Get Transcript'}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleFetchTranscript(video)}
                            disabled={processingVideo === video.videoId}
                            className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                          >
                            {processingVideo === video.videoId ? 'Fetching...' : 'Get Transcript'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {/* Processing Modal */}
          {processingVideo && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing Video</h3>
                  <p className="text-gray-600 text-sm">{processingStatus}</p>
                  <p className="text-gray-500 text-xs mt-3">Please wait, this may take a minute...</p>
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
