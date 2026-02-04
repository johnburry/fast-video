import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerTenantConfig } from '@/lib/tenant-config';
import { sendSearchNotification } from '@/lib/mailgun';
import { extractCompleteSentences } from '@/lib/sentence-extractor';

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

    // Get tenant from hostname to filter results
    const hostname = request.headers.get('host') || '';
    const tenantConfig = await getServerTenantConfig(hostname);

    // Get tenant_id from database
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('id')
      .eq('domain', tenantConfig.domain)
      .single();

    const tenantId = tenantData?.id;

    // Search transcripts using cross-segment search context
    // This allows finding phrases that span across segment boundaries
    let transcriptSearchQuery = supabase
      .from('transcript_search_context')
      .select('*, video_id')
      .textSearch('search_text', query, {
        type: 'websearch',
        config: 'english',
      })
      .order('start_time', { ascending: true });

    // Filter by tenant_id if we have one
    if (tenantId) {
      transcriptSearchQuery = transcriptSearchQuery.eq('tenant_id', tenantId);
    }

    // Filter by channel if specified
    // Check if channelHandle is a UUID (channel ID) or a handle
    if (channelHandle) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(channelHandle);
      if (isUUID) {
        transcriptSearchQuery = transcriptSearchQuery.eq('channel_id', channelHandle);
      } else {
        transcriptSearchQuery = transcriptSearchQuery.eq('channel_handle', channelHandle);
      }
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
          thumbnail_url,
          tenant_id
        )
      `)
      .textSearch('title', query, {
        type: 'websearch',
        config: 'english',
      });

    // Filter by tenant_id if we have one
    if (tenantId) {
      videoQuery = videoQuery.eq('channels.tenant_id', tenantId);
    }

    // Filter by channel if specified
    // Check if channelHandle is a UUID (channel ID) or a handle
    if (channelHandle) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(channelHandle);
      if (isUUID) {
        videoQuery = videoQuery.eq('channels.id', channelHandle);
      } else {
        videoQuery = videoQuery.eq('channels.channel_handle', channelHandle);
      }
    }

    const { data: videoData, error: videoError } = await videoQuery;

    if (videoError) {
      console.error('Video search error:', videoError);
    }

    // Combine results - use transcript data as base, add videos from title matches
    const data = transcriptData || [];
    const error = null;

    if (error) {
      console.error('Search error:', error);
      return NextResponse.json(
        { error: 'Search failed' },
        { status: 500 }
      );
    }

    // Group results by video
    const resultsByVideo = new Map<string, any>();

    // Extract complete sentences from the search context
    // Set playback to start 3 seconds before the matched segment
    const matchesWithTiming = (data || []).map((result) => {
      // Start playback 3 seconds before the matched segment
      const playbackStartTime = Math.max(0, result.start_time - 3);

      // Extract complete sentences from the search_text (which includes surrounding context)
      // using the original_text as the anchor for what was matched
      const completeSentence = extractCompleteSentences(
        result.search_text || result.original_text || result.text,
        result.original_text || result.text
      );

      return {
        ...result,
        previousStartTime: playbackStartTime,
        displayText: completeSentence, // Show complete sentence(s) instead of fragments
      };
    });

    // Add transcript search results
    matchesWithTiming.forEach((result) => {
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
        text: result.displayText, // Just the matched segment
        startTime: result.previousStartTime, // Start 3 seconds before matched segment
        actualStartTime: result.start_time, // Keep original for reference
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

    // Sort results by published date (newest first)
    results.sort((a, b) => {
      const dateA = new Date(a.publishedAt).getTime();
      const dateB = new Date(b.publishedAt).getTime();
      return dateB - dateA;
    });

    // Log search analytics (async, don't wait for it)
    logSearchAnalytics(request, query, channelHandle, results.length, 'keyword').catch(err => {
      console.error('[KEYWORD SEARCH] Failed to log analytics:', err);
    });

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

/**
 * Log search analytics to database
 */
async function logSearchAnalytics(
  request: NextRequest,
  query: string,
  channelHandle: string | null,
  resultsCount: number,
  searchType: string
) {
  try {
    // Get tenant info
    const hostname = request.headers.get('host') || '';
    const tenantConfig = await getServerTenantConfig(hostname);

    const { data: tenantData } = await supabaseAdmin
      .from('tenants')
      .select('id, domain')
      .eq('domain', tenantConfig.domain)
      .single();

    if (!tenantData) return;

    // Get channel info if channelHandle is provided
    let channelId = null;
    let channelName = null;
    let channelHandleForEmail = null;

    if (channelHandle) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(channelHandle);

      const queryBuilder = supabaseAdmin
        .from('channels')
        .select('id, channel_name, channel_handle')
        .eq('tenant_id', tenantData.id);

      const { data: channelData } = isUUID
        ? await queryBuilder.eq('id', channelHandle).single()
        : await queryBuilder.eq('channel_handle', channelHandle).single();

      if (channelData) {
        channelId = channelData.id;
        channelName = channelData.channel_name;
        channelHandleForEmail = channelData.channel_handle;
      }
    }

    // Get IP address from headers
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') ||
      'unknown';

    // Insert analytics record
    await supabaseAdmin.from('search_analytics').insert({
      tenant_id: tenantData.id,
      tenant_name: tenantConfig.domain,
      channel_id: channelId,
      channel_name: channelName,
      search_query: query,
      results_count: resultsCount,
      search_type: searchType,
      ip_address: ipAddress,
    });

    // Send email notification (async, don't wait for it)
    sendSearchNotification({
      tenantName: tenantConfig.domain,
      channelHandle: channelHandleForEmail,
      ipAddress: ipAddress,
      searchQuery: query,
    }).catch(err => {
      console.error('[SEARCH ANALYTICS] Failed to send email notification:', err);
    });
  } catch (error) {
    console.error('[SEARCH ANALYTICS] Error logging search:', error);
  }
}
