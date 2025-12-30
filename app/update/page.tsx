'use client';

import { useState, useEffect } from 'react';

export default function UpdateChannelPage() {
  const [channelHandle, setChannelHandle] = useState('');
  const [channelName, setChannelName] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [externalLinkName, setExternalLinkName] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingChannel, setFetchingChannel] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    document.title = 'Update Channel External Link';

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

    if (!subdomain) {
      setError('This page must be accessed from a channel subdomain (e.g., channelhandle.fast.video/update)');
      setFetchingChannel(false);
      return;
    }

    setChannelHandle(subdomain);

    // Fetch channel data
    const fetchChannel = async () => {
      try {
        const response = await fetch(`/api/update-channel?handle=${encodeURIComponent(subdomain)}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch channel');
        }

        setChannelName(data.name || '');
        setExternalLink(data.externalLink || '');
        setExternalLinkName(data.externalLinkName || '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setFetchingChannel(false);
      }
    };

    fetchChannel();
  }, []);

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

      // Close the tab after successful update
      // Small delay to allow the user to see the success message
      setTimeout(() => {
        window.close();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingChannel) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-gray-600">Loading channel...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

          {error && !channelName && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          )}

          {channelName && (
            <form onSubmit={handleUpdate} className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-blue-900 font-medium">
                  Channel: {channelName}
                </p>
                <p className="text-blue-700 text-sm mt-1">
                  Handle: @{channelHandle}
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

              {error && channelName && (
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
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
