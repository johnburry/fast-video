'use client';

import { useState } from 'react';

export default function AdminPage() {
  const [channelHandle, setChannelHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/import-channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channelHandle }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import channel');
      }

      setResult(data);
      setChannelHandle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Fast.Video Admin
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
                placeholder="@channelhandle"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={loading}
              />
              <p className="mt-2 text-sm text-gray-500">
                Enter the channel handle (e.g., @mkbhd, @veritasium)
              </p>
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
              <p className="text-blue-800 font-medium">
                Importing channel... This may take several minutes depending on the number of videos.
              </p>
              <p className="text-blue-600 text-sm mt-2">
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
                      href={`https://${result.channel.handle}.fast.video`}
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

        <div className="mt-8 bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            How it works
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Enter a YouTube channel handle (e.g., @mkbhd)</li>
            <li>The system fetches all videos from the channel</li>
            <li>Transcripts are downloaded for each video</li>
            <li>All content is stored in a searchable database</li>
            <li>A custom Fast.Video page is created for the channel</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
