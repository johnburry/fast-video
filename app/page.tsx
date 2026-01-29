'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTenantConfig } from '@/lib/hooks/useTenantConfig';

const FEATURED_CHANNEL_IDS = [
  'a5c701d0-fd07-44ff-b547-44dc61ac9cc9',
  '5213fa50-0dc8-4bb1-8b2b-0d393bdd51ab',
  '51066ca5-daa2-4056-a88d-210140957793'
];

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [channels, setChannels] = useState<any[]>([]);
  const [checkingDefaultChannel, setCheckingDefaultChannel] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const router = useRouter();
  const tenantConfig = useTenantConfig();

  useEffect(() => {
    // Determine if we're on a subdomain (not the root domain)
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const parts = hostname.split('.');
    const isSubdomain = parts.length > 2 && parts[0] !== 'www';

    // If channels gallery is enabled, skip redirect and default channel check
    // This takes priority over redirect URL
    if (!tenantConfig.isLoading && tenantConfig.channelsGallery) {
      setCheckingDefaultChannel(false);
      return;
    }

    // Check if tenant has a redirect URL and redirect immediately
    // BUT only if we're NOT on a subdomain (subdomains should try to load channels)
    if (!tenantConfig.isLoading && tenantConfig.redirectUrl && !isSubdomain && !tenantConfig.channelsGallery) {
      setIsRedirecting(true);
      window.location.href = tenantConfig.redirectUrl;
      return;
    }

    // Check if this tenant has a default channel (single channel without subdomain)
    const checkDefaultChannel = async () => {
      if (tenantConfig.isLoading) return;

      try {
        const response = await fetch('/api/channels/default');
        if (response.ok) {
          const data = await response.json();
          if (data.defaultChannel) {
            // Redirect to the default channel using handle OR id
            const channelPath = data.defaultChannel.handle || data.defaultChannel.id;
            setIsRedirecting(true); // Set flag before redirecting
            router.push(`/${channelPath}`);
            return;
          }
        }
      } catch (err) {
        console.error('Error checking default channel:', err);
      } finally {
        setCheckingDefaultChannel(false);
      }
    };

    checkDefaultChannel();
  }, [tenantConfig.isLoading, tenantConfig.redirectUrl, tenantConfig.channelsGallery, router]);

  useEffect(() => {
    // Fetch channels - either tenant channels for gallery or featured channels
    const fetchChannels = async () => {
      if (tenantConfig.isLoading) return;

      // If channels gallery is enabled, fetch all tenant channels
      if (tenantConfig.channelsGallery && tenantConfig.id) {
        const response = await fetch(`/api/admin/tenants/${tenantConfig.id}/channels`);
        if (response.ok) {
          const data = await response.json();
          setChannels(data.channels || []);
        }
      } else {
        // Otherwise fetch featured channels for marketing page
        const response = await fetch('/api/channels/featured');
        if (response.ok) {
          const data = await response.json();
          setChannels(data.channels || []);
        }
      }
    };
    fetchChannels();
  }, [tenantConfig.isLoading, tenantConfig.channelsGallery, tenantConfig.id]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  // Show nothing while loading or redirecting to prevent flash
  if (tenantConfig.isLoading || checkingDefaultChannel || isRedirecting) {
    return null;
  }

  // Channels Gallery View - shows when channels_gallery is enabled
  if (tenantConfig.channelsGallery) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header with Logo and Name */}
          <div className="text-center mb-12 w-full">
            {tenantConfig.logo.type === 'image' && tenantConfig.logo.imageUrl ? (
              <>
                <img
                  src={tenantConfig.logo.imageUrl}
                  alt={tenantConfig.logo.altText}
                  className="h-32 w-auto mx-auto mb-6"
                />
              </>
            ) : (
              <>
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6 px-4">
                  {tenantConfig.logo.text || tenantConfig.name}
                </h1>
                <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-semibold text-gray-800 mb-2 break-words leading-tight w-full">
                  {tenantConfig.name}
                </h2>
              </>
            )}
            {tenantConfig.tagline && (
              <p className="text-sm sm:text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-4">
                {tenantConfig.tagline}
              </p>
            )}
          </div>

          {/* Channels Grid */}
          {channels.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">No channels available yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {channels.map((channel) => (
                <a
                  key={channel.id}
                  href={`/${channel.handle || channel.id}`}
                  className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden border border-gray-200 hover:border-blue-400 group cursor-pointer"
                >
                  <div className="p-6">
                    <div className="flex items-center space-x-4 mb-4">
                      {channel.thumbnail && (
                        <img
                          src={channel.thumbnail}
                          alt={channel.name}
                          className="w-20 h-20 rounded-full object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                          {channel.name}
                        </h3>
                        {channel.handle && (
                          <p className="text-sm text-gray-500">@{channel.handle}</p>
                        )}
                      </div>
                    </div>
                    {channel.description && (
                      <p className="text-gray-600 text-sm line-clamp-3 mb-4">
                        {channel.description}
                      </p>
                    )}
                    <div className="flex items-center text-blue-600 font-medium text-sm group-hover:translate-x-1 transition-transform">
                      View Channel →
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Only PlaySermons.com gets the full marketing homepage
  // All other tenants (fast.video, audralambert.com, etc.) get a minimal search page
  if (tenantConfig.domain !== 'playsermons.com') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200">
        <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {/* Logo - respects tenant config */}
            <div className="mb-12">
              {tenantConfig.logo.type === 'image' ? (
                <img
                  src={tenantConfig.logo.imageUrl!}
                  alt={tenantConfig.logo.altText}
                  className="h-32 w-auto mx-auto"
                />
              ) : (
                <h1 className="text-8xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {tenantConfig.logo.text}
                </h1>
              )}
            </div>

            {/* Search Box */}
            <form onSubmit={handleSearch} className="max-w-3xl mx-auto">
              <div className="flex gap-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={tenantConfig.searchPlaceholder}
                  className="flex-1 px-6 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg bg-white placeholder-gray-500 shadow-lg"
                />
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-10 py-4 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg"
                >
                  Search
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // PlaySermons.com gets the full marketing homepage
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FFF' }}>
      {/* White top section - Logo only */}
      <div style={{ backgroundColor: '#FFF' }}>
        <div className="max-w-6xl mx-auto px-4 pt-12 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center pb-[15px]">
              {tenantConfig.logo.type === 'image' ? (
                <img
                  src={tenantConfig.logo.imageUrl || '/playsermons-logo-2.png'}
                  alt={tenantConfig.logo.altText}
                  className="h-[200px] w-auto"
                />
              ) : (
                <h1 className="text-6xl font-bold text-gray-900">
                  {tenantConfig.logo.text}
                </h1>
              )}
            </div>
            {/* Search Box */}
            <div className="mb-8">
              <form onSubmit={handleSearch} className="max-w-3xl mx-auto">
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={tenantConfig.searchPlaceholder}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg bg-white placeholder-gray-500"
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Search
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Gradient section - starts right below logo */}
      <div className="bg-gradient-to-br from-white via-purple-200 to-blue-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Taglines */}
        <div className="text-center pt-8 pb-5">
          <p className="text-2xl text-gray-700 font-medium">
            Unlock Your Church's Sermon Video Library with AI-Powered Search
          </p>
          <p className="text-lg text-gray-600 mt-3 max-w-3xl mx-auto">
            Make every sermon instantly searchable. Help your congregation find the exact moment when a topic, Bible verse, or teaching was discussed.
          </p>
        </div>
        {/* Problem Statement */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-12 border-2 border-purple-100">
          <div className="flex items-start gap-4">
            <div className="text-4xl">💡</div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                The Challenge YouTube Can't Solve
              </h2>
              <p className="text-gray-700 mb-3 leading-relaxed">
                Your church has invested years creating rich, valuable sermon content on YouTube. But there's a problem: <strong>YouTube doesn't allow you to search for words in transcripts across your entire video library.</strong>
              </p>
              <p className="text-gray-700 leading-relaxed">
                When your congregation wants to find every time you taught about "grace" or "Romans 8:28," they're stuck manually scrolling through video titles and descriptions. YouTube only searches titles and descriptions—not what was actually said in the sermons. That means hours of powerful teaching remain hidden and impossible to discover.
              </p>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            How PlaySermons Works
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            {/* Step 1 */}
            <div className="bg-white rounded-xl shadow-lg p-8 text-center border-2 border-purple-100 relative">
              <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg">
                1
              </div>
              <div className="text-5xl mb-4">📺</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                We Index Your Sermons
              </h3>
              <p className="text-gray-600">
                PlaySermons automatically imports all your YouTube sermon videos and transcribes every word using advanced AI technology.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-xl shadow-lg p-8 text-center border-2 border-blue-100 relative">
              <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg">
                2
              </div>
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                AI-Powered Search
              </h3>
              <p className="text-gray-600">
                Your congregation searches for topics, Bible verses, or themes—and instantly finds every sermon where they were mentioned.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-xl shadow-lg p-8 text-center border-2 border-purple-100 relative">
              <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg">
                3
              </div>
              <div className="text-5xl mb-4">⏱️</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Jump to the Moment
              </h3>
              <p className="text-gray-600">
                Click any result to jump directly to that exact timestamp in the video. No more scrubbing through hours of content.
              </p>
            </div>

            {/* Step 4 - AI Quotes */}
            <div className="bg-white rounded-xl shadow-lg p-8 text-center border-2 border-blue-100 relative">
              <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg">
                4
              </div>
              <div className="text-5xl mb-4">✨</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Share Powerful Quotes
              </h3>
              <p className="text-gray-600">
                AI generates the top 10 most powerful quotes for each video. Each quote is presented in a beautiful, shareable format that links directly to the exact moment in the video.
              </p>
            </div>
          </div>

          {/* Visual Example */}
          <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-xl p-8 border-2 border-purple-200">
            <div className="flex items-center gap-3 mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-lg font-semibold text-gray-800">Example: Someone searches for "forgiveness"</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-inner">
              <div className="space-y-3">
                <div className="border-l-4 border-purple-500 pl-4 py-2">
                  <p className="text-sm text-gray-600 mb-1">March 15, 2024 - "The Power of Grace"</p>
                  <p className="text-gray-800">"...and through <mark className="bg-yellow-200 px-1 rounded">forgiveness</mark>, we find freedom from the chains of bitterness..."</p>
                  <p className="text-sm text-purple-600 font-medium mt-1">→ 23:45</p>
                </div>
                <div className="border-l-4 border-purple-500 pl-4 py-2">
                  <p className="text-sm text-gray-600 mb-1">January 8, 2024 - "New Year, New Heart"</p>
                  <p className="text-gray-800">"As Ephesians 4:32 says, be kind and compassionate, <mark className="bg-yellow-200 px-1 rounded">forgiving</mark> one another..."</p>
                  <p className="text-sm text-purple-600 font-medium mt-1">→ 18:12</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Try it Out! */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Try out these Church's AI-Powered Search!
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {channels && channels.map((channel) => {
              // Explicit URL mappings for all three featured channels
              let channelUrl;

              // Calvary Chapel Chino Hills
              if (channel.id === 'a5c701d0-fd07-44ff-b547-44dc61ac9cc9') {
                channelUrl = 'https://calvarychapelchinohills.playsermons.com';
              }
              // Church on The Ridge
              else if (channel.id === '5213fa50-0dc8-4bb1-8b2b-0d393bdd51ab') {
                channelUrl = 'https://cotr.video';
              }
              // Harvest Church
              else if (channel.id === '51066ca5-daa2-4056-a88d-210140957793') {
                channelUrl = 'https://harvest.playsermons.com';
              }
              // Channels with handles use subdomain format
              else if (channel.channel_handle) {
                channelUrl = `https://${channel.channel_handle}.playsermons.com`;
              }
              // Fallback: use tenant domain with channel ID if no handle exists
              else {
                const tenantDomain = channel.tenant_domain || 'playsermons.com';
                channelUrl = `https://${tenantDomain}/${channel.id}`;
              }

              return (
                <a
                  key={channel.id}
                  href={channelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow overflow-hidden border-2 border-purple-100 hover:border-purple-300 cursor-pointer group"
                >
                  <div className="p-6">
                    <div className="flex items-center space-x-4 mb-4">
                      {channel.thumbnail_url && (
                        <img
                          src={channel.thumbnail_url}
                          alt={channel.channel_name}
                          className="w-20 h-20 rounded-full object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
                          {channel.channel_name}
                        </h3>
                      </div>
                    </div>
                    {channel.channel_description && (
                      <p className="text-gray-600 text-sm line-clamp-3">
                        {channel.channel_description}
                      </p>
                    )}
                    <div className="mt-4 flex items-center text-purple-600 font-medium text-sm group-hover:translate-x-1 transition-transform">
                      Try it out →
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>

        {/* Benefits */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Transform Your Sermon Library
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl shadow-lg p-8 border-l-4 border-purple-600">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Amplify Your Teaching Impact
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Sermons you preached months or years ago can speak to someone today. PlaySermons ensures your entire library remains relevant and accessible, not buried in YouTube's upload history.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8 border-l-4 border-blue-600">
              <div className="text-4xl mb-4">📖</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Bible Verse References Made Easy
              </h3>
              <p className="text-gray-600 leading-relaxed">
                When someone wants to study what your church teaches about "John 3:16" or "faith," they can instantly find every sermon that references it—with the exact timestamp.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8 border-l-4 border-purple-600">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Encourage Deeper Engagement
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Small groups and Bible studies can easily reference past sermons. Members revisit teachings when preparing for discussions or personal study.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8 border-l-4 border-blue-600">
              <div className="text-4xl mb-4">🌐</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Your Own Branded Search Portal
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Get a custom URL (like <strong>yourchurch.video</strong>) to share with your congregation. Simple, professional, and always up-to-date.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl shadow-2xl p-12 text-center text-white">
          <h2 className="text-4xl font-bold mb-4">
            Ready to Unlock Your Sermon Library?
          </h2>
          <p className="text-xl mb-8 text-purple-100">
            Join churches who are making their teaching more discoverable and impactful.
          </p>
          <a
            href="mailto:team@playsermons.com"
            className="inline-block bg-white text-purple-600 px-10 py-4 rounded-lg font-bold text-lg hover:bg-purple-50 transition-all transform hover:scale-105 shadow-lg"
          >
            Contact Us to See your Church Search Portal
          </a>
        </div>

        {/* Footer */}
        <div className="mt-16 pb-8 text-center text-gray-600">
          <p className="text-sm mb-4">
            Powered by AI-driven search technology
          </p>
          <p className="text-sm text-gray-500">
            Copyright © 2026, PlaySermons LLC, all rights reserved
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}
