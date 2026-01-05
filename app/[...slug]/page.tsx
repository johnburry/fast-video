'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function CatchAllPage() {
  const params = useParams();
  const router = useRouter();
  const [channelHandle, setChannelHandle] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [destinationUrl, setDestinationUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Get the slug array from params
    const slug = params.slug as string[];

    if (!slug || slug.length === 0) {
      return;
    }

    // Reconstruct the full URL from the slug
    const fullPath = slug.join('/');

    // Check if this looks like a URL (contains http:// or https://)
    if (fullPath.includes('http://') || fullPath.includes('https://')) {
      // Extract the destination URL
      const urlMatch = fullPath.match(/(https?:\/\/.+)/);
      if (urlMatch) {
        setDestinationUrl(urlMatch[1]);
        setShowModal(true);
      }
    }
  }, [params]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!channelHandle.trim()) {
      setError('Please enter a channel name');
      return;
    }

    // Validate that destination URL is valid
    try {
      new URL(destinationUrl);
    } catch {
      setError('Invalid destination URL');
      return;
    }

    // Redirect to the channel's record page with the destination URL
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';

    let targetUrl;
    if (hostname.includes('localhost')) {
      targetUrl = `${protocol}//${channelHandle}.${hostname}${port}/record?dest=${encodeURIComponent(destinationUrl)}`;
    } else {
      const baseDomain = hostname.split('.').slice(-2).join('.'); // e.g., "fast.video"
      targetUrl = `${protocol}//${channelHandle}.${baseDomain}/record?dest=${encodeURIComponent(destinationUrl)}`;
    }

    window.location.href = targetUrl;
  };

  if (!showModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 md:p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Choose Your Channel
        </h2>

        <div className="mb-6">
          <p className="text-gray-700 mb-2">
            You're creating a Fast Video for:
          </p>
          <div className="bg-gray-100 p-3 rounded-lg break-all text-sm">
            {destinationUrl}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="channelHandle" className="block text-gray-700 font-medium mb-2">
              Channel Name
            </label>
            <input
              type="text"
              id="channelHandle"
              value={channelHandle}
              onChange={(e) => {
                setChannelHandle(e.target.value);
                setError('');
              }}
              placeholder="Enter your channel name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-red-600 text-sm">{error}</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Continue to Record
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            <strong>Tip:</strong> Prepend <code className="bg-gray-100 px-1 py-0.5 rounded">fast.video/</code> to any URL in your browser to quickly create a Fast Video for that destination.
          </p>
        </div>
      </div>
    </div>
  );
}
