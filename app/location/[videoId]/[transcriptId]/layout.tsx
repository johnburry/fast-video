import { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ videoId: string; transcriptId: string }>;
}): Promise<Metadata> {
  const { videoId, transcriptId } = await params;

  try {
    // Fetch video data with channel info - using JOIN syntax
    const { data: video, error: videoError } = await supabaseAdmin
      .from('videos')
      .select(`
        youtube_video_id,
        title,
        thumbnail_url,
        channel_id,
        channels!inner (
          channel_name,
          thumbnail_url
        )
      `)
      .eq('id', videoId)
      .single();

    if (videoError) {
      console.error('[LOCATION METADATA] Video fetch error:', videoError);
    }

    console.log('[LOCATION METADATA] Raw video data:', JSON.stringify(video, null, 2));

    // Extract channel data - Supabase returns it as an object
    const channelData = video?.channels as any;
    console.log('[LOCATION METADATA] Channel data:', JSON.stringify(channelData, null, 2));

    // Fetch transcript location data
    const { data: transcript, error: transcriptError } = await supabaseAdmin
      .from('transcripts')
      .select('text, start_time')
      .eq('id', transcriptId)
      .single();

    if (transcriptError) {
      console.error('[LOCATION METADATA] Transcript fetch error:', transcriptError);
    }

    console.log('[LOCATION METADATA] Video:', video?.title, 'Transcript:', transcript?.text?.substring(0, 50));

    if (!video || !transcript) {
      console.error('[LOCATION METADATA] Missing data - video:', !!video, 'transcript:', !!transcript);
      return {
        title: 'Location Not Found',
        description: 'This location could not be found.',
      };
    }

    // Make the transcript text the title, truncate if needed
    const locationTitle = transcript.text.length > 200
      ? transcript.text.substring(0, 197) + '...'
      : transcript.text;
    const ogTitle = `Sharing a quote from: ${video.title}`;
    const ogDescription = locationTitle;
    // Use video thumbnail for link preview
    const ogImage = video.thumbnail_url || `https://img.youtube.com/vi/${video.youtube_video_id}/maxresdefault.jpg`;

    console.log('[LOCATION METADATA] Generated - Title:', ogTitle, 'Image:', ogImage, 'Channel:', channelData?.channel_name);

    return {
      title: ogTitle,
      description: ogDescription,
      openGraph: {
        title: ogTitle,
        description: ogDescription,
        images: [
          {
            url: ogImage,
            alt: video.title,
          },
        ],
        type: 'article',
        siteName: channelData?.channel_name || 'Video Location',
      },
      twitter: {
        card: 'summary_large_image',
        title: ogTitle,
        description: ogDescription,
        images: [ogImage],
      },
      other: {
        'twitter:label1': 'From',
        'twitter:data1': video.title,
      },
    };
  } catch (error) {
    console.error('[LOCATION METADATA] Error generating metadata:', error);
    return {
      title: 'Video Location',
      description: 'Watch this location from a video',
    };
  }
}

export default function LocationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
