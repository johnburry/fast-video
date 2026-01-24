'use client';

import { useState, useEffect } from 'react';
import AdminToolbar from '@/components/AdminToolbar';

interface SearchAnalytic {
  id: string;
  tenant_name: string;
  channel_name: string | null;
  search_query: string;
  results_count: number;
  search_type: string;
  searched_at: string;
}

interface Summary {
  totalSearches: number;
  uniqueQueries: number;
  averageResults: number;
  topQueries: Array<{ query: string; count: number }>;
  topTenants: Array<{ tenant: string; count: number }>;
  topChannels: Array<{ channel: string; count: number }>;
}

export default function SearchAnalyticsPage() {
  const [analytics, setAnalytics] = useState<SearchAnalytic[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchAnalytics();
  }, [limit, offset]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/search-analytics?limit=${limit}&offset=${offset}`
      );
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics || []);
        setSummary(data.summary);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Error fetching search analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const nextPage = () => {
    if (offset + limit < total) {
      setOffset(offset + limit);
    }
  };

  const prevPage = () => {
    if (offset > 0) {
      setOffset(Math.max(0, offset - limit));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminToolbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Search Analytics</h1>
          <p className="mt-2 text-gray-600">
            Track and analyze all searches performed across your tenants and channels
          </p>
        </div>

        {/* Summary Statistics */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase">Total Searches</h3>
              <p className="mt-2 text-3xl font-bold text-gray-900">{summary.totalSearches.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase">Unique Queries</h3>
              <p className="mt-2 text-3xl font-bold text-gray-900">{summary.uniqueQueries.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase">Avg Results</h3>
              <p className="mt-2 text-3xl font-bold text-gray-900">{summary.averageResults}</p>
            </div>
          </div>
        )}

        {/* Top Lists */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Top Queries */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Queries</h3>
              <div className="space-y-2">
                {summary.topQueries.map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 truncate flex-1">{item.query}</span>
                    <span className="text-sm font-medium text-gray-900 ml-2">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Tenants */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Tenants</h3>
              <div className="space-y-2">
                {summary.topTenants.map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 truncate flex-1">{item.tenant}</span>
                    <span className="text-sm font-medium text-gray-900 ml-2">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Channels */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Channels</h3>
              <div className="space-y-2">
                {summary.topChannels.map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 truncate flex-1">{item.channel}</span>
                    <span className="text-sm font-medium text-gray-900 ml-2">{item.count}</span>
                  </div>
                ))}
                {summary.topChannels.length === 0 && (
                  <p className="text-sm text-gray-500 italic">No channel-specific searches yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Search Analytics Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Recent Searches</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading analytics...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date/Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tenant
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Channel
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Search Query
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Results
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analytics.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(item.searched_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.tenant_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {item.channel_name || (
                            <span className="text-gray-400 italic">All channels</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="max-w-md truncate">{item.search_query}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {item.results_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs">
                          <span className={`px-2 py-1 rounded-full font-medium ${
                            item.search_type === 'hybrid'
                              ? 'bg-purple-100 text-purple-800'
                              : item.search_type === 'semantic'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {item.search_type}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} searches
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={prevPage}
                    disabled={offset === 0}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={nextPage}
                    disabled={offset + limit >= total}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
