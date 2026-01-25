'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { AdminToolbar } from '@/components/AdminToolbar';

interface Tenant {
  id: string;
  domain: string;
  name: string;
  logo_type: 'text' | 'image';
  logo_text?: string;
  logo_image_url?: string;
  logo_alt_text: string;
  tagline?: string;
  search_placeholder: string;
  search_results_heading: string;
  redirect_url?: string;
  channels_gallery: boolean;
  features?: any;
  colors?: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function ManageTenantsPage() {
  const { user, loading: authLoading } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState({
    domain: '',
    name: '',
    logo_type: 'text' as 'text' | 'image',
    logo_text: '',
    logo_image_url: '',
    logo_alt_text: '',
    tagline: '',
    search_placeholder: '',
    search_results_heading: '',
    redirect_url: '',
    channels_gallery: false,
    is_active: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [tenantChannels, setTenantChannels] = useState<any[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);

  useEffect(() => {
    document.title = 'FV Admin: Tenants';

    if (user) {
      fetchTenants();
    }
  }, [user]);

  const fetchTenants = async () => {
    setTenantsLoading(true);
    try {
      const response = await fetch('/api/admin/tenants');
      if (response.ok) {
        const data = await response.json();
        setTenants(data.tenants);
      }
    } catch (err) {
      console.error('Error fetching tenants:', err);
    } finally {
      setTenantsLoading(false);
    }
  };

  const fetchTenantChannels = async (tenantId: string) => {
    setChannelsLoading(true);
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}/channels`);
      if (response.ok) {
        const data = await response.json();
        setTenantChannels(data.channels || []);
      }
    } catch (err) {
      console.error('Error fetching tenant channels:', err);
    } finally {
      setChannelsLoading(false);
    }
  };

  const handleRemoveChannel = async (channelId: string) => {
    if (!editingTenant) return;

    if (!confirm('Are you sure you want to unassign this channel from this tenant?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/channels/${channelId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId: null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to unassign channel');
      }

      // Refresh the channel list
      await fetchTenantChannels(editingTenant.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to unassign channel');
    }
  };

  const resetForm = () => {
    setFormData({
      domain: '',
      name: '',
      logo_type: 'text',
      logo_text: '',
      logo_image_url: '',
      logo_alt_text: '',
      tagline: '',
      search_placeholder: '',
      search_results_heading: '',
      redirect_url: '',
      channels_gallery: false,
      is_active: true,
    });
    setEditingTenant(null);
    setFormError(null);
    setTenantChannels([]);
  };

  const handleEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setFormData({
      domain: tenant.domain,
      name: tenant.name,
      logo_type: tenant.logo_type,
      logo_text: tenant.logo_text || '',
      logo_image_url: tenant.logo_image_url || '',
      logo_alt_text: tenant.logo_alt_text,
      tagline: tenant.tagline || '',
      search_placeholder: tenant.search_placeholder,
      search_results_heading: tenant.search_results_heading,
      redirect_url: tenant.redirect_url || '',
      channels_gallery: tenant.channels_gallery || false,
      is_active: tenant.is_active,
    });
    setShowAddForm(true);
    // Fetch channels for this tenant
    fetchTenantChannels(tenant.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      const url = editingTenant
        ? `/api/admin/tenants/${editingTenant.id}`
        : '/api/admin/tenants';

      const method = editingTenant ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${editingTenant ? 'update' : 'create'} tenant`);
      }

      await fetchTenants();
      resetForm();
      setShowAddForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (tenant: Tenant) => {
    if (!confirm(`Are you sure you want to delete the tenant "${tenant.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete tenant');
      }

      await fetchTenants();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete tenant');
    }
  };

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
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Manage Tenants
                </h1>
                <p className="text-gray-600 mt-1">
                  Configure multi-tenant branding and domain settings
                </p>
              </div>
              <button
                onClick={() => {
                  resetForm();
                  setShowAddForm(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Add Tenant
              </button>
            </div>

            {tenantsLoading ? (
              <p className="text-gray-600">Loading tenants...</p>
            ) : tenants.length === 0 ? (
              <p className="text-gray-600">No tenants configured yet.</p>
            ) : (
              <div className="space-y-4">
                {tenants.map((tenant) => (
                  <div
                    key={tenant.id}
                    className="border border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          {tenant.logo_type === 'image' && tenant.logo_image_url ? (
                            <img
                              src={tenant.logo_image_url}
                              alt={tenant.logo_alt_text}
                              className="h-12 w-auto"
                            />
                          ) : (
                            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                              {tenant.logo_text || tenant.name}
                            </span>
                          )}
                          {tenant.channels_gallery && (
                            <span className="px-3 py-1 text-xs font-bold bg-purple-100 text-purple-800 rounded border border-purple-300">
                              🎨 GALLERY
                            </span>
                          )}
                          {tenant.redirect_url && !tenant.channels_gallery && (
                            <span className="px-3 py-1 text-xs font-bold bg-orange-100 text-orange-800 rounded border border-orange-300">
                              ↗ REDIRECT
                            </span>
                          )}
                          {!tenant.is_active && (
                            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="space-y-2 text-sm">
                          <p className="text-gray-900 font-semibold text-lg">{tenant.name}</p>
                          <p className="text-gray-700">
                            <span className="font-medium">Domain:</span>{' '}
                            <code className="bg-gray-100 px-2 py-1 rounded">{tenant.domain}</code>
                          </p>
                          {tenant.tagline && (
                            <p className="text-gray-600 italic">{tenant.tagline}</p>
                          )}
                          {tenant.redirect_url ? (
                            <p className="text-orange-700 font-medium">
                              <span className="font-bold">Redirects to:</span>{' '}
                              <a href={tenant.redirect_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-orange-900">
                                {tenant.redirect_url}
                              </a>
                            </p>
                          ) : (
                            <>
                              <p className="text-gray-600">
                                <span className="font-medium">Search Placeholder:</span> "{tenant.search_placeholder || 'Search all videos'}"
                              </p>
                              <p className="text-gray-600">
                                <span className="font-medium">Search Results Heading:</span> "{tenant.search_results_heading || 'Search'}"
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleEdit(tenant)}
                          className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(tenant)}
                          className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Tenant Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingTenant ? 'Edit Tenant' : 'Add New Tenant'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-1">
                    Domain <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="domain"
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={submitting}
                    placeholder="example.com"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    The primary domain for this tenant (e.g., playsermons.com, fast.video)
                  </p>
                </div>

                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Tenant Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={submitting}
                    placeholder="My Awesome Site"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Logo Type <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="text"
                        checked={formData.logo_type === 'text'}
                        onChange={(e) => setFormData({ ...formData, logo_type: 'text' })}
                        className="mr-2"
                        disabled={submitting}
                      />
                      Text Logo
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="image"
                        checked={formData.logo_type === 'image'}
                        onChange={(e) => setFormData({ ...formData, logo_type: 'image' })}
                        className="mr-2"
                        disabled={submitting}
                      />
                      Image Logo
                    </label>
                  </div>
                </div>

                {formData.logo_type === 'text' ? (
                  <div>
                    <label htmlFor="logo_text" className="block text-sm font-medium text-gray-700 mb-1">
                      Logo Text <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="logo_text"
                      value={formData.logo_text}
                      onChange={(e) => setFormData({ ...formData, logo_text: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required={formData.logo_type === 'text'}
                      disabled={submitting}
                      placeholder="Fast.Video"
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="logo_image_url" className="block text-sm font-medium text-gray-700 mb-1">
                      Logo Image URL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      id="logo_image_url"
                      value={formData.logo_image_url}
                      onChange={(e) => setFormData({ ...formData, logo_image_url: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required={formData.logo_type === 'image'}
                      disabled={submitting}
                      placeholder="/logo.svg"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="logo_alt_text" className="block text-sm font-medium text-gray-700 mb-1">
                    Logo Alt Text <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="logo_alt_text"
                    value={formData.logo_alt_text}
                    onChange={(e) => setFormData({ ...formData, logo_alt_text: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={submitting}
                    placeholder="My Site Logo"
                  />
                </div>

                <div>
                  <label htmlFor="tagline" className="block text-sm font-medium text-gray-700 mb-1">
                    Tagline
                  </label>
                  <input
                    type="text"
                    id="tagline"
                    value={formData.tagline}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={submitting}
                    placeholder="Search and discover amazing content"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Optional: Displayed on homepage for sites with full layout
                  </p>
                </div>

                <div>
                  <label htmlFor="search_placeholder" className="block text-sm font-medium text-gray-700 mb-1">
                    Search Placeholder
                  </label>
                  <input
                    type="text"
                    id="search_placeholder"
                    value={formData.search_placeholder}
                    onChange={(e) => setFormData({ ...formData, search_placeholder: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={submitting}
                    placeholder="Search all videos (default)"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Optional: Defaults to "Search all videos" if not specified
                  </p>
                </div>

                <div>
                  <label htmlFor="search_results_heading" className="block text-sm font-medium text-gray-700 mb-1">
                    Search Results Heading
                  </label>
                  <input
                    type="text"
                    id="search_results_heading"
                    value={formData.search_results_heading}
                    onChange={(e) => setFormData({ ...formData, search_results_heading: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={submitting}
                    placeholder="Search (default)"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Optional: Defaults to "Search" if not specified
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      id="channels_gallery"
                      checked={formData.channels_gallery}
                      onChange={(e) => setFormData({ ...formData, channels_gallery: e.target.checked })}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                      disabled={submitting}
                    />
                    <label htmlFor="channels_gallery" className="ml-2 text-sm font-medium text-gray-700">
                      Enable Channels Gallery
                    </label>
                  </div>
                  <p className="mb-4 text-sm text-gray-500">
                    When enabled, the homepage will display a grid of all channels for this tenant instead of redirecting. This overrides the redirect URL setting.
                  </p>

                  <label htmlFor="redirect_url" className="block text-sm font-medium text-gray-700 mb-1">
                    Redirect URL
                  </label>
                  <input
                    type="url"
                    id="redirect_url"
                    value={formData.redirect_url}
                    onChange={(e) => setFormData({ ...formData, redirect_url: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={submitting || formData.channels_gallery}
                    placeholder="https://example.com"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Optional: If set, visiting this tenant's domain will immediately redirect to this URL. Use this to create redirect-only tenants. {formData.channels_gallery && '(Disabled when Channels Gallery is enabled)'}
                  </p>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    disabled={submitting}
                  />
                  <label htmlFor="is_active" className="ml-2 text-sm font-medium text-gray-700">
                    Active
                  </label>
                </div>

                {/* Associated Channels List */}
                {editingTenant && (
                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      Associated Channels
                    </h3>
                    {channelsLoading ? (
                      <p className="text-gray-600 text-sm">Loading channels...</p>
                    ) : tenantChannels.length === 0 ? (
                      <p className="text-gray-600 text-sm">No channels assigned to this tenant yet.</p>
                    ) : (
                      <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                        {tenantChannels.map((channel) => (
                          <div
                            key={channel.id}
                            className="flex items-center justify-between p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                          >
                            <div className="flex items-center gap-3 flex-1">
                              {channel.thumbnail && (
                                <img
                                  src={channel.thumbnail}
                                  alt={channel.name}
                                  className="w-12 h-12 rounded-lg object-cover"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <a
                                  href={`/admin/manage/${channel.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-blue-600 hover:text-blue-800 truncate block hover:underline"
                                >
                                  {channel.name}
                                </a>
                                {channel.handle && (
                                  <p className="text-xs text-gray-500">@{channel.handle}</p>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveChannel(channel.id)}
                              className="px-3 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

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
                    {submitting ? (editingTenant ? 'Updating...' : 'Creating...') : (editingTenant ? 'Update Tenant' : 'Create Tenant')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      resetForm();
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
