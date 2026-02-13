import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getVideoTranscript } from '@/lib/youtube/transcript';

export async function POST(request: NextRequest) {
  try {
    const { channelId, youtubeVideoId } = await request.json();

    if (!channelId || !youtubeVideoId) {
      return NextResponse.json(
        { error: 'Channel ID and YouTube video ID are required' },
        { status: 400 }
      );
    }

    // Get the video from database
    const { data: video, error: videoError } = await supabaseAdmin
      .from('videos')
      .select('id, has_transcript')
      .eq('channel_id', channelId)
      .eq('youtube_video_id', youtubeVideoId)
      .single();

    if (videoError || !video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    const videoId = video.id;

    // Fetch transcript
    const transcript = await getVideoTranscript(youtubeVideoId, false);

    if (!transcript || transcript.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No transcript available for this video',
      });
    }

    // Save transcript
    const transcriptRecords = transcript.map((segment) => ({
      video_id: videoId,
      text: segment.text,
      start_time: segment.startTime,
      duration: segment.duration,
    }));

    const { error: transcriptError } = await supabaseAdmin
      .from('transcripts')
      .insert(transcriptRecords);

    if (transcriptError) {
      console.error(`Error saving transcript for video ${youtubeVideoId}:`, transcriptError);
      return NextResponse.json(
        { error: 'Failed to save transcript' },
        { status: 500 }
      );
    }

    // Update video to mark transcript as available
    await supabaseAdmin
      .from('videos')
      .update({ has_transcript: true })
      .eq('id', videoId);

    // Refresh search index for this video
    await supabaseAdmin
      .rpc('refresh_transcript_search_for_videos', {
        p_video_ids: [videoId],
      })
      .then(({ error }) => {
        if (error) console.error(`[SEARCH INDEX] Failed to refresh for video ${videoId}:`, error);
      });

    // Generate embeddings
    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await fetch(new URL('/api/embeddings/generate', request.url), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            videoId: videoId,
            batchSize: 100,
          }),
        });

        if (!response.ok) {
          console.error('Failed to generate embeddings');
        }
      } catch (error) {
        console.error('Error generating embeddings:', error);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Transcript fetched and saved successfully',
    });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transcript' },
      { status: 500 }
    );
  }
}
