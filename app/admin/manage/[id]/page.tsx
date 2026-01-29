'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { AdminToolbar } from '@/components/AdminToolbar';
import MuxUploader from '@mux/mux-uploader-react';
import MuxPlayer from '@mux/mux-player-react';

interface Channel {
  id: string;
  handle: string;
  youtubeHandle: string | null;
  name: string;
  shortName: string | null;
  description: string | null;
  thumbnail: string | null;
  bannerUrl: string | null;
  externalLink: string | null;
  externalLinkName: string | null;
  isActive: boolean;
  subscriptionType: string | null;
  subscriptionStartDate: string | null;
  channelHistory: string | null;
  introVideoPlaybackId: string | null;
  tenantId: string | null;
  isMusicChannel: boolean;
}

export default function ManageChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [tenantDomain, setTenantDomain] = useState<string>('playsermons.com');

  // Form fields
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [channelHandle, setChannelHandle] = useState('');
  const [description, setDescription] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [externalLinkName, setExternalLinkName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isMusicChannel, setIsMusicChannel] = useState(false);
  const [subscriptionType, setSubscriptionType] = useState('trial');
  const [subscriptionStartDate, setSubscriptionStartDate] = useState('');
  const [channelHistory, setChannelHistory] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  // Intro video upload state
  const [introUploadId, setIntroUploadId] = useState<string>('');
  const [isUploadingIntro, setIsUploadingIntro] = useState(false);
  const [isPreparingIntro, setIsPreparingIntro] = useState(false);
  const [introVideoError, setIntroVideoError] = useState<string>('');
  const [showIntroUploader, setShowIntroUploader] = useState(false);

  // Track previous values for change detection
  const [prevSubscriptionType, setPrevSubscriptionType] = useState('');
  const [prevSubscriptionStartDate, setPrevSubscriptionStartDate] = useState('');
  const [prevIsActive, setPrevIsActive] = useState(true);

  useEffect(() => {
    fetchChannel();
    fetchTenants();
  }, [id]);

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/admin/tenants');
      if (response.ok) {
        const data = await response.json();
        setTenants(data.tenants || []);
      }
    } catch (err) {
      console.error('Error fetching tenants:', err);
    }
  };

  const fetchChannel = async () => {
    try {
      const response = await fetch(`/api/admin/channels/${id}`);
      if (!response.ok) {
        throw new Error('Channel not found');
      }
      const data = await response.json();
      const ch = data.channel;
      setChannel(ch);

      // Set page title
      document.title = `FV Admin: ${ch.handle || ch.name}`;

      setName(ch.name);
      setShortName(ch.shortName || '');
      setChannelHandle(ch.handle);
      setDescription(ch.description || '');
      setExternalLink(ch.externalLink || '');
      setExternalLinkName(ch.externalLinkName || '');
      setIsActive(ch.isActive !== false);
      setIsMusicChannel(ch.isMusicChannel || false);
      setSubscriptionType(ch.subscriptionType || 'trial');
      setSubscriptionStartDate(ch.subscriptionStartDate ? ch.subscriptionStartDate.split('T')[0] : '');
      setChannelHistory(ch.channelHistory || '');
      setTenantId(ch.tenantId || '');

      // Fetch tenant domain if tenantId exists
      if (ch.tenantId) {
        const tenantResponse = await fetch(`/api/admin/tenants/${ch.tenantId}`);
        if (tenantResponse.ok) {
          const tenantData = await tenantResponse.json();
          if (tenantData.tenant?.domain) {
            setTenantDomain(tenantData.tenant.domain);
          }
        }
      }

      // Set previous values for change tracking
      setPrevSubscriptionType(ch.subscriptionType || 'trial');
      setPrevSubscriptionStartDate(ch.subscriptionStartDate ? ch.subscriptionStartDate.split('T')[0] : '');
      setPrevIsActive(ch.isActive !== false);
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
      // Build history log for changes
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      let historyUpdates: string[] = [];

      if (subscriptionType.toLowerCase() !== prevSubscriptionType.toLowerCase()) {
        historyUpdates.push(`${now} subscription_type: ${subscriptionType}`);
      }

      if (subscriptionStartDate !== prevSubscriptionStartDate) {
        historyUpdates.push(`${now} subscription_start_date`);
      }

      if (isActive !== prevIsActive) {
        historyUpdates.push(`${now} is_active: ${isActive}`);
      }

      // Append new history entries to existing history
      let updatedHistory = channelHistory;
      if (historyUpdates.length > 0) {
        const newEntries = historyUpdates.join('\n');
        updatedHistory = channelHistory ? `${channelHistory}\n${newEntries}` : newEntries;
      }

      const response = await fetch(`/api/admin/channels/${channel?.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          shortName,
          handle: channelHandle,
          description,
          externalLink,
          externalLinkName,
          isActive,
          isMusicChannel,
          subscriptionType,
          subscriptionStartDate: subscriptionStartDate || null,
          channelHistory: updatedHistory,
          tenantId: tenantId || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update channel');
      }

      const data = await response.json();

      // Update success message and refresh
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

  // Intro video upload functions
  const createIntroUpload = async () => {
    try {
      console.log('Creating intro video upload...');
      const res = await fetch('/api/mux/upload', { method: 'POST' });
      if (!res.ok) {
        throw new Error('Failed to create upload');
      }
      const { id, url } = await res.json();
      console.log('Upload created:', { id, url });
      setIntroUploadId(id);
      return url;
    } catch (e) {
      console.error('Error in createIntroUpload', e);
      setIntroVideoError('Error creating upload. Please check your Mux credentials.');
      return null;
    }
  };

  const handleIntroUploadStart = () => {
    console.log('Intro upload started');
    setIsUploadingIntro(true);
    setIntroVideoError('');
    // Start preparing/polling immediately when upload starts
    // MuxUploader will handle the actual upload progress
    setTimeout(() => {
      console.log('Transitioning to preparing state');
      setIsPreparingIntro(true);
      setIsUploadingIntro(false);
    }, 2000); // Give 2 seconds for upload to actually start
  };

  const handleIntroSuccess = () => {
    console.log('Intro upload success event received');
    // This event may or may not fire reliably, so we start polling on upload start
  };

  const handleIntroUploadError = (event: any) => {
    console.error('Intro upload error:', event);
    setIsUploadingIntro(false);
    setIsPreparingIntro(false);
    setIntroVideoError(event.detail?.message || 'Upload failed');
  };

  const handleIntroProgress = (event: any) => {
    console.log('Intro upload progress:', event.detail);
  };

  const handleRemoveIntroVideo = async () => {
    if (!channel) return;

    const confirmRemove = window.confirm(
      'Are you sure you want to remove the intro video? This will stop the intro video from playing before channel videos.'
    );

    if (!confirmRemove) return;

    try {
      const response = await fetch(`/api/admin/channels/${channel.id}/intro-video`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove intro video');
      }

      setSuccess('Intro video removed successfully!');
      fetchChannel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove intro video');
    }
  };

  // Poll for intro video upload status
  useEffect(() => {
    if (!isPreparingIntro || !introUploadId || !channel) {
      console.log('Polling skipped:', { isPreparingIntro, introUploadId: !!introUploadId, channel: !!channel });
      return;
    }

    console.log('Starting polling for intro upload:', introUploadId);

    const pollInterval = setInterval(async () => {
      try {
        console.log('Polling intro upload status...');
        const res = await fetch(`/api/mux/upload/${introUploadId}`);
        const data = await res.json();
        console.log('Poll response:', data);

        if (data.playbackUrl) {
          console.log('Playback URL ready:', data.playbackUrl);
          setIsPreparingIntro(false);
          clearInterval(pollInterval);

          // Save intro video playback ID to channel
          const playbackId = data.playbackUrl.split('/').pop()?.replace('.m3u8', '') || '';
          console.log('Extracted playback ID:', playbackId);

          try {
            console.log('Saving intro video to channel...');
            const saveRes = await fetch(`/api/admin/channels/${channel.id}/intro-video`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ playbackId }),
            });

            if (!saveRes.ok) {
              const errorText = await saveRes.text();
              console.error('Failed to save intro video:', errorText);
              setIntroVideoError(`Failed to save intro video: ${errorText}`);
            } else {
              console.log('Intro video saved successfully!');
              setSuccess('Intro video uploaded successfully!');
              setShowIntroUploader(false);
              setIntroUploadId('');
              fetchChannel();
            }
          } catch (saveError) {
            console.error('Error saving intro video:', saveError);
            setIntroVideoError('Error saving intro video');
          }
        }
      } catch (e) {
        console.error('Error polling intro upload status:', e);
      }
    }, 3000);

    return () => {
      console.log('Cleaning up polling interval');
      clearInterval(pollInterval);
    };
  }, [isPreparingIntro, introUploadId, channel]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
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
    <div className="min-h-screen bg-gray-50">
      <AdminToolbar />
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <a
              href="/admin/channels"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Channels
            </a>
          </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Manage Channel
              </h1>
              <p className="text-gray-600 mb-4">@{channel.handle}</p>
              <div className="flex items-center gap-3">
                <a
                  href={
                    channel.handle
                      ? `https://${channel.handle}.${tenantDomain}`
                      : `https://${tenantDomain}/${channel.id}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
                >
                  View Channel
                </a>
                <a
                  href={`https://playsermons.com/admin?channel=${channel.youtubeHandle || '@' + channel.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors text-sm"
                >
                  Import Channel
                </a>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

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
                Tenant
              </label>
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">No tenant assigned</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.domain})
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm text-gray-500">
                Select which tenant this channel belongs to
              </p>
            </div>

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
                Short Name
              </label>
              <input
                type="text"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="e.g., Jane Smith"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-2 text-sm text-gray-500">
                Used in video titles (e.g., "A Fast Video from Jane Smith")
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fast Video Handle
              </label>
              <input
                type="text"
                value={channelHandle}
                onChange={(e) => setChannelHandle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                pattern="[a-z0-9.\-]+"
                title="Only lowercase letters, numbers, periods, and hyphens are allowed"
              />
              <p className="mt-2 text-sm text-gray-500">
                Used in the URL: {channelHandle}.{tenantDomain}
              </p>
            </div>

            {channel.youtubeHandle && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  YouTube Channel Handle
                </label>
                <input
                  type="text"
                  value={channel.youtubeHandle}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  disabled
                  readOnly
                />
                <p className="mt-2 text-sm text-gray-500">
                  Original YouTube handle (read-only, used for YouTube links)
                </p>
              </div>
            )}

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

            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Intro Video</h3>
              <p className="text-sm text-gray-600 mb-4">
                Upload an intro video that will play before each video on this channel. The intro video will automatically transition to the main video when it ends.
              </p>

              {channel.introVideoPlaybackId && (
                <div className="mb-4">
                  <div className="bg-gray-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-gray-700">Current Intro Video</p>
                      <button
                        type="button"
                        onClick={handleRemoveIntroVideo}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg font-medium hover:bg-red-700 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                    <MuxPlayer
                      playbackId={channel.introVideoPlaybackId}
                      streamType="on-demand"
                      style={{ width: '100%', maxHeight: '300px' }}
                    />
                  </div>
                </div>
              )}

              {!showIntroUploader && !channel.introVideoPlaybackId && (
                <button
                  type="button"
                  onClick={() => setShowIntroUploader(true)}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                >
                  Upload Intro Video
                </button>
              )}

              {!showIntroUploader && channel.introVideoPlaybackId && (
                <button
                  type="button"
                  onClick={() => setShowIntroUploader(true)}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                >
                  Replace Intro Video
                </button>
              )}

              {showIntroUploader && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">Upload New Intro Video</h4>
                    <button
                      type="button"
                      onClick={() => {
                        setShowIntroUploader(false);
                        setIntroVideoError('');
                        setIsUploadingIntro(false);
                        setIsPreparingIntro(false);
                      }}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                  </div>

                  {introVideoError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-800 text-sm">{introVideoError}</p>
                    </div>
                  )}

                  {!isUploadingIntro && !isPreparingIntro && (
                    <MuxUploader
                      endpoint={createIntroUpload}
                      onUploadStart={handleIntroUploadStart}
                      onSuccess={handleIntroSuccess}
                      onUploadError={handleIntroUploadError}
                      onProgress={handleIntroProgress}
                    />
                  )}

                  {isUploadingIntro && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-blue-800 font-medium">Uploading intro video...</p>
                      <p className="text-blue-600 text-sm mt-1">Please wait while your video uploads to Mux.</p>
                    </div>
                  )}

                  {isPreparingIntro && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-yellow-800 font-medium">Processing intro video...</p>
                      <p className="text-yellow-600 text-sm mt-1">Your video is being encoded. This may take a few moments.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Subscription Settings</h3>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subscription Type
                  </label>
                  <select
                    value={subscriptionType}
                    onChange={(e) => setSubscriptionType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="trial">Trial</option>
                    <option value="intro">Intro</option>
                    <option value="pro">Pro</option>
                    <option value="lifetime">Lifetime</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subscription Start Date
                  </label>
                  <input
                    type="date"
                    value={subscriptionStartDate}
                    onChange={(e) => setSubscriptionStartDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Channel History
                  </label>
                  <textarea
                    value={channelHistory}
                    readOnly
                    rows={8}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed font-mono text-xs"
                    placeholder="History will be automatically logged here..."
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    This log is automatically updated when subscription type, start date, or active status changes.
                  </p>
                </div>
              </div>
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

            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <input
                type="checkbox"
                id="isMusicChannel"
                checked={isMusicChannel}
                onChange={(e) => setIsMusicChannel(e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <label htmlFor="isMusicChannel" className="block text-sm font-medium text-gray-900">
                  Music Channel (Skip Transcription)
                </label>
                <p className="mt-1 text-sm text-gray-600">
                  Enable this for music channels where transcription is not needed. Videos will be imported without attempting to fetch transcripts.
                </p>
              </div>
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
    </div>
  );
}
