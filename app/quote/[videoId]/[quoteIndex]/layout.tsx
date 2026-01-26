import { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ videoId: string; quoteIndex: string }>;
}): Promise<Metadata> {
  const { videoId, quoteIndex } = await params;

  try {
    // Fetch video data
    const { data: video } = await supabaseAdmin
      .from('videos')
      .select(`
        youtube_video_id,
        title,
        thumbnail_url,
        channels (
          channel_name
        )
      `)
      .eq('id', videoId)
      .single();

    // Fetch quote data
    const { data: quotes } = await supabaseAdmin
      .from('video_quotes')
      .select('quote_text, quote_index')
      .eq('video_id', videoId)
      .order('quote_index', { ascending: true });

    const quote = quotes?.find(q => q.quote_index === parseInt(quoteIndex, 10));

    if (!video || !quote) {
      return {
        title: 'Quote Not Found',
        description: 'This quote could not be found.',
      };
    }

    const ogTitle = `Quote from: ${video.title}`;
    const ogDescription = quote.quote_text;
    const ogImage = video.thumbnail_url || `https://img.youtube.com/vi/${video.youtube_video_id}/maxresdefault.jpg`;

    return {
      title: ogTitle,
      description: ogDescription,
      openGraph: {
        title: ogTitle,
        description: ogDescription,
        images: [
          {
            url: ogImage,
            width: 1280,
            height: 720,
            alt: video.title,
          },
        ],
        type: 'video.other',
      },
      twitter: {
        card: 'summary_large_image',
        title: ogTitle,
        description: ogDescription,
        images: [ogImage],
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'Quote',
      description: 'Watch this powerful quote from a video',
    };
  }
}

export default function QuoteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
