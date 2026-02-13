'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { AdminToolbar } from '@/components/AdminToolbar';

interface LogEntry {
  type: 'status' | 'batch' | 'complete' | 'error';
  message: string;
  batch?: number;
  videosInBatch?: number;
  totalVideos?: number;
  offset?: number;
  batchCount?: number;
  timestamp: Date;
}

interface IndexStatus {
  indexedRows: number;
  totalEligibleVideos: number | null;
  needsRebuild: boolean;
}

export default function RebuildSearchIndexPage() {
  const { user, loading: authLoading } = useAuth();
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'FV Admin: Rebuild Search Index';
    if (user) fetchStatus();
  }, [user]);

  // Auto-scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const fetchStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await fetch('/api/admin/refresh-search-index');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Error fetching status:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  const startRebuild = async () => {
    setRunning(true);
    setLogs([]);

    try {
      const response = await fetch('/api/admin/refresh-search-index', {
        method: 'POST',
      });

      if (!response.body) {
        setLogs([{ type: 'error', message: 'No response body', timestamp: new Date() }]);
        setRunning(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            setLogs(prev => [...prev, { ...data, timestamp: new Date() }]);
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      setLogs(prev => [
        ...prev,
        { type: 'error', message: err instanceof Error ? err.message : 'Unknown error', timestamp: new Date() },
      ]);
    } finally {
      setRunning(false);
      fetchStatus();
    }
  };

  const completedBatches = logs.filter(l => l.type === 'batch').length;
  const lastBatch = [...logs].reverse().find(l => l.type === 'batch');
  const totalVideos = lastBatch?.totalVideos || 0;
  const videosProcessed = lastBatch ? (lastBatch.offset || 0) + (lastBatch.videosInBatch || 0) : 0;
  const progressPercent = totalVideos > 0 ? Math.round((videosProcessed / totalVideos) * 100) : 0;
  const isComplete = logs.some(l => l.type === 'complete');
  const hasError = logs.some(l => l.type === 'error');

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <p className="text-gray-600 text-center">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminToolbar />
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Rebuild Search Index
            </h1>
            <p className="text-gray-600 mb-8">
              Rebuilds the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">transcript_search_context</code> table
              by processing all videos in batches of {BATCH_SIZE}. This is needed after the migration or to fix stale search results.
            </p>

            {/* Current Status */}
            <div className="bg-gray-50 rounded-lg p-5 mb-6">
              <h2 className="font-semibold text-gray-900 mb-3">Current Index Status</h2>
              {statusLoading ? (
                <p className="text-gray-500 text-sm">Loading...</p>
              ) : status ? (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Indexed Rows</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {status.indexedRows.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Eligible Videos</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {status.totalEligibleVideos?.toLocaleString() ?? '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Status</div>
                    <div className={`text-2xl font-bold ${status.needsRebuild ? 'text-red-600' : 'text-green-600'}`}>
                      {status.needsRebuild ? 'Empty' : 'OK'}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-red-600 text-sm">Failed to load status</p>
              )}
            </div>

            {/* Action Button */}
            <div className="mb-6">
              <button
                onClick={startRebuild}
                disabled={running}
                className={`px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
                  running
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {running ? 'Rebuilding...' : 'Rebuild Search Index'}
              </button>
              {!running && (
                <button
                  onClick={fetchStatus}
                  className="ml-3 px-4 py-3 rounded-lg font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  Refresh Status
                </button>
              )}
            </div>

            {/* Progress Bar */}
            {running && totalVideos > 0 && (
              <div className="mb-6">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Batch {completedBatches} — {videosProcessed} of {totalVideos} videos</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Completion / Error Banner */}
            {isComplete && !hasError && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-medium">
                  Rebuild complete! {logs.find(l => l.type === 'complete')?.message}
                </p>
              </div>
            )}
            {hasError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 font-medium">
                  Error: {logs.find(l => l.type === 'error')?.message}
                </p>
              </div>
            )}

            {/* Log Output */}
            {logs.length > 0 && (
              <div>
                <h2 className="font-semibold text-gray-900 mb-3">Log</h2>
                <div className="bg-gray-900 rounded-lg p-4 max-h-[500px] overflow-y-auto font-mono text-sm">
                  {logs.map((entry, i) => (
                    <div
                      key={i}
                      className={`py-0.5 ${
                        entry.type === 'error'
                          ? 'text-red-400'
                          : entry.type === 'complete'
                          ? 'text-green-400'
                          : entry.type === 'status'
                          ? 'text-yellow-300'
                          : 'text-gray-300'
                      }`}
                    >
                      <span className="text-gray-500">
                        [{entry.timestamp.toLocaleTimeString()}]
                      </span>{' '}
                      {entry.type === 'batch'
                        ? `Batch ${entry.batch}: ${entry.message}`
                        : entry.message}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </div>
            )}

            {running && (
              <p className="text-gray-500 text-sm mt-4">
                Please keep this page open while the rebuild is in progress.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const BATCH_SIZE = 20;
