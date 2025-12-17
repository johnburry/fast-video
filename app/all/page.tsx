'use client';

import { useState, useEffect, ReactElement } from 'react';
import Link from 'next/link';

// Helper function to process channel names with line break character
function formatChannelName(name: string): ReactElement[] {
  const parts = name.split('|');
  return parts.map((part, index) => (
    <span key={index}>
      {part.trim()}
      {index < parts.length - 1 && <br />}
    </span>
  ));
}

interface Channel {
  id: string;
  handle: string;
  name: string;
  description: string;
  thumbnail: string;
  subscriberCount: number;
  videoCount: number;
}

export default function AllChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'All Fast Video Channels';
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    try {
      const response = await fetch('/api/channels');
      if (!response.ok) {
        throw new Error('Failed to fetch channels');
      }
      const data = await response.json();
      setChannels(data.channels);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white text-xl">Loading channels...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-red-500 text-xl">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div style={{ backgroundColor: '#222529' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="text-2xl md:text-4xl font-bold mb-3" style={{ color: '#B2071D' }}>
              <div className="flex items-center justify-center gap-3">
                <svg className="w-8 h-8 md:w-10 md:h-10" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="64" height="64" rx="12" fill="#B2071D"/>
                  <circle cx="27" cy="27" r="12" stroke="white" strokeWidth="4" fill="none"/>
                  <line x1="35" y1="35" x2="48" y2="48" stroke="white" strokeWidth="4" strokeLinecap="round"/>
                </svg>
                <span>FAST VIDEO</span>
              </div>
              <div>TRANSCRIPT SEARCH</div>
            </div>
            <h1 className="text-3xl md:text-6xl font-black text-white mb-4">
              All Fast Video Channels
            </h1>
            <p className="text-gray-300 text-lg">
              Search transcripts across all available channels
            </p>
          </div>
        </div>
      </div>

      {/* Channels Grid */}
      <div className="bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {channels.length === 0 ? (
            <p className="text-white text-center text-xl">No channels available yet.</p>
          ) : (
            <>
              <p className="text-gray-400 mb-8 text-center">
                {channels.length} {channels.length === 1 ? 'channel' : 'channels'} available
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {channels.map((channel) => (
                  <Link
                    key={channel.id}
                    href={`https://${channel.handle}.fast.video`}
                    className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer flex flex-col"
                  >
                    <div className="p-6 flex flex-col flex-1">
                      <div className="flex items-start space-x-4 mb-4">
                        {channel.thumbnail && (
                          <img
                            src={getThumbnailUrl(channel.thumbnail)}
                            alt={channel.name}
                            className="w-16 h-16 rounded-full flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-bold text-gray-900 line-clamp-3 mb-2" style={{ minHeight: '4.5rem' }}>
                            {formatChannelName(channel.name)}
                          </h3>
                          <p className="text-sm text-gray-600">
                            @{channel.handle}
                          </p>
                        </div>
                      </div>

                      <div className="flex-1 mb-4" style={{ minHeight: '4.5rem' }}>
                        {channel.description && (
                          <p className="text-gray-700 text-sm line-clamp-3">
                            {channel.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-sm text-gray-500 mt-auto">
                        <span>{channel.videoCount || 0} videos</span>
                        {channel.subscriberCount > 0 && (
                          <span>
                            {new Intl.NumberFormat('en-US', {
                              notation: 'compact',
                              maximumFractionDigits: 1
                            }).format(channel.subscriberCount)} subscribers
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
