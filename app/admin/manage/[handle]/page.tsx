'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Channel {
  id: string;
  handle: string;
  name: string;
  description: string | null;
  thumbnail: string | null;
  bannerUrl: string | null;
  externalLink: string | null;
  externalLinkName: string | null;
  isActive: boolean;
}

export default function ManageChannelPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = use(params);
  const router = useRouter();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [externalLinkName, setExternalLinkName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  useEffect(() => {
    fetchChannel();
  }, [handle]);

  const fetchChannel = async () => {
    try {
      const response = await fetch(`/api/channels/${handle}`);
      if (!response.ok) {
        throw new Error('Channel not found');
      }
      const data = await response.json();
      const ch = data.channel;
      setChannel(ch);
      setName(ch.name);
      setDescription(ch.description || '');
      setExternalLink(ch.externalLink || '');
      setExternalLinkName(ch.externalLinkName || '');
      setIsActive(ch.isActive !== false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load channel');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/channels/${channel?.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
          externalLink,
          externalLinkName,
          isActive,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update channel');
      }

      setSuccess('Channel updated successfully!');
      fetchChannel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update channel');
    } finally {
      setSaving(false);
    }
  };

  const handleThumbnailUpload = async () => {
    if (!thumbnailFile || !channel) return;

    setUploadingThumbnail(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('thumbnail', thumbnailFile);

      const response = await fetch(`/api/admin/channels/${channel.id}/thumbnail`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload thumbnail');
      }

      setSuccess('Thumbnail uploaded successfully!');
      setThumbnailFile(null);
      fetchChannel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload thumbnail');
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const handleDelete = async () => {
    if (!channel) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${channel.name}? This will permanently delete the channel, all its videos, and transcripts. This action cannot be undone.`
    );

    if (!confirmDelete) return;

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/channels/${channel.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete channel');
      }

      alert('Channel deleted successfully');
      router.push('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete channel');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading channel...</p>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-600">Channel not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <a
            href="/admin"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back to Admin
          </a>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Manage Channel
          </h1>
          <p className="text-gray-600 mb-8">@{channel.handle}</p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800">{success}</p>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Channel Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Channel Thumbnail
              </label>
              {channel.thumbnail && (
                <div className="mb-4">
                  <img
                    src={channel.thumbnail}
                    alt={channel.name}
                    className="w-32 h-32 rounded-lg object-cover"
                  />
                </div>
              )}
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleThumbnailUpload}
                  disabled={!thumbnailFile || uploadingThumbnail}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {uploadingThumbnail ? 'Uploading...' : 'Upload'}
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Upload a new thumbnail image (JPG, PNG, etc.)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                External Link Name
              </label>
              <input
                type="text"
                value={externalLinkName}
                onChange={(e) => setExternalLinkName(e.target.value)}
                placeholder="e.g., Visit Website"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                External Link URL
              </label>
              <input
                type="url"
                value={externalLink}
                onChange={(e) => setExternalLink(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                Channel is active (visible to public)
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Danger Zone</h2>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-full bg-red-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {deleting ? 'Deleting...' : 'Delete Channel'}
            </button>
            <p className="text-sm text-gray-500 mt-2">
              This will permanently delete the channel, all videos, and transcripts. This action cannot be undone.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
