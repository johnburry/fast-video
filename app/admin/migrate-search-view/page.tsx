'use client';

import { useState, useEffect } from 'react';

export default function MigrateSearchViewPage() {
  const [stats, setStats] = useState<{
    source_count: number;
    dest_count: number;
    remaining: number;
  } | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [finalizeSql, setFinalizeSql] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [batchesProcessed, setBatchesProcessed] = useState(0);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/migrate-search-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_stats' }),
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 2000); // Update every 2 seconds
    return () => clearInterval(interval);
  }, []);

  const migrateBatch = async () => {
    try {
      const response = await fetch('/api/admin/migrate-search-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'migrate_batch' }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to migrate batch');
        setMigrating(false);
        return false;
      }

      if (data.completed) {
        setMessage('All data migrated! Click "Finalize Migration" to complete.');
        setMigrating(false);
        await fetchStats();
        return false; // Stop migration
      }

      setMessage(`Migrated ${data.rows_migrated} rows (total: ${data.total_migrated})`);
      await fetchStats();
      return true; // Continue migration
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setMigrating(false);
      return false;
    }
  };

  const startMigration = async () => {
    setMigrating(true);
    setError('');
    setMessage('Starting migration...');
    setBatchesProcessed(0);

    let shouldContinue = true;
    let batchCount = 0;

    while (shouldContinue) {
      batchCount++;
      setBatchesProcessed(batchCount);
      console.log(`[MIGRATION] Processing batch ${batchCount}...`);
      shouldContinue = await migrateBatch();

      if (shouldContinue) {
        // Small delay between batches to allow UI updates
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`[MIGRATION] Complete after ${batchCount} batches`);
  };

  const finalizeMigration = async () => {
    setFinalizing(true);
    setError('');
    setMessage('Generating finalization SQL...');

    try {
      const response = await fetch('/api/admin/migrate-search-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'finalize' }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to generate SQL');
        setFinalizing(false);
        return;
      }

      setFinalizeSql(data.sql);
      setMessage('Copy the SQL below and run it in Supabase SQL Editor to complete the migration.');
      setFinalizing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setFinalizing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(finalizeSql);
    setMessage('SQL copied to clipboard!');
  };

  const percentage = stats
    ? stats.source_count > 0
      ? Math.round((stats.dest_count / stats.source_count) * 100)
      : 0
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Migrate Search View
          </h1>

          <div className="mb-6">
            <p className="text-gray-600 mb-2">
              This tool migrates the transcript search index to exclude low-quality transcripts
              (videos with only music/applause).
            </p>
            <p className="text-sm text-gray-500">
              <strong>Prerequisites:</strong> You must have already run Step 2A in Supabase SQL Editor
              to create the empty <code>transcript_search_context_temp</code> table.
            </p>
          </div>

          {/* Stats */}
          {stats && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900">Migration Progress</h2>
                {lastUpdate && (
                  <span className="text-sm text-gray-500">
                    Last updated: {lastUpdate.toLocaleTimeString()}
                  </span>
                )}
              </div>
              {migrating && (
                <div className="mb-3 flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  <span className="text-sm text-blue-600 font-medium">
                    Processing batch {batchesProcessed}...
                  </span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-600">Source Rows</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {stats.source_count.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Migrated Rows</div>
                  <div className="text-2xl font-bold text-green-600">
                    {stats.dest_count.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Remaining</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {stats.remaining.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-green-600 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                >
                  <span className="text-xs text-white font-semibold flex items-center justify-center h-full">
                    {percentage}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Large remaining count warning */}
          {stats && stats.remaining > 100000 && !migrating && (
            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-5 mb-4">
              <h3 className="font-bold text-yellow-900 mb-2 flex items-center gap-2">
                <span className="text-2xl">⚠️</span>
                Large Number of Remaining Rows - Use SQL Instead
              </h3>
              <p className="text-yellow-800 mb-3">
                You have <strong>{stats.remaining.toLocaleString()} rows</strong> remaining.
                The API-based migration is too slow for this volume. Complete the migration instantly with SQL:
              </p>
              <div className="bg-yellow-900 p-4 rounded font-mono text-yellow-50 mb-3 overflow-x-auto whitespace-pre" style={{fontSize: '9px', lineHeight: '1.3'}}>
{`DO $$
DECLARE
  batch_size INT := 100000;
  rows_inserted INT;
  total_inserted INT := 0;
  batch_num INT := 0;
BEGIN
  CREATE TEMP TABLE missing_ids AS
  SELECT transcript_id FROM transcript_search_context_new
  EXCEPT
  SELECT transcript_id FROM transcript_search_context_temp;

  RAISE NOTICE 'Found % missing IDs', (SELECT COUNT(*) FROM missing_ids);
  CREATE INDEX idx_missing_ids ON missing_ids(transcript_id);

  LOOP
    batch_num := batch_num + 1;
    RAISE NOTICE 'Batch %', batch_num;

    WITH batch_to_insert AS (
      SELECT src.* FROM transcript_search_context_new src
      INNER JOIN missing_ids m ON m.transcript_id = src.transcript_id
      LIMIT batch_size
    )
    INSERT INTO transcript_search_context_temp
    SELECT * FROM batch_to_insert
    ON CONFLICT (transcript_id) DO NOTHING;

    GET DIAGNOSTICS rows_inserted = ROW_COUNT;
    total_inserted := total_inserted + rows_inserted;
    RAISE NOTICE 'Batch %: % rows (total: %)', batch_num, rows_inserted, total_inserted;

    DELETE FROM missing_ids WHERE transcript_id IN (
      SELECT transcript_id FROM transcript_search_context_temp
      ORDER BY transcript_id DESC LIMIT batch_size
    );

    EXIT WHEN rows_inserted = 0 OR (SELECT COUNT(*) FROM missing_ids) = 0;
    PERFORM pg_sleep(0.1);
  END LOOP;

  DROP TABLE missing_ids;
  RAISE NOTICE 'Complete! Total: %', total_inserted;
END $$;`}
              </div>
              <button
                onClick={() => {
                  const sql = `DO $$
DECLARE
  batch_size INT := 100000;
  rows_inserted INT;
  total_inserted INT := 0;
  batch_num INT := 0;
BEGIN
  CREATE TEMP TABLE missing_ids AS
  SELECT transcript_id FROM transcript_search_context_new
  EXCEPT
  SELECT transcript_id FROM transcript_search_context_temp;

  RAISE NOTICE 'Found % missing IDs', (SELECT COUNT(*) FROM missing_ids);
  CREATE INDEX idx_missing_ids ON missing_ids(transcript_id);

  LOOP
    batch_num := batch_num + 1;
    RAISE NOTICE 'Batch %', batch_num;

    WITH batch_to_insert AS (
      SELECT src.* FROM transcript_search_context_new src
      INNER JOIN missing_ids m ON m.transcript_id = src.transcript_id
      LIMIT batch_size
    )
    INSERT INTO transcript_search_context_temp
    SELECT * FROM batch_to_insert
    ON CONFLICT (transcript_id) DO NOTHING;

    GET DIAGNOSTICS rows_inserted = ROW_COUNT;
    total_inserted := total_inserted + rows_inserted;
    RAISE NOTICE 'Batch %: % rows (total: %)', batch_num, rows_inserted, total_inserted;

    DELETE FROM missing_ids WHERE transcript_id IN (
      SELECT transcript_id FROM transcript_search_context_temp
      ORDER BY transcript_id DESC LIMIT batch_size
    );

    EXIT WHEN rows_inserted = 0 OR (SELECT COUNT(*) FROM missing_ids) = 0;
    PERFORM pg_sleep(0.1);
  END LOOP;

  DROP TABLE missing_ids;
  RAISE NOTICE 'Complete! Total: %', total_inserted;
END $$;`;
                  navigator.clipboard.writeText(sql);
                  setMessage('Efficient SQL copied! Uses EXCEPT to pre-compute missing IDs and avoid timeout. Paste into Supabase SQL Editor. Watch NOTICE messages for progress.');
                }}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-semibold"
              >
                Copy Efficient SQL (Uses EXCEPT)
              </button>
              <p className="text-yellow-800 text-sm mt-3">
                Run this in <strong>Supabase SQL Editor</strong>. Uses EXCEPT to pre-compute missing IDs (fast), then processes 100k rows at a time.
                Watch the <strong>NOTICE</strong> messages for real-time progress updates.
              </p>
            </div>
          )}

          {/* Messages */}
          {message && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-blue-800">{message}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={startMigration}
              disabled={migrating || stats?.remaining === 0}
              className={`px-6 py-3 rounded-lg font-semibold ${
                migrating || stats?.remaining === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {migrating ? 'Migrating...' : 'Start Migration'}
            </button>

            <button
              onClick={finalizeMigration}
              disabled={finalizing}
              className={`px-6 py-3 rounded-lg font-semibold ${
                finalizing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : stats?.remaining === 0 || (stats?.remaining && stats.remaining < 1000)
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-orange-600 text-white hover:bg-orange-700'
              }`}
            >
              {finalizing ? 'Finalizing...' : stats?.remaining === 0 ? 'Finalize Migration' : 'Finalize Migration (Force)'}
            </button>
          </div>

          {/* Finalization SQL */}
          {finalizeSql && (
            <div className="mt-6 border-t pt-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900">Finalization SQL</h2>
                <button
                  onClick={copyToClipboard}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                >
                  Copy to Clipboard
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                {finalizeSql}
              </pre>
              <p className="text-sm text-gray-600 mt-2">
                Run this SQL in Supabase SQL Editor to complete the migration.
              </p>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 border-t pt-6">
            <h2 className="font-semibold text-gray-900 mb-3">Instructions</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-600">
              <li>Make sure you've run Step 2A in Supabase SQL Editor first</li>
              <li>Click "Start Migration" to begin copying data in batches</li>
              <li>Wait for all rows to be migrated (remaining = 0)</li>
              <li>Click "Finalize Migration" to get the SQL needed to complete the process</li>
              <li>Copy the SQL and run it in Supabase SQL Editor</li>
              <li>Done! Low-quality transcripts are now excluded from search</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
