'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatTimestamp } from '@/lib/youtube/transcript';
import { getThumbnailUrl } from '@/lib/thumbnail';

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

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedVideos, setExpandedVideos] = useState<Set<string>>(new Set());
  const [selectedVideo, setSelectedVideo] = useState<{
    youtubeVideoId: string;
    startTime?: number;
    matchText?: string;
    videoTitle?: string;
  } | null>(null);
  const [iframeRef, setIframeRef] = useState<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (query) {
      performSearch(query);
    }
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    setError(null);

    try {
      // Try hybrid search first (searches across ALL channels)
      let response = await fetch(
        `/api/search/hybrid?q=${encodeURIComponent(searchQuery)}&limit=50`
      );

      // Fallback to keyword search if hybrid fails
      if (!response.ok) {
        console.log('Hybrid search failed, falling back to keyword search');
        response = await fetch(
          `/api/search?q=${encodeURIComponent(searchQuery)}&limit=50`
        );
      }

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setSearchResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const openVideo = (youtubeVideoId: string, startTime?: number, matchText?: string, videoTitle?: string) => {
    setSelectedVideo({ youtubeVideoId, startTime, matchText, videoTitle });
  };

  const playFromTimestamp = (startTime: number) => {
    if (selectedVideo) {
      // Update the video with autoplay to immediately start playing at the new timestamp
      setSelectedVideo({
        ...selectedVideo,
        startTime: startTime
      });

      // Reset iframe ref to force reload
      setIframeRef(null);
    }
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

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="bg-white py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <a href="/" className="inline-block">
            <img
              src="/playsermons-logo-2.png"
              alt="PlaySermons"
              className="h-16 w-auto"
            />
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Query Display */}
        {query && (
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">
              Search Results for: "{query}"
            </h1>
            <p className="text-gray-400 mt-2">
              Searching across all church sermons
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-400">Searching...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <p className="text-red-400 text-lg">{error}</p>
          </div>
        )}

        {/* Search Results */}
        {!loading && searchResults.length > 0 && (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-white">
              Found {searchResults.length} results
            </h2>

            {searchResults.map((result) => {
              const firstMatch = result.matches.length > 0 ? result.matches[0] : null;

              return (
                <div
                  key={result.videoId}
                  className="bg-white rounded-lg shadow-md overflow-hidden"
                >
                  <div className="flex flex-col md:flex-row md:items-start">
                    <div className="md:w-80 flex-shrink-0" style={{ backgroundColor: '#000000', minHeight: '184px' }}>
                      <div className="relative w-full" style={{ paddingBottom: '56.25%', minHeight: '184px' }}>
                        <img
                          src={getThumbnailUrl(result.thumbnail, result.youtubeVideoId)}
                          alt={result.title}
                          className="absolute top-0 left-0 w-full h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                          style={{ borderTopLeftRadius: '25px', borderBottomLeftRadius: '25px' }}
                          onClick={() => firstMatch
                            ? openVideo(result.youtubeVideoId, firstMatch.startTime, firstMatch.text, result.title)
                            : openVideo(result.youtubeVideoId)
                          }
                        />
                      </div>
                    </div>
                    <div className="p-6 flex-1" style={{ paddingTop: '0' }}>
                      <h3
                        className="text-xl font-semibold text-gray-900 mb-2 cursor-pointer hover:text-blue-600 transition-colors"
                        style={{ marginTop: '1.5rem' }}
                        onClick={() => firstMatch
                          ? openVideo(result.youtubeVideoId, firstMatch.startTime, firstMatch.text, result.title)
                          : openVideo(result.youtubeVideoId)
                        }
                      >
                        {result.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        {result.channel.name}
                      </p>
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
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#FF0000">
                                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                              </svg>
                              <span className="text-sm" style={{ color: '#FF0000' }}>Play from here</span>
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
        {!loading && query && searchResults.length === 0 && !error && (
          <div className="text-center py-12">
            <p className="text-white text-lg">
              No results found for "{query}"
            </p>
            <p className="text-gray-400 mt-2">
              Try different keywords or check your spelling
            </p>
          </div>
        )}
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
                <div className="w-full md:w-80 bg-white rounded-lg p-4 flex-shrink-0" style={{ border: '3px solid red' }}>
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm">
                    Playing from: (SIDEBAR IS RENDERING - matchText: {selectedVideo.matchText ? 'YES' : 'NO'})
                  </h3>
                  {selectedVideo.videoTitle && (
                    <p className="text-sm font-medium text-gray-700 mb-3">
                      {selectedVideo.videoTitle}
                    </p>
                  )}
                  <div
                    className="border-l-4 border-blue-500 pl-3 py-2 cursor-pointer hover:bg-gray-100"
                    style={{ backgroundColor: 'yellow', minHeight: '100px' }}
                    onClick={() => {
                      alert('CLICKED! Time: ' + selectedVideo.startTime);
                      console.log('Div clicked!', selectedVideo.startTime);
                      if (selectedVideo.startTime) {
                        playFromTimestamp(selectedVideo.startTime);
                      }
                    }}
                    onMouseEnter={() => console.log('Mouse entered!')}
                    onMouseLeave={() => console.log('Mouse left!')}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-blue-600">
                        {selectedVideo.startTime ? formatTimestamp(selectedVideo.startTime) : '0:00'}
                      </span>
                      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="#FF0000">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                      <span className="text-sm font-medium hover:underline" style={{ color: '#FF0000' }}>
                        Play from here (CLICK THIS YELLOW AREA)
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{selectedVideo.matchText}</p>
                  </div>
                </div>
              )}
              {/* Video player */}
              <div className="flex-1 bg-white rounded-lg overflow-hidden">
                <div className="aspect-video">
                  <iframe
                    ref={(ref) => setIframeRef(ref)}
                    src={`https://www.youtube.com/embed/${selectedVideo.youtubeVideoId}${
                      selectedVideo.startTime
                        ? `?start=${Math.floor(selectedVideo.startTime)}&autoplay=1`
                        : '?autoplay=0'
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

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
