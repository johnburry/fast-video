'use client';

import { use, useState, useEffect } from 'react';
import { formatTimestamp } from '@/lib/youtube/transcript';
import { getThumbnailUrl } from '@/lib/thumbnail';

interface TranscriptLocation {
  id: string;
  text: string;
  startTime: number;
  duration: number;
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

export default function LocationPage({
  params,
}: {
  params: Promise<{ videoId: string; transcriptId: string }>;
}) {
  const { videoId, transcriptId } = use(params);
  const [location, setLocation] = useState<TranscriptLocation | null>(null);
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

        // Fetch transcript location
        const locationResponse = await fetch(`/api/transcripts/${transcriptId}`);
        if (!locationResponse.ok) throw new Error('Failed to fetch location');
        const locationData = await locationResponse.json();
        setLocation(locationData);
      } catch (err) {
        console.error('Error fetching location page data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load location');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [videoId, transcriptId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading location...</p>
        </div>
      </div>
    );
  }

  if (!videoData || !location) {
    return null;
  }

  const handleLocationClick = () => {
    // Navigate to YouTube with timestamp
    const startTime = Math.max(0, Math.floor(location.startTime));
    window.location.href = `https://www.youtube.com/watch?v=${videoData.youtube_video_id}&t=${startTime}s`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Video Info Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Location from: {videoData.title}
          </h1>
          <p className="text-gray-600">
            From {videoData.channel.channel_name}
          </p>
        </div>

        {/* Featured Location Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="mb-6">
            <div className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-base font-medium text-blue-600">
                  {formatTimestamp(location.startTime)}
                </span>
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#FF0000">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                <span className="text-base" style={{ color: '#FF0000' }}>Play from here</span>
              </div>
              <p className="text-gray-900 text-xl leading-relaxed">{location.text}</p>
            </div>
          </div>

          {/* Video Thumbnail */}
          <div
            className="relative w-full bg-black rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
            style={{ paddingBottom: '56.25%' }}
            onClick={handleLocationClick}
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
            onClick={handleLocationClick}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg"
          >
            Watch Full Video
          </button>
        </div>
      </div>
    </div>
  );
}
