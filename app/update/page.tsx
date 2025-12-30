'use client';

import { useState, useEffect } from 'react';

export default function UpdateChannelPage() {
  const [channelHandle, setChannelHandle] = useState('');
  const [channelName, setChannelName] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [externalLinkName, setExternalLinkName] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingChannel, setFetchingChannel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    document.title = 'Update Channel External Link';
  }, []);

  const handleFetchChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setFetchingChannel(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/update-channel?handle=${encodeURIComponent(channelHandle)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch channel');
      }

      setChannelName(data.name || '');
      setExternalLink(data.externalLink || '');
      setExternalLinkName(data.externalLinkName || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setChannelName('');
      setExternalLink('');
      setExternalLinkName('');
    } finally {
      setFetchingChannel(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/update-channel', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelHandle,
          externalLink: externalLink || null,
          externalLinkName: externalLinkName || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update channel');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Update Channel External Link
          </h1>
          <p className="text-gray-600 mb-8">
            Update the external link that videos from this channel will redirect to after playback
          </p>

          {/* Step 1: Fetch Channel */}
          <form onSubmit={handleFetchChannel} className="space-y-6 mb-8 pb-8 border-b border-gray-200">
            <div>
              <label
                htmlFor="channelHandle"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Channel Handle
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  id="channelHandle"
                  value={channelHandle}
                  onChange={(e) => setChannelHandle(e.target.value)}
                  placeholder="@channelhandle"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={fetchingChannel}
                />
                <button
                  type="submit"
                  disabled={fetchingChannel || !channelHandle}
                  className="bg-blue-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {fetchingChannel ? 'Loading...' : 'Load Channel'}
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Enter the channel handle (e.g., @mkbhd, @veritasium)
              </p>
            </div>
          </form>

          {/* Step 2: Update External Link */}
          {channelName && (
            <form onSubmit={handleUpdate} className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-blue-900 font-medium">
                  Channel: {channelName}
                </p>
                <p className="text-blue-700 text-sm mt-1">
                  Handle: {channelHandle}
                </p>
              </div>

              <div>
                <label
                  htmlFor="externalLink"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  External Link URL
                </label>
                <input
                  type="url"
                  id="externalLink"
                  value={externalLink}
                  onChange={(e) => setExternalLink(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
                <p className="mt-2 text-sm text-gray-500">
                  The URL to redirect to after video playback (leave empty to redirect to channel page)
                </p>
              </div>

              <div>
                <label
                  htmlFor="externalLinkName"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  External Link Name (Optional)
                </label>
                <input
                  type="text"
                  id="externalLinkName"
                  value={externalLinkName}
                  onChange={(e) => setExternalLinkName(e.target.value)}
                  placeholder="Visit Website"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
                <p className="mt-2 text-sm text-gray-500">
                  A friendly name for the link (e.g., &quot;Visit Website&quot;, &quot;Linktree&quot;)
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Updating...' : 'Update External Link'}
              </button>
            </form>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          )}

          {success && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-medium">Success!</p>
              <p className="text-green-600 text-sm mt-1">
                External link has been updated successfully. New videos from this channel will now redirect to{' '}
                {externalLink ? (
                  <a
                    href={externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    {externalLinkName || externalLink}
                  </a>
                ) : (
                  'the channel page'
                )}.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
