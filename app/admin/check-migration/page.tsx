'use client';

import { useState, useEffect } from 'react';

export default function CheckMigrationPage() {
  const [progress, setProgress] = useState<{
    source: { count: number; error?: string };
    destination: { count: number; error?: string };
    remaining: number;
    percentage: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProgress = async () => {
    try {
      const response = await fetch('/api/admin/check-migration-progress');
      if (response.ok) {
        const data = await response.json();
        setProgress(data);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching progress:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
    const interval = setInterval(fetchProgress, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Migration Progress Check
          </h1>

          {progress && (
            <>
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-sm text-blue-600 font-medium mb-1">Source View</div>
                  <div className="text-3xl font-bold text-blue-900">
                    {progress.source.count.toLocaleString()}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    transcript_search_context_new
                  </div>
                  {progress.source.error && (
                    <div className="text-xs text-red-600 mt-2">{progress.source.error}</div>
                  )}
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-sm text-green-600 font-medium mb-1">Destination Table</div>
                  <div className="text-3xl font-bold text-green-900">
                    {progress.destination.count.toLocaleString()}
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    transcript_search_context_temp
                  </div>
                  {progress.destination.error && (
                    <div className="text-xs text-red-600 mt-2">{progress.destination.error}</div>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Progress</span>
                  <span className="text-sm font-bold text-gray-900">{progress.percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-6">
                  <div
                    className="bg-green-600 h-6 rounded-full transition-all duration-500 flex items-center justify-center"
                    style={{ width: `${progress.percentage}%` }}
                  >
                    {progress.percentage > 10 && (
                      <span className="text-xs text-white font-semibold">
                        {progress.percentage}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="text-sm text-orange-800">
                  <span className="font-semibold">Remaining rows:</span>{' '}
                  {progress.remaining.toLocaleString()}
                </div>
                {progress.remaining === 0 && (
                  <div className="text-sm text-green-800 font-semibold mt-2">
                    ✓ Migration complete! You can now run the finalization SQL.
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t">
                <div className="text-sm text-gray-600">
                  <p className="mb-2">Auto-refreshes every 3 seconds</p>
                  <p className="text-xs text-gray-500">
                    Last updated: {new Date().toLocaleTimeString()}
                  </p>
                </div>
              </div>

              {progress.remaining > 0 && (
                <div className="mt-6">
                  <a
                    href="/admin/migrate-search-view"
                    className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Go to Migration Tool
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
