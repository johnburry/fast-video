import { supabaseAdmin } from '@/lib/supabase/server';

const FEATURED_CHANNEL_IDS = [
  'a5c701d0-fd07-44ff-b547-44dc61ac9cc9',
  '5213fa50-0dc8-4bb1-8b2b-0d393bdd51ab',
  'fe74faf6-a18c-4a5c-8280-aeedf57574c6'
];

export default async function Home() {
  // Fetch featured channels
  const { data: channels } = await supabaseAdmin
    .from('channels')
    .select('id, channel_handle, channel_name, thumbnail_url, channel_description')
    .in('id', FEATURED_CHANNEL_IDS);

  return (
    <div className="min-h-screen">
      {/* White top section - Logo only */}
      <div className="bg-white">
        <div className="max-w-6xl mx-auto px-4 pt-12 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center">
              <img
                src="/playsermons-logo.svg"
                alt="PlaySermons"
                className="h-32 w-auto"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Gradient section - starts right below logo */}
      <div className="bg-gradient-to-br from-purple-50 via-white to-blue-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Taglines */}
        <div className="text-center pt-8 pb-5">
          <p className="text-2xl text-gray-700 font-medium">
            Unlock Your Church's Sermon Library with AI-Powered Search
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

          <div className="grid md:grid-cols-3 gap-8 mb-8">
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
            Try it Out!
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {channels && channels.map((channel) => (
              <a
                key={channel.id}
                href={`https://${channel.channel_handle}.playsermons.com`}
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
            ))}
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
                Get a custom URL (like <strong>yourchurch.playsermons.com</strong>) to share with your congregation. Simple, professional, and always up-to-date.
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
            Contact Us for a Demo
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
