import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const channelHandle = searchParams.get('channel');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    // Search using the new materialized view that includes cross-segment context
    let transcriptSearchQuery = supabase
      .from('transcript_search_context')
      .select('*')
      .textSearch('search_text', query, {
        type: 'websearch',
        config: 'english',
      })
      .order('start_time', { ascending: true });

    // Filter by channel if specified
    if (channelHandle) {
      transcriptSearchQuery = transcriptSearchQuery.eq('channel_handle', channelHandle);
    }

    const { data: transcriptData, error: transcriptError } = await transcriptSearchQuery;

    if (transcriptError) {
      console.error('Transcript search error:', transcriptError);
      return NextResponse.json(
        { error: 'Search failed' },
        { status: 500 }
      );
    }

    // Search video titles
    let videoQuery = supabase
      .from('videos')
      .select(`
        id,
        youtube_video_id,
        title,
        thumbnail_url,
        published_at,
        duration_seconds,
        channel:channels!inner(
          id,
          channel_handle,
          channel_name,
          thumbnail_url
        )
      `)
      .textSearch('title', query, {
        type: 'websearch',
        config: 'english',
      });

    // Filter by channel if specified
    if (channelHandle) {
      videoQuery = videoQuery.eq('channels.channel_handle', channelHandle);
    }

    const { data: videoData, error: videoError } = await videoQuery;

    if (videoError) {
      console.error('Video search error:', videoError);
    }

    // Combine results - use transcript data as base
    const data = transcriptData || [];

    // Group results by video
    const resultsByVideo = new Map<string, any>();

    // Fetch previous segments for each match to get better start times
    const matchesWithPrevious = await Promise.all(
      (data || []).map(async (result) => {
        // Get previous segments that contain spoken text (not music)
        const { data: prevSegments } = await supabase
          .from('transcripts')
          .select('start_time, text')
          .eq('video_id', result.video_id)
          .lt('start_time', result.start_time)
          .order('start_time', { ascending: false })
          .limit(10);

        // Find the first segment that doesn't contain music indicators
        const nonMusicSegment = prevSegments?.find(seg => {
          const text = seg.text?.toLowerCase() || '';
          return !text.includes('[music]') &&
                 !text.includes('♪') &&
                 !text.match(/^\[.*\]$/);
        });

        return {
          ...result,
          previousStartTime: nonMusicSegment?.start_time || result.start_time,
        };
      })
    );

    // Add transcript search results
    matchesWithPrevious.forEach((result) => {
      if (!resultsByVideo.has(result.video_id)) {
        resultsByVideo.set(result.video_id, {
          videoId: result.video_id,
          youtubeVideoId: result.youtube_video_id,
          title: result.video_title,
          thumbnail: result.video_thumbnail,
          publishedAt: result.published_at,
          duration: result.video_duration,
          channel: {
            id: result.channel_id,
            handle: result.channel_handle,
            name: result.channel_name,
            thumbnail: result.channel_thumbnail,
          },
          matches: [],
        });
      }

      resultsByVideo.get(result.video_id).matches.push({
        transcriptId: result.transcript_id,
        text: result.original_text, // Use original_text, not the combined search_text
        startTime: result.previousStartTime,
        actualStartTime: result.start_time,
        duration: result.duration,
      });
    });

    // Add videos that match by title (but don't have transcript matches)
    videoData?.forEach((video: any) => {
      if (!resultsByVideo.has(video.id)) {
        resultsByVideo.set(video.id, {
          videoId: video.id,
          youtubeVideoId: video.youtube_video_id,
          title: video.title,
          thumbnail: video.thumbnail_url,
          publishedAt: video.published_at,
          duration: video.duration_seconds,
          channel: {
            id: video.channel.id,
            handle: video.channel.channel_handle,
            name: video.channel.channel_name,
            thumbnail: video.channel.thumbnail_url,
          },
          matches: [],
        });
      }
    });

    const results = Array.from(resultsByVideo.values());

    return NextResponse.json({
      query,
      results,
      totalResults: results.length,
    });
  } catch (error) {
    console.error('Error in search:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
