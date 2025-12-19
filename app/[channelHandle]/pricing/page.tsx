'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getThumbnailUrl } from '@/lib/thumbnail';
import HeadLinks from '@/app/[channelHandle]/head-links';

interface ChannelData {
  id: string;
  name: string;
  handle: string;
  description: string;
  thumbnail: string;
  subscriberCount: number;
  videoCount: number;
  shortName: string;
}

export default function PricingPage() {
  const params = useParams();
  const channelHandle = params.channelHandle as string;
  const [channelData, setChannelData] = useState<ChannelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  // Fetch channel data
  useEffect(() => {
    const fetchChannelData = async () => {
      try {
        const response = await fetch(`/api/channels/${channelHandle}`);
        if (response.ok) {
          const data = await response.json();
          // The API returns { channel: {...} }, so we need to extract the channel object
          setChannelData(data.channel);
        }
      } catch (error) {
        console.error('Error fetching channel data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChannelData();
  }, [channelHandle]);

  // Countdown timer to midnight
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);

      const difference = midnight.getTime() - now.getTime();

      if (difference > 0) {
        setTimeLeft({
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white text-xl">Loading...</p>
      </div>
    );
  }

  if (!channelData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white text-xl">Channel not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <HeadLinks />

      {/* Header with Channel Branding */}
      <div style={{ backgroundColor: '#000000' }} className="py-2 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex justify-center mb-4">
            <img
              src="https://reorbit.com/fast.video.png"
              alt="Fast.Video"
              className="h-48 md:h-64"
            />
          </div>
          <p className="text-2xl md:text-4xl text-gray-400 mb-4">
            a Reorbit, Inc. Service
          </p>
          <p className="text-lg md:text-xl text-gray-400 mb-8">
            Any questions? Email us at:{' '}
            <a href="mailto:hello@reorbit.com" className="text-blue-400 hover:text-blue-300 underline">
              hello@reorbit.com
            </a>
            {' '}or call{' '}
            <a href="tel:+14258006619" className="text-blue-400 hover:text-blue-300 underline">
              +1-425-800-6619
            </a>
          </p>

          {/* Anniversary Sale Countdown */}
          <div className="bg-red-600 text-white py-6 px-8 rounded-lg inline-block">
            <p className="text-xl md:text-2xl font-bold mb-3">
              🎉 Anniversary Sale Ends at Midnight! 🎉
            </p>
            <div className="flex gap-4 justify-center text-center">
              <div className="bg-black bg-opacity-30 rounded-lg p-4 min-w-[80px]">
                <div className="text-3xl md:text-4xl font-bold">{String(timeLeft.hours).padStart(2, '0')}</div>
                <div className="text-sm uppercase">Hours</div>
              </div>
              <div className="bg-black bg-opacity-30 rounded-lg p-4 min-w-[80px]">
                <div className="text-3xl md:text-4xl font-bold">{String(timeLeft.minutes).padStart(2, '0')}</div>
                <div className="text-sm uppercase">Minutes</div>
              </div>
              <div className="bg-black bg-opacity-30 rounded-lg p-4 min-w-[80px]">
                <div className="text-3xl md:text-4xl font-bold">{String(timeLeft.seconds).padStart(2, '0')}</div>
                <div className="text-sm uppercase">Seconds</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 pb-8" style={{ paddingTop: '0.2rem' }}>
        <div className="flex justify-center">
          <a
            href={`https://${channelData.handle}.fast.video`}
            className="bg-white rounded-lg p-6 flex flex-row items-center gap-6 mb-6 inline-block hover:shadow-lg transition-shadow cursor-pointer"
          >
          <img
            src={getThumbnailUrl(channelData.thumbnail)}
            alt={channelData.shortName || channelData.name}
            className="w-24 h-24 rounded-full"
          />
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
            {channelData.shortName || channelData.name}
            <br />
            <span className="text-red-600">YouTube Transcription Search and Fast.Video Service</span>
          </h2>
          </a>
        </div>
        <h2 className="text-4xl md:text-6xl font-bold text-white text-center mb-12">
          Subscription and One-Time Plans
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Intro Plan */}
          <div className="bg-gray-900 rounded-lg p-8 border-2 border-gray-700 hover:border-blue-500 transition-colors">
            <h3 className="text-2xl font-bold text-white mb-4">Intro Plan</h3>
            <div className="mb-6">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-bold text-white">$99</span>
                <span className="text-2xl text-gray-400">/year</span>
              </div>
              <div className="text-red-400 font-semibold">
                <span className="line-through text-gray-500">$199</span> Save $100!
              </div>
            </div>
            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3 text-gray-300">
                <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>YouTube index of your channel</span>
              </li>
              <li className="flex items-start gap-3 text-gray-300">
                <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Full video transcription search, allowing you and your customers to pinpoint and share exactly when something was said across all videos in your channel (not possible on YouTube!)</span>
              </li>
              <li className="flex items-start gap-3 text-gray-300">
                <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Create up to <strong className="text-white">100 Fast.Videos</strong> a month</span>
              </li>
            </ul>
            <a
              href="https://square.link/u/wf6U6Fux"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-colors text-center"
            >
              Get Started
            </a>
          </div>

          {/* Pro Plan - Featured */}
          <div className="bg-gradient-to-b from-blue-900 to-blue-800 rounded-lg p-8 border-2 border-blue-500 transform md:scale-105 shadow-2xl relative">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-bold">
              MOST POPULAR
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Pro Plan</h3>
            <div className="mb-6">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-bold text-white">$199</span>
                <span className="text-2xl text-blue-200">/year</span>
              </div>
              <div className="text-yellow-300 font-semibold">
                <span className="line-through text-blue-300">$399</span> Save $200!
              </div>
            </div>
            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3 text-white">
                <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>YouTube index of your channel</span>
              </li>
              <li className="flex items-start gap-3 text-white">
                <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Full video transcription search, allowing you and your customers to pinpoint and share exactly when something was said across all videos in your channel (not possible on YouTube!)</span>
              </li>
              <li className="flex items-start gap-3 text-white">
                <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Create up to <strong className="text-yellow-300">500 Fast.Videos</strong> a month</span>
              </li>
            </ul>
            <a
              href="https://square.link/u/81njSMLC"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-4 px-6 rounded-lg transition-colors text-center"
            >
              Get Started
            </a>
          </div>

          {/* Lifetime License */}
          <div className="bg-gray-900 rounded-lg p-8 border-2 border-purple-500 hover:border-purple-400 transition-colors">
            <h3 className="text-2xl font-bold text-white mb-4">Lifetime License</h3>
            <div className="mb-6">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-bold text-white">$499</span>
                <span className="text-2xl text-gray-400">one-time</span>
              </div>
              <div className="text-purple-400 font-semibold">
                <span className="line-through text-gray-500">$999</span> Save $500!
              </div>
            </div>
            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3 text-gray-300">
                <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span><strong className="text-white">No monthly or annual fees</strong> after purchase</span>
              </li>
              <li className="flex items-start gap-3 text-gray-300">
                <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Hosted for free on our servers with access to <strong className="text-white">download the code</strong> to host on yours forever</span>
              </li>
              <li className="flex items-start gap-3 text-gray-300">
                <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>YouTube index of your channel</span>
              </li>
              <li className="flex items-start gap-3 text-gray-300">
                <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Full video transcription search, allowing you and your customers to pinpoint and share exactly when something was said across all videos in your channel (not possible on YouTube!)</span>
              </li>
              <li className="flex items-start gap-3 text-gray-300">
                <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Create <strong className="text-white">unlimited Fast.Videos</strong> a month</span>
              </li>
            </ul>
            <a
              href="https://square.link/u/oFgPCR6x"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-6 rounded-lg transition-colors text-center"
            >
              Get Lifetime Access
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 py-8 px-4 mt-16">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Left side - Contact */}
            <div className="text-gray-400 text-sm md:text-base text-center md:text-left">
              Any questions? Email us at:{' '}
              <a href="mailto:hello@reorbit.com" className="text-blue-400 hover:text-blue-300 underline">
                hello@reorbit.com
              </a>
              {' '}or call{' '}
              <a href="tel:+14258006619" className="text-blue-400 hover:text-blue-300 underline">
                +1-425-800-6619
              </a>
            </div>

            {/* Right side - Copyright */}
            <div className="text-gray-400 text-sm md:text-base">
              Copyright Reorbit {new Date().getFullYear()}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
