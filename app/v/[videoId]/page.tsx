'use client';

import { use } from 'react';
import MuxPlayer from '@mux/mux-player-react';

export default function VideoPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = use(params);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Back Button Bar */}
      <div
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 11px)',
          paddingBottom: '12px'
        }}
        className="sticky top-0 z-50 bg-black"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <MuxPlayer
            playbackId={videoId}
            metadata={{
              video_title: 'Video',
            }}
            streamType="on-demand"
            autoPlay
          />
        </div>
      </div>
    </div>
  );
}
