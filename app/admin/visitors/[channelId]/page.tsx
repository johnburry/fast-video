'use client';

import { useState, useEffect, use } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { AdminToolbar } from '@/components/AdminToolbar';
import Link from 'next/link';

interface ChannelVisitor {
  id: string;
  channelId: string;
  ipAddress: string;
  userAgent: string | null;
  visitedAt: string;
}

interface GroupedVisitor {
  ipAddress: string;
  count: number;
  firstVisit: string;
  lastVisit: string;
  userAgent: string | null;
}

export default function ChannelVisitorsDetailPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const [visitors, setVisitors] = useState<ChannelVisitor[]>([]);
  const [channelName, setChannelName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'FV Admin: Channel Visitor Details';

    if (!authLoading && user) {
      fetchVisitors();
    }
  }, [authLoading, user, channelId]);

  const fetchVisitors = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/visitors/channel/${channelId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch visitor data');
      }

      const data = await response.json();
      setVisitors(data.visitors || []);
      setChannelName(data.channelName || 'Unknown Channel');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Format date in Seattle timezone
  const formatSeattleDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  // Group consecutive visits by IP address
  const groupVisitorsByIP = (visitors: ChannelVisitor[]): GroupedVisitor[] => {
    if (visitors.length === 0) return [];

    const groups: GroupedVisitor[] = [];
    let currentGroup: GroupedVisitor | null = null;

    visitors.forEach((visitor) => {
      if (!currentGroup || currentGroup.ipAddress !== visitor.ipAddress) {
        // Start a new group
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = {
          ipAddress: visitor.ipAddress,
          count: 1,
          firstVisit: visitor.visitedAt,
          lastVisit: visitor.visitedAt,
          userAgent: visitor.userAgent,
        };
      } else {
        // Add to existing group
        currentGroup.count++;
        currentGroup.lastVisit = visitor.visitedAt;
      }
    });

    // Push the last group
    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  };

  const groupedVisitors = groupVisitorsByIP(visitors);

  if (authLoading || !user) {
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
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-8 border-b border-gray-200">
              <div className="flex items-center gap-4 mb-4">
                <Link
                  href="/admin/visitors"
                  className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                >
                  ← Back to All Channels
                </Link>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {channelName}
              </h1>
              <p className="text-gray-600">
                Visitor history ({visitors.length.toLocaleString()} total visits)
              </p>
            </div>

            {loading && (
              <div className="p-8">
                <p className="text-gray-600 text-center">Loading visitor data...</p>
              </div>
            )}

            {error && (
              <div className="p-8">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 font-medium">Error</p>
                  <p className="text-red-600 text-sm mt-1">{error}</p>
                </div>
              </div>
            )}

            {!loading && !error && visitors.length === 0 && (
              <div className="p-8">
                <p className="text-gray-600 text-center">
                  No visitor data available for this channel yet.
                </p>
              </div>
            )}

            {!loading && !error && groupedVisitors.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64"
                      >
                        Visited At (Seattle Time)
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        IP Address
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Visit Count
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        User Agent
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {groupedVisitors.map((group, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="font-medium">
                            {formatSeattleDate(group.lastVisit)}
                          </div>
                          {group.count > 1 && (
                            <div className="text-xs text-gray-500 mt-1">
                              First: {formatSeattleDate(group.firstVisit)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="inline-flex items-center px-3 py-1 rounded-md bg-blue-50 border border-blue-200">
                            <span className="text-sm font-mono text-blue-900">
                              {group.ipAddress}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {group.count > 1 ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-100 text-green-800 text-xs font-medium">
                              {group.count} visits
                            </span>
                          ) : (
                            <span className="text-gray-500">1 visit</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-md truncate">
                          {group.userAgent || 'Unknown'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
