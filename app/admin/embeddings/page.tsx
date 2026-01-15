'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { AdminToolbar } from '@/components/AdminToolbar';
import { supabase } from '@/lib/supabase/client';

interface ChannelEmbeddingStats {
  channelId: string;
  channelName: string;
  channelHandle: string;
  totalTranscripts: number;
  withEmbeddings: number;
  withoutEmbeddings: number;
  progress: number;
}

export default function EmbeddingsAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [channels, setChannels] = useState<ChannelEmbeddingStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    document.title = 'FV Admin: AI Embeddings';
    if (user) {
      loadChannelStats();
    }
  }, [user]);

  const loadChannelStats = async () => {
    try {
      setLoading(true);

      // Get all channels
      const { data: channelsData, error: channelsError } = await supabase
        .from('channels')
        .select('id, channel_name, channel_handle')
        .eq('is_active', true)
        .order('channel_name');

      if (channelsError) throw channelsError;

      // For each channel, get embedding stats
      const stats: ChannelEmbeddingStats[] = [];
      for (const channel of channelsData || []) {
        // Get all video IDs for this channel
        const { data: videos } = await supabase
          .from('videos')
          .select('id')
          .eq('channel_id', channel.id);

        if (!videos || videos.length === 0) continue;

        const videoIds = videos.map(v => v.id);

        // Get transcript counts
        const { data: transcripts } = await supabase
          .from('transcripts')
          .select('id, embedding')
          .in('video_id', videoIds);

        const total = transcripts?.length || 0;
        const withEmbeddings = transcripts?.filter(t => t.embedding !== null).length || 0;

        stats.push({
          channelId: channel.id,
          channelName: channel.channel_name,
          channelHandle: channel.channel_handle,
          totalTranscripts: total,
          withEmbeddings,
          withoutEmbeddings: total - withEmbeddings,
          progress: total > 0 ? (withEmbeddings / total) * 100 : 0,
        });
      }

      setChannels(stats);
    } catch (error) {
      console.error('Error loading channel stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateEmbeddings = async (channelId: string) => {
    try {
      setGeneratingFor(channelId);
      setProgress({ ...progress, [channelId]: 'Getting videos...' });

      // Get all videos for this channel
      const { data: videos } = await supabase
        .from('videos')
        .select('id')
        .eq('channel_id', channelId);

      if (!videos || videos.length === 0) {
        setProgress({ ...progress, [channelId]: 'No videos found' });
        setGeneratingFor(null);
        return;
      }

      // Generate embeddings for each video
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        setProgress({
          ...progress,
          [channelId]: `Processing video ${i + 1}/${videos.length}...`
        });

        const response = await fetch('/api/embeddings/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            videoId: video.id,
            batchSize: 100,
          }),
        });

        if (!response.ok) {
          console.error(`Failed to generate embeddings for video ${video.id}`);
        }
      }

      setProgress({ ...progress, [channelId]: '✓ Complete' });
      setTimeout(() => {
        loadChannelStats();
        setGeneratingFor(null);
        setProgress({ ...progress, [channelId]: '' });
      }, 2000);
    } catch (error) {
      console.error('Error generating embeddings:', error);
      setProgress({ ...progress, [channelId]: '✗ Error' });
      setGeneratingFor(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminToolbar />
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  AI Embeddings Status
                </h1>
                <p className="text-gray-600">
                  Monitor and generate semantic search embeddings for channels
                </p>
              </div>
              <button
                onClick={loadChannelStats}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-blue-900 mb-1">
                    About AI Embeddings
                  </h3>
                  <p className="text-sm text-blue-800">
                    Embeddings enable semantic search, allowing users to find sermons by meaning and context, not just exact keywords.
                    Channels with embeddings can be searched using natural language queries like "dealing with anxiety" or "God's love".
                  </p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600">Loading channel statistics...</p>
              </div>
            ) : channels.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No channels found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {channels.map((channel) => (
                  <div
                    key={channel.channelId}
                    className="border border-gray-200 rounded-lg p-6 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {channel.channelName}
                        </h3>
                        <p className="text-sm text-gray-500">@{channel.channelHandle}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                          {channel.progress.toFixed(1)}%
                        </div>
                        <div className="text-sm text-gray-500">Complete</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-3 rounded-full transition-all duration-300 ${
                            channel.progress === 100
                              ? 'bg-green-500'
                              : channel.progress > 0
                              ? 'bg-blue-500'
                              : 'bg-gray-300'
                          }`}
                          style={{ width: `${channel.progress}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center p-3 bg-gray-50 rounded">
                        <div className="text-sm text-gray-600">Total</div>
                        <div className="text-xl font-semibold text-gray-900">
                          {channel.totalTranscripts.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded">
                        <div className="text-sm text-green-700">With Embeddings</div>
                        <div className="text-xl font-semibold text-green-900">
                          {channel.withEmbeddings.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-center p-3 bg-orange-50 rounded">
                        <div className="text-sm text-orange-700">Missing</div>
                        <div className="text-xl font-semibold text-orange-900">
                          {channel.withoutEmbeddings.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                      {progress[channel.channelId] && (
                        <span className="text-sm text-gray-600 italic">
                          {progress[channel.channelId]}
                        </span>
                      )}
                      <div className="flex-1"></div>
                      {channel.withoutEmbeddings > 0 && (
                        <button
                          onClick={() => generateEmbeddings(channel.channelId)}
                          disabled={generatingFor === channel.channelId}
                          className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                          {generatingFor === channel.channelId
                            ? 'Generating...'
                            : 'Generate Embeddings'}
                        </button>
                      )}
                      {channel.withoutEmbeddings === 0 && (
                        <div className="flex items-center gap-2 text-green-600">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="font-medium">All embeddings generated</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Cost Estimate */}
            {channels.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Cost Estimate</h3>
                <p className="text-sm text-gray-600">
                  Total transcripts:{' '}
                  {channels.reduce((sum, c) => sum + c.totalTranscripts, 0).toLocaleString()}
                  {' · '}
                  Estimated cost: $
                  {((channels.reduce((sum, c) => sum + c.totalTranscripts, 0) * 100 * 0.02) / 1000000).toFixed(4)}
                  {' '}
                  (using OpenAI text-embedding-3-small)
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
