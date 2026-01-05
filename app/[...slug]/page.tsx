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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get the slug array from params
    const slug = params.slug as string[];

    console.log('CatchAllPage - params:', params);
    console.log('CatchAllPage - slug:', slug);
    console.log('CatchAllPage - slug type:', typeof slug);
    console.log('CatchAllPage - slug is array:', Array.isArray(slug));
    console.log('CatchAllPage - window.location:', window.location.href);

    // Prevent redirect if we're still on a URL shortcut path
    if (window.location.pathname.includes('http:/') || window.location.pathname.includes('https:/')) {
      console.log('CatchAllPage - URL shortcut detected in pathname, waiting for params');

      if (!slug || slug.length === 0) {
        console.log('CatchAllPage - slug not loaded yet, waiting...');
        // Don't redirect yet, params might still be loading
        setTimeout(() => {
          // Force a re-check after a brief delay
          console.log('CatchAllPage - retrying after delay');
        }, 100);
        return;
      }
    } else if (!slug || slug.length === 0) {
      console.log('CatchAllPage - no slug and no URL shortcut in pathname, redirecting to home');
      router.push('/');
      return;
    }

    // Reconstruct the full URL from the slug
    const fullPath = slug.join('/');
    console.log('CatchAllPage - fullPath:', fullPath);
    console.log('CatchAllPage - window.location.pathname:', window.location.pathname);

    // Check if this looks like a URL (contains http:// or https:/)
    // Note: browsers normalize https:// to https:/ in pathnames
    if (fullPath.includes('http://') || fullPath.includes('https://') ||
        fullPath.includes('http:/') || fullPath.includes('https:/')) {

      // Try to extract the destination URL
      // First try with double slashes, then single slash
      let extractedUrl = '';

      const httpDoubleIndex = fullPath.indexOf('http://');
      const httpsDoubleIndex = fullPath.indexOf('https://');
      const httpSingleIndex = fullPath.indexOf('http:/');
      const httpsSingleIndex = fullPath.indexOf('https:/');

      if (httpDoubleIndex !== -1) {
        extractedUrl = fullPath.substring(httpDoubleIndex);
      } else if (httpsDoubleIndex !== -1) {
        extractedUrl = fullPath.substring(httpsDoubleIndex);
      } else if (httpSingleIndex !== -1) {
        // Normalize single slash to double slash
        extractedUrl = fullPath.substring(httpSingleIndex).replace('http:/', 'http://');
      } else if (httpsSingleIndex !== -1) {
        // Normalize single slash to double slash
        extractedUrl = fullPath.substring(httpsSingleIndex).replace('https:/', 'https://');
      }

      if (extractedUrl) {
        console.log('CatchAllPage - extractedUrl:', extractedUrl);
        setDestinationUrl(extractedUrl);
        setShowModal(true);
        setIsLoading(false);
      } else {
        console.log('CatchAllPage - no URL found, redirecting to home');
        router.push('/');
      }
    } else {
      console.log('CatchAllPage - no http/https found in path, redirecting to home');
      router.push('/');
    }
  }, [params, router]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-lg">Processing URL...</p>
        </div>
      </div>
    );
  }

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
