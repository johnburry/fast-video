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
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedVideos, setExpandedVideos] = useState<Set<string>>(new Set());
  const [visibleVideoCount, setVisibleVideoCount] = useState(20);
  const [selectedVideo, setSelectedVideo] = useState<{
    youtubeVideoId: string;
    startTime?: number;
    matchText?: string;
    videoTitle?: string;
  } | null>(null);

  useEffect(() => {
    fetchChannelData();
  }, [channelHandle]);

  useEffect(() => {
    if (channelData?.channel.handle) {
      document.title = `@${channelData.channel.handle} Fast Video Transcript Search`;
    }
  }, [channelData]);

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
    setHasSearched(true);

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

  const openVideo = (youtubeVideoId: string, startTime?: number, matchText?: string, videoTitle?: string) => {
    setSelectedVideo({ youtubeVideoId, startTime, matchText, videoTitle });
  };

  const resetSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
    setExpandedVideos(new Set());
  };

  const toggleExpandMatches = (videoId: string) => {
    setExpandedVideos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
  };

  const loadMoreVideos = () => {
    setVisibleVideoCount((prev) => prev + 30);
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
    <div className="min-h-screen bg-black relative">
      {/* Invisible navigation button to all.fast.video */}
      <a
        href="https://all.fast.video"
        className="fixed top-0 left-0 w-5 h-5 z-[100] opacity-0 hover:opacity-0"
        aria-label="View all channels"
      />

      {/* Back Button Bar (shown when search results exist) */}
      {searchResults.length > 0 && (
        <div
          style={{
            paddingTop: 'calc(env(safe-area-inset-top) + 11px)',
            paddingBottom: '12px'
          }}
          className="sticky top-0 z-50 bg-black"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <button
              onClick={resetSearch}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          </div>
        </div>
      )}

      {/* Channel Header - only show when no search results */}
      {searchResults.length === 0 && (
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
                <p className="text-lg md:text-3xl font-bold mb-2 flex items-center gap-2 md:gap-3" style={{ color: '#165DFC' }}>
                  <svg className="w-6 h-6 md:w-8 md:h-8" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="27" cy="27" r="12" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <line x1="35" y1="35" x2="48" y2="48" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
                  </svg>
                  FAST VIDEO TRANSCRIPT SEARCH
                </p>
                <h1
                  className="text-2xl md:text-5xl font-black text-white cursor-pointer hover:text-blue-400 transition-colors"
                  onClick={resetSearch}
                >
                  {channelData?.channel.name}
                </h1>
                <p className="text-xs md:text-lg text-gray-300 mt-2 flex items-center gap-1 md:gap-2">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  <a
                    href={`https://www.youtube.com/@${channelData?.channel.handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 underline cursor-pointer hover:text-blue-400 transition-colors"
                  >
                    YouTube Channel:
                  </a>
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
          </div>
        </div>
      )}

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
            <div className="space-y-8">
              <h2 className="text-2xl font-bold text-white">
                Search Results ({searchResults.length})
              </h2>

              {searchResults.map((result) => {
                // If there are transcript matches, use the first match's start time
                const firstMatch = result.matches.length > 0 ? result.matches[0] : null;

                return (
                <div
                  key={result.videoId}
                  className="bg-white rounded-lg shadow-md overflow-hidden"
                >
                  <div className="flex flex-col md:flex-row">
                    <div className="md:w-80 flex-shrink-0" style={{ backgroundColor: '#222529' }}>
                      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                        <img
                          src={result.thumbnail}
                          alt={result.title}
                          className="absolute top-0 left-0 w-full h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => firstMatch
                            ? openVideo(result.youtubeVideoId, firstMatch.startTime, firstMatch.text, result.title)
                            : openVideo(result.youtubeVideoId)
                          }
                        />
                      </div>
                    </div>
                    <div className="p-6 flex-1">
                      <h3
                        className="text-xl font-semibold text-gray-900 mb-2 cursor-pointer hover:text-blue-600 transition-colors"
                        onClick={() => firstMatch
                          ? openVideo(result.youtubeVideoId, firstMatch.startTime, firstMatch.text, result.title)
                          : openVideo(result.youtubeVideoId)
                        }
                      >
                        {result.title}
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">
                        {new Date(result.publishedAt).toLocaleDateString()}
                      </p>

                      <div className="space-y-3">
                        {(expandedVideos.has(result.videoId)
                          ? result.matches
                          : result.matches.slice(0, 3)
                        ).map((match) => (
                          <div
                            key={match.transcriptId}
                            className="border-l-4 border-blue-500 pl-4 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() =>
                              openVideo(result.youtubeVideoId, match.startTime, match.text, result.title)
                            }
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-blue-600">
                                {formatTimestamp(match.startTime)}
                              </span>
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                              </svg>
                              <span className="text-sm text-gray-600">Play from here</span>
                            </div>
                            <p className="text-gray-700">{match.text}</p>
                          </div>
                        ))}
                        {result.matches.length > 3 && (
                          <button
                            onClick={() => toggleExpandMatches(result.videoId)}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                          >
                            {expandedVideos.has(result.videoId)
                              ? 'Show less'
                              : `+ ${result.matches.length - 3} more matches`}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {/* No Results */}
          {hasSearched && searchResults.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-white text-lg">
                No results found for "{searchQuery}"
              </p>
            </div>
          )}

          {/* All Videos (shown when no search) */}
          {!searchQuery && channelData?.recentVideos && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">
                Latest Videos ({channelData.recentVideos.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {channelData.recentVideos.slice(0, visibleVideoCount).map((video) => (
                  <div
                    key={video.id}
                    className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => openVideo(video.youtube_video_id)}
                  >
                    <div className="relative w-full bg-black" style={{ paddingBottom: '56.25%' }}>
                      <img
                        src={video.thumbnail_url}
                        alt={video.title}
                        className="absolute top-0 left-0 w-full h-full object-contain"
                      />
                    </div>
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
              {visibleVideoCount < channelData.recentVideos.length && (
                <div className="mt-8 text-center">
                  <button
                    onClick={loadMoreVideos}
                    className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Load More ({Math.min(30, channelData.recentVideos.length - visibleVideoCount)} more)
                  </button>
                </div>
              )}
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
          <div className="max-w-7xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setSelectedVideo(null)}
                className="px-6 py-2 text-white rounded-lg hover:opacity-80 transition-opacity"
                style={{ backgroundColor: '#165DFC' }}
              >
                Close
              </button>
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              {/* Context sidebar - only show if we have match text */}
              {selectedVideo.matchText && (
                <div className="w-full md:w-80 bg-white rounded-lg p-4 flex-shrink-0">
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm">
                    Playing from:
                  </h3>
                  {selectedVideo.videoTitle && (
                    <p className="text-sm font-medium text-gray-700 mb-3">
                      {selectedVideo.videoTitle}
                    </p>
                  )}
                  <div className="border-l-4 border-blue-500 pl-3 py-2 bg-gray-50">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-blue-600">
                        {selectedVideo.startTime ? formatTimestamp(selectedVideo.startTime) : '0:00'}
                      </span>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                      <span className="text-sm text-gray-600">Play from here</span>
                    </div>
                    <p className="text-sm text-gray-700">{selectedVideo.matchText}</p>
                  </div>
                </div>
              )}
              {/* Video player */}
              <div className="flex-1 bg-white rounded-lg overflow-hidden">
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
        </div>
      )}
    </div>
  );
}
