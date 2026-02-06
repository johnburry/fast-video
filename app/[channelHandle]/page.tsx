'use client';

import { use, useState, useEffect, ReactElement } from 'react';
import { formatTimestamp } from '@/lib/youtube/transcript';
import MuxPlayer from '@mux/mux-player-react';
import { getThumbnailUrl } from '@/lib/thumbnail';

// Helper function to process channel names with line break character
function formatChannelName(name: string): ReactElement[] {
  const parts = name.split('|');
  return parts.map((part, index) => (
    <span key={index}>
      {part.trim()}
      {index < parts.length - 1 && <br />}
    </span>
  ));
}

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

interface VideoQuote {
  id?: string;
  text: string;
  startTime: number;
  duration: number;
  index: number;
}

interface ChannelData {
  channel: {
    id: string;
    youtubeChannelId: string;
    handle: string;
    youtubeHandle?: string;
    name: string;
    description: string;
    thumbnail: string;
    subscriberCount: number;
    videoCount: number;
    lastSynced: string;
    externalLink?: string;
    externalLinkName?: string;
    helloVideoUrl?: string;
    subscriptionType?: string;
    isMusicChannel?: boolean;
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
    videoId?: string; // Internal video ID for fetching quotes
    transcriptId?: string; // ID of the transcript segment for sharing
  } | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showHelloVideo, setShowHelloVideo] = useState(false);
  const [hasShownHelloVideo, setHasShownHelloVideo] = useState(false);
  const [muxVideoId, setMuxVideoId] = useState<string | null>(null);
  const [videoTimeRemaining, setVideoTimeRemaining] = useState<number | null>(null);
  const [hasWatchedVideo, setHasWatchedVideo] = useState(false);
  const [watchedVideoId, setWatchedVideoId] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [videoQuotes, setVideoQuotes] = useState<VideoQuote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);

  useEffect(() => {
    fetchChannelData();

    // Check for ?v= query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const videoParam = urlParams.get('v');
    if (videoParam) {
      setMuxVideoId(videoParam);
    }
  }, [channelHandle]);

  // Auto-show hello video when channel data loads (only once)
  useEffect(() => {
    if (channelData?.channel.helloVideoUrl && !hasShownHelloVideo) {
      setShowHelloVideo(true);
      setHasShownHelloVideo(true);
    }
  }, [channelData, hasShownHelloVideo]);

  useEffect(() => {
    if (channelData?.channel.name) {
      // Get tenant name from hostname
      const hostname = window.location.hostname;
      const parts = hostname.split('.');

      // Extract tenant domain (e.g., "fast.video" from "channel.fast.video")
      let tenantDomain = hostname;
      if (parts.length >= 3) {
        tenantDomain = parts.slice(-2).join('.'); // Get last 2 parts (e.g., "fast.video")
      }

      // Capitalize first letter for display
      const tenantName = tenantDomain.split('.')[0].charAt(0).toUpperCase() + tenantDomain.split('.')[0].slice(1);

      document.title = `🔍 ${channelData.channel.name} - ${tenantName}`;
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
      // Try hybrid search first (combines keyword + semantic AI search)
      // Falls back to keyword-only search if hybrid fails
      let response = await fetch(
        `/api/search/hybrid?q=${encodeURIComponent(searchQuery)}&channel=${channelHandle}`
      );

      // Fallback to keyword search if hybrid search fails
      if (!response.ok) {
        console.log('Hybrid search failed, falling back to keyword search');
        response = await fetch(
          `/api/search?q=${encodeURIComponent(searchQuery)}&channel=${channelHandle}`
        );
      }

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

  const openVideo = (youtubeVideoId: string, startTime?: number, matchText?: string, videoTitle?: string, videoId?: string, transcriptId?: string) => {
    setSelectedVideo({ youtubeVideoId, startTime, matchText, videoTitle, videoId, transcriptId });
  };

  // Fetch video quotes when a video is selected
  useEffect(() => {
    const fetchVideoQuotes = async () => {
      if (!selectedVideo || !selectedVideo.videoId) {
        setVideoQuotes([]);
        return;
      }

      setQuotesLoading(true);
      setQuotesError(null);

      try {
        const response = await fetch(`/api/quotes/${selectedVideo.videoId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch quotes');
        }

        const data = await response.json();
        setVideoQuotes(data.quotes || []);
      } catch (err) {
        console.error('Error fetching video quotes:', err);
        setQuotesError(err instanceof Error ? err.message : 'Failed to load quotes');
        setVideoQuotes([]);
      } finally {
        setQuotesLoading(false);
      }
    };

    fetchVideoQuotes();
  }, [selectedVideo?.videoId]);

  const resetSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
    setExpandedVideos(new Set());
    // Remove query string from URL (keep clean subdomain URL)
    window.history.pushState({}, '', '/');
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

  const copyVideoLocationToClipboard = async () => {
    if (!selectedVideo) return;

    const startTime = selectedVideo.startTime ? Math.floor(selectedVideo.startTime) : 0;
    const url = `https://www.youtube.com/watch?v=${selectedVideo.youtubeVideoId}&t=${startTime}s`;

    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
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
          <h1 className="text-2xl font-bold text-gray-900">
            Channel Not Found
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative">
      {/* Invisible navigation button to all.playsermons.com */}
      <a
        href="https://all.playsermons.com"
        className="fixed top-0 left-0 w-5 h-5 z-[100] opacity-0 hover:opacity-0"
        aria-label="View all channels"
      />

      {/* Replay Video Button (shown after watching a Fast Video) */}
      {hasWatchedVideo && !muxVideoId && watchedVideoId && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <button
            onClick={() => setMuxVideoId(watchedVideoId)}
            className="px-6 py-3 text-white font-semibold rounded-lg shadow-lg transition-colors flex items-center gap-2"
            style={{ backgroundColor: '#FF0000' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#CC0000'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FF0000'}
          >
            <svg className="w-5 h-5" fill="white" viewBox="0 0 24 24">
              <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
            </svg>
            Replay Fast Video
          </button>
        </div>
      )}

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
        <div style={{ backgroundColor: '#ffffff', paddingTop: hasWatchedVideo && !muxVideoId && watchedVideoId ? '4.5rem' : '0.5rem' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
            {/* Mobile: Stack vertically, Desktop: Two columns */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              {/* Left: Thumbnail and Channel Title */}
              <div className="flex items-center space-x-4">
                {channelData?.channel.thumbnail && (
                  <img
                    src={getThumbnailUrl(channelData.channel.thumbnail)}
                    alt={channelData.channel.name}
                    className="w-35 h-35 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ width: '140px', height: '140px' }}
                    onClick={resetSearch}
                  />
                )}
                <div>
                  <h1
                    className="text-2xl md:text-5xl font-black cursor-pointer transition-colors"
                    style={{ color: '#000000' }}
                    onClick={resetSearch}
                  >
                    {channelData?.channel.name && formatChannelName(channelData.channel.name)}
                  </h1>
                  {/* Hidden: View Pricing Plans button - uncomment to restore */}
                  {/* {(!channelData?.channel.subscriptionType || channelData.channel.subscriptionType === 'trial') && (
                    <div className="mt-2">
                      <a
                        href={`/${channelHandle}/pricing`}
                        className="inline-block px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors text-sm md:text-base"
                      >
                        View Pricing Plans
                      </a>
                      <p className="text-xs text-gray-500 mt-1">
                        This button is removed with a subscription
                      </p>
                    </div>
                  )} */}
                </div>
              </div>

              {/* Right: Links and Actions - centered on mobile, column on desktop */}
              <div className="flex justify-center md:justify-start">
                <div className="text-base md:text-xl flex flex-col gap-2 md:gap-3" style={{ color: '#777777' }}>
              <div className="flex items-center gap-1 md:gap-2">
                    <svg className="w-6 h-6 md:w-7 md:h-7" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    <a
                      href={`https://www.youtube.com/@${channelData?.channel.youtubeHandle || channelData?.channel.handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline cursor-pointer hover:text-blue-400 transition-colors"
                    >
                      YouTube Channel
                    </a>
                  </div>
                  {channelData?.channel.externalLink && channelData?.channel.externalLinkName && (
                    <div className="flex items-center gap-1 md:gap-2">
                      <svg className="w-6 h-6 md:w-7 md:h-7" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                      </svg>
                      <a
                        href={channelData.channel.externalLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline cursor-pointer hover:text-blue-400 transition-colors"
                      >
                        {channelData.channel.externalLinkName}
                      </a>
                    </div>
                  )}
                  {/* Hidden: Record a Fast Video button - uncomment to restore */}
                  {/* <a
                    href="/record"
                    className="flex items-center gap-2 md:gap-3 px-4 py-2 md:px-6 md:py-3 bg-white border-2 rounded-lg hover:bg-gray-50 transition-colors"
                    style={{ borderColor: '#FF0000' }}
                  >
                    <svg className="w-8 h-8 md:w-12 md:h-12 flex-shrink-0" viewBox="0 0 530 510" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="530" height="510" rx="100" fill="#E02020"/>
                      <path d="M80 180C80 152.386 102.386 130 130 130H330C357.614 130 380 152.386 380 180V330C380 357.614 357.614 380 330 380H130C102.386 380 80 357.614 80 330V180Z" fill="white"/>
                      <path d="M380 210L450 160V350L380 300V210Z" fill="white"/>
                    </svg>
                    <span className="font-bold text-sm md:text-2xl" style={{ color: '#FF0000' }}>
                      Record a Fast Video
                    </span>
                  </a> */}
                </div>
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
                  placeholder={channelData?.channel.isMusicChannel ? "Search all video titles" : "Search all video transcripts"}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg bg-white placeholder-gray-500"
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
                  <div className="flex flex-col md:flex-row md:items-start">
                    <div className="md:w-80 flex-shrink-0" style={{ backgroundColor: '#000000', minHeight: '184px' }}>
                      <div className="relative w-full" style={{ paddingBottom: '56.25%', minHeight: '184px' }}>
                        <img
                          src={getThumbnailUrl(result.thumbnail, result.youtubeVideoId)}
                          alt={result.title}
                          className="absolute top-0 left-0 w-full h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                          style={{ borderTopLeftRadius: '25px', borderBottomLeftRadius: '25px' }}
                          onClick={() => firstMatch
                            ? openVideo(result.youtubeVideoId, firstMatch.startTime, firstMatch.text, result.title, result.videoId, firstMatch.transcriptId)
                            : openVideo(result.youtubeVideoId, undefined, undefined, result.title, result.videoId)
                          }
                        />
                      </div>
                    </div>
                    <div className="p-6 flex-1" style={{ paddingTop: '0' }}>
                      <h3
                        className="text-xl font-semibold text-gray-900 mb-2 cursor-pointer hover:text-blue-600 transition-colors"
                        style={{ marginTop: '1.5rem' }}
                        onClick={() => firstMatch
                          ? openVideo(result.youtubeVideoId, firstMatch.startTime, firstMatch.text, result.title, result.videoId, firstMatch.transcriptId)
                          : openVideo(result.youtubeVideoId, undefined, undefined, result.title, result.videoId)
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
                              openVideo(result.youtubeVideoId, match.startTime, match.text, result.title, result.videoId, match.transcriptId)
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
                Latest YouTube Videos ({channelData.recentVideos.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {channelData.recentVideos.slice(0, visibleVideoCount).map((video) => (
                  <div
                    key={video.id}
                    className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => openVideo(video.youtube_video_id, undefined, undefined, video.title, video.id)}
                  >
                    <div className="relative w-full bg-black" style={{ paddingBottom: '56.25%' }}>
                      <img
                        src={getThumbnailUrl(video.thumbnail_url, video.youtube_video_id)}
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
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="inline-block text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            Transcript Available
                          </span>
                          <span className="inline-block text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            Quote Sharing Available
                          </span>
                        </div>
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

        {/* Footer */}
        <div className="py-8 text-center border-t border-gray-800">
          <p className="text-gray-400 text-sm">
            Built by{' '}
            <a
              href="https://reorbit.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-400 transition-colors"
            >
              Reorbit
            </a>
          </p>
        </div>
      </div>

      {/* Video Player Modal */}
      {selectedVideo && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-start justify-center z-50 p-4 overflow-y-auto"
          onClick={() => setSelectedVideo(null)}
        >
          <div className="max-w-7xl w-full my-8" onClick={(e) => e.stopPropagation()}>
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
                  <div
                    className="border-l-4 border-blue-500 pl-3 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => {
                      if (selectedVideo.youtubeVideoId && selectedVideo.startTime) {
                        // Reload the iframe with the timestamp and autoplay
                        const iframe = document.querySelector('iframe[src*="youtube.com/embed"]') as HTMLIFrameElement;
                        if (iframe) {
                          iframe.src = `https://www.youtube.com/embed/${selectedVideo.youtubeVideoId}?start=${Math.floor(selectedVideo.startTime)}&autoplay=1`;
                        }
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-blue-600">
                        {selectedVideo.startTime ? formatTimestamp(selectedVideo.startTime) : '0:00'}
                      </span>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#FF0000">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                      <span className="text-sm font-medium hover:underline" style={{ color: '#FF0000' }}>Play from here</span>
                    </div>
                    <p className="text-sm text-gray-700">{selectedVideo.matchText}</p>
                  </div>
                  <button
                    onClick={() => {
                      if (selectedVideo.videoId && selectedVideo.transcriptId) {
                        const locationUrl = `${window.location.origin}/location/${selectedVideo.videoId}/${selectedVideo.transcriptId}`;
                        navigator.clipboard.writeText(locationUrl).then(() => {
                          setCopySuccess(true);
                          setTimeout(() => setCopySuccess(false), 2000);
                        }).catch(err => {
                          console.error('Failed to copy:', err);
                        });
                      }
                    }}
                    className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {copySuccess ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        Share
                      </>
                    )}
                  </button>
                  <a
                    href={`/record?dest=${encodeURIComponent(
                      `https://www.youtube.com/watch?v=${selectedVideo.youtubeVideoId}&t=${selectedVideo.startTime ? Math.floor(selectedVideo.startTime) : 0}s`
                    )}`}
                    className="mt-3 w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 530 510" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="530" height="510" rx="100" fill="white"/>
                      <path d="M80 180C80 152.386 102.386 130 130 130H330C357.614 130 380 152.386 380 180V330C380 357.614 357.614 380 330 380H130C102.386 380 80 357.614 80 330V180Z" fill="#E02020"/>
                      <path d="M380 210L450 160V350L380 300V210Z" fill="#E02020"/>
                    </svg>
                    Record a Fast Video for this
                  </a>
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

            {/* AI-Generated Powerful Quotes Section */}
            {selectedVideo.videoId && (
              <div className="mt-6">
                {quotesLoading && (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
                    <p className="text-white text-sm">Analyzing video transcript for powerful quotes...</p>
                  </div>
                )}


                {!quotesLoading && !quotesError && videoQuotes.length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold text-white mb-4">
                      Best Quotes from this Video
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {videoQuotes.map((quote) => (
                        <div
                          key={quote.index}
                          className="bg-white rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow relative"
                        >
                          <div className="flex items-start gap-3 mb-12">
                            <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-base">
                              {quote.index}
                            </div>
                            <div className="flex-1">
                              <p className="text-gray-900 text-base mb-3 leading-relaxed">{quote.text}</p>
                              <button
                                onClick={() => {
                                  // Start 3 seconds before the quote to give context
                                  const startTime = Math.max(0, Math.floor(quote.startTime - 3));

                                  // On iOS, open in YouTube app for better autoplay support
                                  // On desktop, try to update iframe
                                  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

                                  if (isIOS) {
                                    // Open in YouTube app/browser on iOS
                                    window.open(`https://www.youtube.com/watch?v=${selectedVideo.youtubeVideoId}&t=${startTime}s`, '_blank');
                                  } else {
                                    // Try to reload iframe on desktop
                                    const iframe = document.querySelector('iframe[src*="youtube.com/embed"]') as HTMLIFrameElement;
                                    if (iframe) {
                                      iframe.src = `https://www.youtube.com/embed/${selectedVideo.youtubeVideoId}?start=${startTime}&autoplay=1`;
                                    }
                                  }
                                }}
                                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                              >
                                <span className="text-sm font-medium text-blue-600">
                                  {formatTimestamp(quote.startTime)}
                                </span>
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#FF0000">
                                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                </svg>
                                <span className="text-sm hover:underline" style={{ color: '#FF0000' }}>Play from here</span>
                              </button>
                            </div>
                          </div>
                          {/* Share button positioned at bottom right */}
                          <button
                            onClick={(e: React.MouseEvent) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Generate quote page URL
                              const quoteUrl = `${window.location.origin}/quote/${selectedVideo.videoId}/${quote.index}`;
                              navigator.clipboard.writeText(quoteUrl).then(() => {
                                alert('Quote link copied to clipboard!');
                              }).catch(err => {
                                console.error('Failed to copy:', err);
                                alert('Failed to copy link');
                              });
                            }}
                            className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                          >
                            Share
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Record a Fast Video Modal */}
      {showRecordModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowRecordModal(false)}
        >
          <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setShowRecordModal(false)}
                className="px-6 py-2 text-white rounded-lg hover:opacity-80 transition-opacity"
                style={{ backgroundColor: '#165DFC' }}
              >
                Close
              </button>
            </div>
            <div className="bg-white rounded-lg overflow-hidden">
              <iframe
                src="https://stream.new/?access_token=fb0e4821-84e4-4ac3-967d-39b7474d616d"
                className="w-full"
                style={{ height: '80vh', minHeight: '600px' }}
                allow="camera; microphone; fullscreen"
                title="Record a Fast Video"
              />
            </div>
          </div>
        </div>
      )}

      {/* Hello Video Auto-Play Modal */}
      {showHelloVideo && channelData?.channel.helloVideoUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setShowHelloVideo(false)}
        >
          <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setShowHelloVideo(false)}
                className="px-6 py-2 text-white rounded-lg hover:opacity-80 transition-opacity"
                style={{ backgroundColor: '#165DFC' }}
              >
                Close
              </button>
            </div>
            <div className="bg-black rounded-lg overflow-hidden">
              <div className="aspect-video">
                <video
                  src={channelData.channel.helloVideoUrl}
                  className="w-full h-full"
                  controls
                  autoPlay
                  playsInline
                />
              </div>
            </div>
            <div className="mt-4 text-center">
              <p className="text-white text-sm">
                Welcome! After watching this message, explore the videos below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mux Video Modal (from ?v= parameter) */}
      {muxVideoId && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-start justify-center z-50 p-4"
          onClick={() => setMuxVideoId(null)}
        >
          <div className="w-full flex flex-col" style={{ maxWidth: '90vw', height: '80vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-lg overflow-hidden flex-1" style={{ backgroundColor: '#000' }}>
              <MuxPlayer
                playbackId={muxVideoId}
                streamType="on-demand"
                poster={`https://image.mux.com/${muxVideoId}/thumbnail.jpg?width=1200&height=675&fit_mode=smartcrop`}
                preload="metadata"
                onEnded={() => {
                  setHasWatchedVideo(true);
                  setWatchedVideoId(muxVideoId);
                  setMuxVideoId(null);
                }}
                onTimeUpdate={(e) => {
                  const video = e.target as HTMLVideoElement;
                  const remaining = Math.ceil(video.duration - video.currentTime);
                  setVideoTimeRemaining(remaining > 0 ? remaining : null);
                }}
                style={{ width: '100%', height: '100%', '--poster': 'auto' }}
              />
            </div>
            <div className="flex justify-between items-center mt-2">
              <div className="flex items-center gap-2">
                <span className="text-white">Up Next:</span>
                {channelData?.channel.thumbnail && (
                  <img
                    src={getThumbnailUrl(channelData.channel.thumbnail)}
                    alt={channelData.channel.name}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span className="text-gray-400">{channelData?.channel.name}</span>
              </div>
              <button
                onClick={() => setMuxVideoId(null)}
                className="px-6 py-2 text-white rounded-lg hover:opacity-80 transition-opacity"
                style={{ backgroundColor: '#165DFC' }}
              >
                {videoTimeRemaining !== null && videoTimeRemaining > 0
                  ? `Continue (${videoTimeRemaining}s) →`
                  : 'Continue →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
