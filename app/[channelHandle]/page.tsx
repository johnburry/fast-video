'use client';

import { use, useState, useEffect } from 'react';
import { formatTimestamp } from '@/lib/youtube/transcript';

interface SearchResult {
  videoId: string;
  youtubeVideoId: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  duration: number;
  channel: {
    id: string;
    handle: string;
    name: string;
    thumbnail: string;
  };
  matches: Array<{
    transcriptId: string;
    text: string;
    startTime: number;
    duration: number;
  }>;
}

interface ChannelData {
  channel: {
    id: string;
    youtubeChannelId: string;
    handle: string;
    name: string;
    description: string;
    thumbnail: string;
    subscriberCount: number;
    videoCount: number;
    lastSynced: string;
  };
  recentVideos: Array<any>;
}

export default function ChannelPage({
  params,
}: {
  params: Promise<{ channelHandle: string }>;
}) {
  const { channelHandle } = use(params);
  const [channelData, setChannelData] = useState<ChannelData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [channelLoading, setChannelLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<{
    youtubeVideoId: string;
    startTime?: number;
  } | null>(null);

  useEffect(() => {
    fetchChannelData();
  }, [channelHandle]);

  const fetchChannelData = async () => {
    try {
      setChannelLoading(true);
      const response = await fetch(`/api/channels/${channelHandle}`);

      if (!response.ok) {
        throw new Error('Channel not found');
      }

      const data = await response.json();
      setChannelData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load channel');
    } finally {
      setChannelLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchQuery.trim()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}&channel=${channelHandle}`
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setSearchResults(data.results);

      // Scroll to top when search results are loaded
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const openVideo = (youtubeVideoId: string, startTime?: number) => {
    setSelectedVideo({ youtubeVideoId, startTime });
  };

  const resetSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  if (channelLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading channel...</p>
        </div>
      </div>
    );
  }

  if (error && !channelData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Channel Not Found
          </h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <a
            href="/admin"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Import a channel →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Back Button Bar (shown when search results exist) */}
      {searchResults.length > 0 && (
        <div style={{ backgroundColor: '#165DFC', paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <button
              onClick={resetSearch}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity font-medium text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          </div>
        </div>
      )}

      {/* Channel Header */}
      <div style={{ backgroundColor: '#222529' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center space-x-4">
            {channelData?.channel.thumbnail && (
              <img
                src={channelData.channel.thumbnail}
                alt={channelData.channel.name}
                className="w-20 h-20 rounded-full"
              />
            )}
            <div>
              <p className="text-3xl text-orange-500 font-bold mb-2 flex items-center gap-3">
                <span className="text-3xl">🔍</span>
                FAST VIDEO SEARCH
              </p>
              <h1
                className="text-5xl font-black text-white cursor-pointer hover:text-blue-400 transition-colors"
                onClick={resetSearch}
              >
                {channelData?.channel.name}
              </h1>
              <p className="text-lg text-gray-300 mt-2 flex items-center gap-2">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                <span className="text-gray-400">YouTube Channel: </span>
                <a
                  href={`https://www.youtube.com/@${channelData?.channel.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer hover:text-blue-400 transition-colors"
                >
                  @{channelData?.channel.handle}
                </a>
              </p>
            </div>
          </div>
          {channelData?.channel.description && (
            <p className="mt-4 text-gray-300 max-w-3xl">
              {channelData.channel.description}
            </p>
          )}
        </div>
      </div>

      <div className="bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Search Bar */}
          <div className="mb-8">
            <form onSubmit={handleSearch} className="max-w-3xl mx-auto">
              <div className="flex gap-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search what's said..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg bg-white"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </form>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-6 pt-0 md:pt-0" style={{ paddingTop: '80px' }}>
              <h2 className="text-2xl font-bold text-white">
                Search Results ({searchResults.length})
              </h2>

              {searchResults.map((result) => (
                <div
                  key={result.videoId}
                  className="bg-white rounded-lg shadow-md overflow-hidden"
                >
                  <div className="flex flex-col md:flex-row">
                    <div className="md:w-80 flex-shrink-0">
                      <img
                        src={result.thumbnail}
                        alt={result.title}
                        className="w-full h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => openVideo(result.youtubeVideoId)}
                      />
                    </div>
                    <div className="p-6 flex-1">
                      <h3
                        className="text-xl font-semibold text-gray-900 mb-2 cursor-pointer hover:text-blue-600 transition-colors"
                        onClick={() => openVideo(result.youtubeVideoId)}
                      >
                        {result.title}
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">
                        {new Date(result.publishedAt).toLocaleDateString()}
                      </p>

                      <div className="space-y-3">
                        {result.matches.slice(0, 3).map((match) => (
                          <div
                            key={match.transcriptId}
                            className="border-l-4 border-blue-500 pl-4 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() =>
                              openVideo(result.youtubeVideoId, match.startTime)
                            }
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-blue-600">
                                {formatTimestamp(match.startTime)}
                              </span>
                            </div>
                            <p className="text-gray-700">{match.text}</p>
                          </div>
                        ))}
                        {result.matches.length > 3 && (
                          <p className="text-sm text-gray-500">
                            + {result.matches.length - 3} more matches
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No Results */}
          {searchQuery && searchResults.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-white text-lg">
                No results found for "{searchQuery}"
              </p>
            </div>
          )}

          {/* Recent Videos (shown when no search) */}
          {!searchQuery && channelData?.recentVideos && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">
                Recent Videos
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {channelData.recentVideos.map((video) => (
                  <div
                    key={video.id}
                    className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => openVideo(video.youtube_video_id)}
                  >
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-full h-48 object-cover"
                    />
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                        {video.title}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {new Date(video.published_at).toLocaleDateString()}
                      </p>
                      {video.has_transcript && (
                        <span className="inline-block mt-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          Transcript Available
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Video Player Modal */}
      {selectedVideo && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedVideo(null)}
        >
          <div className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setSelectedVideo(null)}
                className="px-6 py-2 text-white rounded-lg hover:opacity-80 transition-opacity"
                style={{ backgroundColor: '#165DFC' }}
              >
                Close
              </button>
            </div>
            <div className="bg-white rounded-lg overflow-hidden">
              <div className="aspect-video">
                <iframe
                  src={`https://www.youtube.com/embed/${selectedVideo.youtubeVideoId}${
                    selectedVideo.startTime
                      ? `?start=${Math.floor(selectedVideo.startTime)}`
                      : ''
                  }`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
