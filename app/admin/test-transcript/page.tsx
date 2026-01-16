'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { AdminToolbar } from '@/components/AdminToolbar';

export default function TestTranscriptPage() {
  const { user, loading: authLoading } = useAuth();
  const [videoId, setVideoId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [preferNative, setPreferNative] = useState(false);

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setElapsedTime(0);

    const startTime = Date.now();
    let intervalId: NodeJS.Timeout;

    try {
      // Start timer
      intervalId = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100); // Update every 100ms

      const response = await fetch('/api/admin/test-transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoId, preferNative }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch transcript');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      clearInterval(intervalId!);
      const finalTime = Date.now() - startTime;
      setElapsedTime(finalTime);
      setLoading(false);
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
              Test Transcript Fetch
            </h1>
            <p className="text-gray-600 mb-8">
              Test how long Supadata API takes to fetch a transcript
            </p>

            <form onSubmit={handleTest} className="space-y-6">
              <div>
                <label
                  htmlFor="videoId"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  YouTube Video ID
                </label>
                <input
                  type="text"
                  id="videoId"
                  value={videoId}
                  onChange={(e) => setVideoId(e.target.value)}
                  placeholder="dQw4w9WgXcQ"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={loading}
                />
                <p className="mt-2 text-sm text-gray-500">
                  Enter the YouTube video ID (e.g., dQw4w9WgXcQ from https://youtube.com/watch?v=dQw4w9WgXcQ)
                </p>
              </div>

              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="preferNative"
                    type="checkbox"
                    checked={preferNative}
                    onChange={(e) => setPreferNative(e.target.checked)}
                    disabled={loading}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  />
                </div>
                <div className="ml-3">
                  <label htmlFor="preferNative" className="text-sm font-medium text-gray-700">
                    Prefer Native Captions (Live Video Mode)
                  </label>
                  <p className="text-sm text-gray-500">
                    Use 'native' mode instead of 'auto' mode (faster for videos with existing captions)
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Fetching Transcript...' : 'Test Transcript Fetch'}
              </button>
            </form>

            {loading && (
              <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-blue-800 font-medium text-2xl mb-2">
                    {(elapsedTime / 1000).toFixed(2)}s
                  </p>
                  <p className="text-blue-600 text-sm">
                    Fetching transcript from Supadata API...
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 font-medium">Error</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
                <p className="text-red-800 font-medium mt-4">Time Elapsed</p>
                <p className="text-red-600 text-sm">{(elapsedTime / 1000).toFixed(2)} seconds</p>
              </div>
            )}

            {result && (
              <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg">
                <h2 className="text-green-800 font-bold text-lg mb-4">
                  ✓ Transcript Fetched Successfully!
                </h2>
                <div className="space-y-4">
                  <div className="bg-white rounded-lg p-4 border border-green-200">
                    <p className="text-gray-700 font-semibold text-xl mb-1">
                      ⏱️ Time Elapsed
                    </p>
                    <p className="text-green-600 text-3xl font-bold">
                      {(elapsedTime / 1000).toFixed(2)} seconds
                    </p>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-green-200">
                    <p className="text-gray-700 font-semibold mb-2">
                      Transcript Info
                    </p>
                    <div className="space-y-1 text-sm">
                      <p className="text-gray-600">
                        <span className="font-medium">Video ID:</span> {result.videoId}
                      </p>
                      <p className="text-gray-600">
                        <span className="font-medium">Segments:</span> {result.segmentCount}
                      </p>
                      <p className="text-gray-600">
                        <span className="font-medium">Mode Used:</span> {preferNative ? 'native' : 'auto'}
                      </p>
                      <p className="text-gray-600">
                        <span className="font-medium">Has Content:</span> {result.hasContent ? 'Yes' : 'No'}
                      </p>
                      {result.jobId && (
                        <p className="text-gray-600">
                          <span className="font-medium">Job ID (Async):</span> {result.jobId}
                        </p>
                      )}
                    </div>
                  </div>

                  {result.segments && result.segments.length > 0 && (
                    <div className="bg-white rounded-lg p-4 border border-green-200">
                      <p className="text-gray-700 font-semibold mb-2">
                        First 5 Segments (Preview)
                      </p>
                      <div className="space-y-2 text-sm max-h-64 overflow-y-auto">
                        {result.segments.slice(0, 5).map((segment: any, index: number) => (
                          <div key={index} className="border-l-4 border-blue-500 pl-3 py-1">
                            <p className="text-blue-600 font-medium">
                              {segment.startTime.toFixed(2)}s
                            </p>
                            <p className="text-gray-700">{segment.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
