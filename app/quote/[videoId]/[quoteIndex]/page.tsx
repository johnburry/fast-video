'use client';

import { use, useState, useEffect } from 'react';
import { formatTimestamp } from '@/lib/youtube/transcript';
import { getThumbnailUrl } from '@/lib/thumbnail';

interface VideoQuote {
  id?: string;
  text: string;
  startTime: number;
  duration: number;
  index: number;
}

interface VideoData {
  id: string;
  youtube_video_id: string;
  title: string;
  thumbnail_url: string;
  channel: {
    channel_handle: string;
    channel_name: string;
  };
}

export default function QuotePage({
  params,
}: {
  params: Promise<{ videoId: string; quoteIndex: string }>;
}) {
  const { videoId, quoteIndex } = use(params);
  const [quotes, setQuotes] = useState<VideoQuote[]>([]);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch video data
        const videoResponse = await fetch(`/api/videos/by-id/${videoId}`);
        if (!videoResponse.ok) throw new Error('Failed to fetch video');
        const video = await videoResponse.json();
        setVideoData(video);

        // Fetch quotes
        const quotesResponse = await fetch(`/api/quotes/${videoId}`);
        if (!quotesResponse.ok) throw new Error('Failed to fetch quotes');
        const quotesData = await quotesResponse.json();
        setQuotes(quotesData.quotes || []);
      } catch (err) {
        console.error('Error fetching quote page data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load quote');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [videoId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading quote...</p>
        </div>
      </div>
    );
  }

  if (!videoData) {
    return null;
  }

  if (quotes.length === 0) {
    return null;
  }

  // Find the featured quote (the one being shared)
  const featuredQuoteIndex = parseInt(quoteIndex, 10);
  const featuredQuote = quotes.find(q => q.index === featuredQuoteIndex);
  const otherQuotes = quotes.filter(q => q.index !== featuredQuoteIndex);

  if (!featuredQuote) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Quote Not Found</h1>
          <p className="text-gray-600">This quote does not exist.</p>
        </div>
      </div>
    );
  }

  const handleQuoteClick = (quote: VideoQuote) => {
    // Navigate to channel page with video modal and timestamp
    const startTime = Math.max(0, Math.floor(quote.startTime - 3));
    window.location.href = `https://www.youtube.com/watch?v=${videoData.youtube_video_id}&t=${startTime}s`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Video Info Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Quote from: {videoData.title}
          </h1>
          <p className="text-gray-600">
            From{' '}
            <a
              href={`/${videoData.channel.channel_handle}`}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {videoData.channel.channel_name}
            </a>
          </p>
        </div>

        {/* Featured Quote Card (Quote #1) */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
              1
            </div>
            <div className="flex-1">
              <p className="text-gray-900 text-xl leading-relaxed mb-4">{featuredQuote.text}</p>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-base font-medium text-blue-600">
                  {formatTimestamp(featuredQuote.startTime)}
                </span>
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#FF0000">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                <span className="text-base" style={{ color: '#FF0000' }}>Play from here</span>
              </div>
            </div>
          </div>

          {/* Video Thumbnail */}
          <div
            className="relative w-full bg-black rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
            style={{ paddingBottom: '56.25%' }}
            onClick={() => handleQuoteClick(featuredQuote)}
          >
            <img
              src={getThumbnailUrl(videoData.thumbnail_url, videoData.youtube_video_id)}
              alt={videoData.title}
              className="absolute top-0 left-0 w-full h-full object-contain"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors">
                <svg className="w-10 h-10 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleQuoteClick(featuredQuote)}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg"
          >
            Watch Full Video
          </button>
        </div>

        {/* More Quotes Section */}
        {otherQuotes.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              More Quotes from this Video
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {otherQuotes.map((quote) => (
                <div
                  key={quote.index}
                  className="bg-white rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow cursor-pointer relative"
                  onClick={() => handleQuoteClick(quote)}
                >
                  <div className="flex items-start gap-3 mb-12">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-base">
                      {quote.index}
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-900 text-base mb-3 leading-relaxed">{quote.text}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-blue-600">
                          {formatTimestamp(quote.startTime)}
                        </span>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#FF0000">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                        <span className="text-sm hover:underline" style={{ color: '#FF0000' }}>Play from here</span>
                      </div>
                    </div>
                  </div>
                  {/* Share button for other quotes */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const quoteUrl = `${window.location.origin}/quote/${videoId}/${quote.index}`;
                      navigator.clipboard.writeText(quoteUrl).then(() => {
                        alert('Quote link copied to clipboard!');
                      }).catch(err => {
                        console.error('Failed to copy:', err);
                        alert('Failed to copy link');
                      });
                    }}
                    className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm pointer-events-auto"
                    style={{ zIndex: 20 }}
                  >
                    Share
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
