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
    const { data: video, error: videoError } = await supabaseAdmin
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

    if (videoError) {
      console.error('[QUOTE METADATA] Video fetch error:', videoError);
    }

    // Fetch quote data
    const { data: quotes, error: quotesError } = await supabaseAdmin
      .from('video_quotes')
      .select('quote_text, quote_index')
      .eq('video_id', videoId)
      .order('quote_index', { ascending: true });

    if (quotesError) {
      console.error('[QUOTE METADATA] Quotes fetch error:', quotesError);
    }

    console.log('[QUOTE METADATA] Video:', video?.title, 'Quotes count:', quotes?.length);

    const quote = quotes?.find(q => q.quote_index === parseInt(quoteIndex, 10));

    if (!video || !quote) {
      console.error('[QUOTE METADATA] Missing data - video:', !!video, 'quote:', !!quote);
      return {
        title: 'Quote Not Found',
        description: 'This quote could not be found.',
      };
    }

    const ogTitle = `Quote from: ${video.title}`;
    // Truncate description to 200 characters for better compatibility
    const ogDescription = quote.quote_text.length > 200
      ? quote.quote_text.substring(0, 197) + '...'
      : quote.quote_text;
    const ogImage = video.thumbnail_url || `https://img.youtube.com/vi/${video.youtube_video_id}/maxresdefault.jpg`;

    console.log('[QUOTE METADATA] Generated - Title:', ogTitle, 'Description length:', ogDescription.length);

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
    console.error('[QUOTE METADATA] Error generating metadata:', error);
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
