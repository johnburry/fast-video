'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { AdminToolbar } from '@/components/AdminToolbar';

export default function DeleteVideoPage() {
  const { user, loading: authLoading } = useAuth();
  const [youtubeVideoId, setYoutubeVideoId] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    videoTitle?: string;
    deleted?: string[];
    error?: string;
  } | null>(null);

  // Extract YouTube video ID from a URL or raw ID
  const extractVideoId = (input: string): string => {
    const trimmed = input.trim();
    // Match youtube.com/watch?v=ID or youtu.be/ID
    const urlMatch = trimmed.match(
      /(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([\w-]+)/
    );
    return urlMatch ? urlMatch[1] : trimmed;
  };

  const handleDelete = async () => {
    const videoId = extractVideoId(youtubeVideoId);
    if (!videoId) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete the video with YouTube ID "${videoId}" and all its transcripts?`
    );
    if (!confirmed) return;

    setDeleting(true);
    setResult(null);

    try {
      const res = await fetch('/api/admin/delete-video', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeVideoId: videoId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({ success: false, error: data.error });
      } else {
        setResult({
          success: true,
          videoTitle: data.videoTitle,
          deleted: data.deleted,
        });
        setYoutubeVideoId('');
      }
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <p className="text-gray-600 text-center">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminToolbar />
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Delete Video
            </h1>
            <p className="text-gray-600 mb-8">
              Delete a video and all its associated data (transcripts, search index entries, embeddings) by YouTube video ID.
            </p>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="youtubeVideoId"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  YouTube Video ID or URL
                </label>
                <input
                  id="youtubeVideoId"
                  type="text"
                  value={youtubeVideoId}
                  onChange={(e) => setYoutubeVideoId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !deleting && youtubeVideoId.trim()) {
                      handleDelete();
                    }
                  }}
                  placeholder="e.g. dQw4w9WgXcQ or https://youtube.com/watch?v=dQw4w9WgXcQ"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900"
                  disabled={deleting}
                />
              </div>

              <button
                onClick={handleDelete}
                disabled={deleting || !youtubeVideoId.trim()}
                className={`px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
                  deleting || !youtubeVideoId.trim()
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {deleting ? 'Deleting...' : 'Delete Video'}
              </button>
            </div>

            {result && (
              <div
                className={`mt-6 p-4 rounded-lg border ${
                  result.success
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                {result.success ? (
                  <div>
                    <p className="font-medium text-green-800">
                      Successfully deleted: {result.videoTitle}
                    </p>
                    {result.deleted && (
                      <ul className="mt-2 text-sm text-green-700 list-disc list-inside">
                        {result.deleted.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <p className="font-medium text-red-800">{result.error}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
