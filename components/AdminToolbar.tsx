'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminToolbar() {
  const { signOut } = useAuth();
  const pathname = usePathname();

  return (
    <div className="bg-gray-900 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link
              href="/admin"
              className={`text-sm font-medium transition-colors ${
                pathname === '/admin'
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Import
            </Link>
            <Link
              href="/all"
              className={`text-sm font-medium transition-colors ${
                pathname === '/all'
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              All Channels
            </Link>
          </div>
          <button
            onClick={signOut}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
