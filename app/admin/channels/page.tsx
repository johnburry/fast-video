'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { AdminToolbar } from '@/components/AdminToolbar';

export default function ManageChannelsPage() {
  const { user, loading: authLoading } = useAuth();
  const [channels, setChannels] = useState<any[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    channelName: '',
    channelHandle: '',
    description: '',
    thumbnailUrl: '',
    bannerUrl: '',
    subscriberCount: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    // Set page title
    document.title = 'FV Admin';

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

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch('/api/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create channel');
      }

      const data = await response.json();

      // Refresh channels list
      await fetchChannels();

      // Reset form and close modal
      setFormData({
        channelName: '',
        channelHandle: '',
        description: '',
        thumbnailUrl: '',
        bannerUrl: '',
        subscriberCount: 0,
      });
      setShowAddForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter channels by name
  const filteredChannels = channels.filter((channel) =>
    channel.name.toLowerCase().includes(filterText.toLowerCase())
  );

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
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold text-gray-900">
                Manage Channels
              </h1>
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Add Channel
              </button>
            </div>

            {channelsLoading ? (
              <p className="text-gray-600">Loading channels...</p>
            ) : channels.length === 0 ? (
              <p className="text-gray-600">No channels imported yet.</p>
            ) : (
              <>
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Filter channels by name..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                {filteredChannels.length === 0 ? (
                  <p className="text-gray-600 text-center py-4">No channels found matching "{filterText}"</p>
                ) : (
                  <div className="space-y-3">
                    {filteredChannels.map((channel) => (
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add Channel Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Add New Channel</h2>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setFormError(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleAddChannel} className="space-y-4">
                <div>
                  <label htmlFor="channelName" className="block text-sm font-medium text-gray-700 mb-1">
                    Channel Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="channelName"
                    value={formData.channelName}
                    onChange={(e) => setFormData({ ...formData, channelName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={submitting}
                    placeholder="My Awesome Channel"
                  />
                </div>

                <div>
                  <label htmlFor="channelHandle" className="block text-sm font-medium text-gray-700 mb-1">
                    Channel Handle <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="channelHandle"
                    value={formData.channelHandle}
                    onChange={(e) => setFormData({ ...formData, channelHandle: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={submitting}
                    placeholder="myawesomechannel"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Used as subdomain (will be sanitized to lowercase alphanumeric and hyphens)
                  </p>
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={submitting}
                    placeholder="A brief description of the channel..."
                  />
                </div>

                <div>
                  <label htmlFor="thumbnailUrl" className="block text-sm font-medium text-gray-700 mb-1">
                    Thumbnail URL
                  </label>
                  <input
                    type="url"
                    id="thumbnailUrl"
                    value={formData.thumbnailUrl}
                    onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={submitting}
                    placeholder="https://example.com/thumbnail.jpg"
                  />
                </div>

                <div>
                  <label htmlFor="bannerUrl" className="block text-sm font-medium text-gray-700 mb-1">
                    Banner URL
                  </label>
                  <input
                    type="url"
                    id="bannerUrl"
                    value={formData.bannerUrl}
                    onChange={(e) => setFormData({ ...formData, bannerUrl: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={submitting}
                    placeholder="https://example.com/banner.jpg"
                  />
                </div>

                <div>
                  <label htmlFor="subscriberCount" className="block text-sm font-medium text-gray-700 mb-1">
                    Subscriber Count
                  </label>
                  <input
                    type="number"
                    id="subscriberCount"
                    value={formData.subscriberCount}
                    onChange={(e) => setFormData({ ...formData, subscriberCount: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={submitting}
                  />
                </div>

                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800 text-sm">{formError}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? 'Creating...' : 'Create Channel'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setFormError(null);
                    }}
                    disabled={submitting}
                    className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
