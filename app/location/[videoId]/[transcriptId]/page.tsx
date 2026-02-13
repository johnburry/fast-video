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

  // Calculate start time (3 seconds before the location)
  const startTime = Math.max(0, Math.floor(location.startTime - 3));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Video Info Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Clip from video: {videoData.title}
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

          {/* Embedded YouTube Player */}
          <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ paddingBottom: '56.25%' }}>
            <iframe
              className="absolute top-0 left-0 w-full h-full"
              src={`https://www.youtube.com/embed/${videoData.youtube_video_id}?start=${startTime}&autoplay=1`}
              title={videoData.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </div>
  );
}
