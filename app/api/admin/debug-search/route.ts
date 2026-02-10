import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Debug search issues for a specific video
 * GET /api/admin/debug-search?videoId=xxx&query=yyy
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const videoId = searchParams.get('videoId');
    const query = searchParams.get('query') || 'proclaiming';

    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId parameter is required' },
        { status: 400 }
      );
    }

    // 1. Check if video exists
    const { data: video, error: videoError } = await supabaseAdmin
      .from('videos')
      .select('id, title, youtube_video_id, has_transcript, channel_id')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      return NextResponse.json({
        error: 'Video not found',
        videoId,
      });
    }

    // 2. Check transcripts
    const { data: transcripts, error: transcriptsError } = await supabaseAdmin
      .from('transcripts')
      .select('id, text, start_time')
      .eq('video_id', videoId)
      .order('start_time', { ascending: true });

    const transcriptCount = transcripts?.length || 0;
    const fullText = transcripts?.map(t => t.text).join(' ') || '';
    const containsQuery = fullText.toLowerCase().includes(query.toLowerCase());
    const matchingSegments = transcripts?.filter(t =>
      t.text.toLowerCase().includes(query.toLowerCase())
    ) || [];

    // 3. Check if in search index
    const { data: searchContext, error: searchError } = await supabaseAdmin
      .from('transcript_search_context')
      .select('*')
      .eq('video_id', videoId);

    const searchContextCount = searchContext?.length || 0;

    // 4. Test full-text search
    const { data: searchResults, error: ftsError } = await supabaseAdmin
      .from('transcript_search_context')
      .select('*')
      .eq('video_id', videoId)
      .textSearch('search_text', query, {
        type: 'websearch',
        config: 'english',
      });

    const searchResultsCount = searchResults?.length || 0;

    // 5. Check if refresh is needed
    const { data: refreshStatus } = await supabaseAdmin
      .from('transcript_search_refresh_status')
      .select('*')
      .eq('id', 1)
      .single();

    return NextResponse.json({
      videoId,
      query,
      video: {
        title: video.title,
        youtubeVideoId: video.youtube_video_id,
        hasTranscript: video.has_transcript,
        channelId: video.channel_id,
      },
      transcripts: {
        count: transcriptCount,
        containsQuery,
        matchingSegments: matchingSegments.map(s => ({
          text: s.text,
          startTime: s.start_time,
        })),
      },
      searchIndex: {
        entriesInIndex: searchContextCount,
        fullTextSearchResults: searchResultsCount,
        searchError: ftsError?.message,
      },
      refreshStatus: {
        needsRefresh: refreshStatus?.needs_refresh,
        lastRefreshedAt: refreshStatus?.last_refreshed_at,
        refreshInProgress: refreshStatus?.refresh_in_progress,
      },
      diagnosis: getDiagnosis({
        transcriptCount,
        containsQuery,
        searchContextCount,
        searchResultsCount,
        needsRefresh: refreshStatus?.needs_refresh,
      }),
    });
  } catch (error) {
    console.error('Debug search error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

function getDiagnosis(checks: {
  transcriptCount: number;
  containsQuery: boolean;
  searchContextCount: number;
  searchResultsCount: number;
  needsRefresh: boolean;
}) {
  const issues: string[] = [];
  const suggestions: string[] = [];

  if (checks.transcriptCount === 0) {
    issues.push('No transcripts found for this video');
    suggestions.push('Import transcripts for this video');
  } else if (!checks.containsQuery) {
    issues.push('Query word not found in any transcript segment');
    suggestions.push('Verify the exact spelling in the transcript');
  } else if (checks.searchContextCount === 0) {
    issues.push('Video not in search index (transcript_search_context)');
    suggestions.push('Run: REFRESH MATERIALIZED VIEW transcript_search_context');
  } else if (checks.searchResultsCount === 0) {
    issues.push('Video is in index but full-text search returns no results');
    suggestions.push('Check if search_text column is properly populated');
    suggestions.push('Try running: REFRESH MATERIALIZED VIEW transcript_search_context');
  } else if (checks.needsRefresh) {
    issues.push('Search index needs refresh');
    suggestions.push('Call POST /api/admin/refresh-search-index');
  }

  if (issues.length === 0) {
    issues.push('No obvious issues found - search should work');
  }

  return { issues, suggestions };
}
