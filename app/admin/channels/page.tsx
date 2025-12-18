'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { AdminToolbar } from '@/components/AdminToolbar';

export default function ManageChannelsPage() {
  const { user, loading: authLoading } = useAuth();
  const [channels, setChannels] = useState<any[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);

  useEffect(() => {
    // Fetch channels if authenticated
    if (user) {
      fetchChannels();
    }
  }, [user]);

  const fetchChannels = async () => {
    setChannelsLoading(true);
    try {
      const response = await fetch('/api/channels');
      if (response.ok) {
        const data = await response.json();
        setChannels(data.channels);
      }
    } catch (err) {
      console.error('Error fetching channels:', err);
    } finally {
      setChannelsLoading(false);
    }
  };

  // Show loading state while checking auth
  if (authLoading) {
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
            <h1 className="text-3xl font-bold text-gray-900 mb-6">
              Manage Channels
            </h1>

            {channelsLoading ? (
              <p className="text-gray-600">Loading channels...</p>
            ) : channels.length === 0 ? (
              <p className="text-gray-600">No channels imported yet.</p>
            ) : (
              <div className="space-y-3">
                {channels.map((channel) => (
                  <a
                    key={channel.id}
                    href={`/admin/manage/${channel.handle}`}
                    className="block border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-4">
                      {channel.thumbnail && (
                        <img
                          src={channel.thumbnail}
                          alt={channel.name}
                          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1 break-words">
                          {channel.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          @{channel.handle}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {channel.videoCount || 0} videos
                        </p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
