'use client';

import { AdminToolbar } from '@/components/AdminToolbar';
import Link from 'next/link';

export default function MigrationsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminToolbar />
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Database Migrations
            </h1>
            <p className="text-gray-600 mb-8">
              Tools for managing database migrations and data transformations
            </p>

            <div className="space-y-6">
              {/* Search View Migration */}
              <div className="border border-gray-200 rounded-lg p-6 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                      Search View Migration
                    </h2>
                    <p className="text-gray-600 mb-4">
                      Migrate the transcript search index to exclude low-quality transcripts
                      (videos with only music/applause). This updates the materialized view
                      to filter out non-speech content from search results.
                    </p>

                    <div className="space-y-2 text-sm text-gray-700 mb-4">
                      <p><strong>Status:</strong> Required for low-quality transcript filtering</p>
                      <p><strong>Impact:</strong> Improves search quality by hiding music-only videos</p>
                      <p><strong>Time:</strong> ~5-15 minutes depending on database size</p>
                    </div>

                    <div className="flex gap-3">
                      <Link
                        href="/admin/check-migration"
                        className="inline-block px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                      >
                        Check Progress
                      </Link>
                      <Link
                        href="/admin/migrate-search-view"
                        className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        Run Migration
                      </Link>
                    </div>
                  </div>

                  <div className="ml-6 flex-shrink-0">
                    <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Future migrations can be added here */}
              <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                <div className="text-center text-gray-500">
                  <p className="text-sm">No additional migrations available at this time</p>
                </div>
              </div>
            </div>

            {/* Documentation Section */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Migration Documentation
              </h3>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-blue-900 mb-2">Before Running Migrations</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Ensure you have database backup capabilities</li>
                  <li>Check migration prerequisites in Supabase</li>
                  <li>Review migration documentation files</li>
                  <li>Understand the impact on your application</li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-900 mb-2">Migration Support</h4>
                <p className="text-sm text-yellow-800">
                  If you encounter issues during migration, check the console logs and refer to
                  the <code className="bg-yellow-100 px-1 py-0.5 rounded">MIGRATE_SEARCH_VIEW.md</code> file
                  in the project root for detailed troubleshooting steps.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
