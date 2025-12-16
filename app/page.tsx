export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Fast.Video
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Searchable YouTube Transcripts for Content Creators
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            What is Fast.Video?
          </h2>
          <p className="text-gray-700 mb-4">
            Fast.Video is a powerful platform that allows YouTube creators to make their content
            more discoverable by enabling full-text search across all their video transcripts.
          </p>
          <p className="text-gray-700">
            Give your audience the ability to find exactly what they're looking for - not just
            which video, but the exact moment in the video where a topic is discussed.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-blue-600 text-4xl mb-4">🎯</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Instant Search
            </h3>
            <p className="text-gray-600">
              Search through hours of video content in seconds. Find the exact moment when a
              topic was mentioned.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-blue-600 text-4xl mb-4">⏱️</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Timestamp Links
            </h3>
            <p className="text-gray-600">
              Click on any search result to jump directly to that moment in the video.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-blue-600 text-4xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Full Catalog
            </h3>
            <p className="text-gray-600">
              All videos from a channel are indexed and searchable in one place.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-blue-600 text-4xl mb-4">🚀</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Custom Pages
            </h3>
            <p className="text-gray-600">
              Each creator gets their own branded Fast.Video page to share with their audience.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Get Started
          </h2>
          <p className="text-gray-700 mb-6">
            Ready to make your YouTube content searchable?
          </p>
          <a
            href="/admin"
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Import Your Channel
          </a>
        </div>

        <div className="mt-12 text-center text-gray-600">
          <p className="text-sm">
            Powered by Next.js, Supabase, and YouTube Transcript API
          </p>
        </div>
      </div>
    </div>
  );
}
