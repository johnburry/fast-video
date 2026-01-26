import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerTenantConfig } from '@/lib/tenant-config';
import { sendSearchNotification } from '@/lib/mailgun';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const channelHandle = searchParams.get('channel');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const threshold = parseFloat(searchParams.get('threshold') || '0.7');

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
    const { data: tenantData } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('domain', tenantConfig.domain)
      .single();

    const tenantId = tenantData?.id;

    console.log(`[SEMANTIC SEARCH] Query: "${query}", Channel: ${channelHandle || 'all'}, Tenant: ${tenantId || 'all'}`);

    // Generate embedding for the search query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
      encoding_format: 'float',
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Check if channelHandle is a UUID (channel ID) or a handle
    const isUUID = channelHandle && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(channelHandle);

    // Call the database function to perform semantic search
    const { data: results, error } = await supabaseAdmin
      .rpc('search_transcripts_semantic', {
        query_embedding: JSON.stringify(queryEmbedding),
        channel_handle_filter: isUUID ? null : channelHandle,
        channel_id_filter: isUUID ? channelHandle : null,
        tenant_id_filter: tenantId,
        match_threshold: threshold,
        match_count: limit * 3, // Get more results to group by video
      });

    if (error) {
      console.error('[SEMANTIC SEARCH] Database error:', error);
      return NextResponse.json(
        { error: 'Search failed' },
        { status: 500 }
      );
    }

    console.log(`[SEMANTIC SEARCH] Found ${results?.length || 0} transcript matches`);

    // Group results by video and get previous segments for better context
    const resultsByVideo = new Map<string, any>();

    // Keep it simple: just return the matched segment text
    // Set playback to start 3 seconds before the matched segment
    const matchesWithTiming = (results || []).map((result: any) => {
      // Start playback 3 seconds before the matched segment
      const playbackStartTime = Math.max(0, result.start_time - 3);

      return {
        ...result,
        previousStartTime: playbackStartTime,
        displayText: result.text, // Just show the matched segment
      };
    });

    // Build grouped results by video
    matchesWithTiming.forEach((result: any) => {
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
        similarity: result.similarity, // Include similarity score
      });
    });

    const groupedResults = Array.from(resultsByVideo.values());

    // Sort results by best match similarity within each video
    groupedResults.forEach(video => {
      video.matches.sort((a: any, b: any) => b.similarity - a.similarity);
      // Keep only top 5 matches per video
      video.matches = video.matches.slice(0, 5);
      // Add average similarity score for the video
      video.avgSimilarity = video.matches.reduce((sum: number, m: any) => sum + m.similarity, 0) / video.matches.length;
    });

    // Sort videos by average similarity
    groupedResults.sort((a, b) => b.avgSimilarity - a.avgSimilarity);

    // Limit final results
    const finalResults = groupedResults.slice(0, limit);

    console.log(`[SEMANTIC SEARCH] Returning ${finalResults.length} videos with matches`);

    // Log search analytics (async, don't wait for it)
    logSemanticSearchAnalytics(request, query, channelHandle, finalResults.length, tenantConfig.domain, tenantId).catch(err => {
      console.error('[SEMANTIC SEARCH] Failed to log analytics:', err);
    });

    return NextResponse.json({
      query,
      results: finalResults,
      totalResults: finalResults.length,
      searchType: 'semantic',
    });
  } catch (error) {
    console.error('[SEMANTIC SEARCH] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Log semantic search analytics to database and send email notification
 */
async function logSemanticSearchAnalytics(
  request: NextRequest,
  query: string,
  channelHandle: string | null,
  resultsCount: number,
  tenantDomain: string,
  tenantId: string | undefined
) {
  try {
    if (!tenantId) return;

    // Get channel info if channelHandle is provided
    let channelId = null;
    let channelName = null;
    let channelHandleForEmail = null;

    if (channelHandle) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(channelHandle);

      const queryBuilder = supabaseAdmin
        .from('channels')
        .select('id, channel_name, channel_handle')
        .eq('tenant_id', tenantId);

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
      tenant_id: tenantId,
      tenant_name: tenantDomain,
      channel_id: channelId,
      channel_name: channelName,
      search_query: query,
      results_count: resultsCount,
      search_type: 'semantic',
      ip_address: ipAddress,
    });

    // Send email notification (async, don't wait for it)
    sendSearchNotification({
      tenantName: tenantDomain,
      channelHandle: channelHandleForEmail,
      ipAddress: ipAddress,
      searchQuery: query,
    }).catch(err => {
      console.error('[SEMANTIC SEARCH] Failed to send email notification:', err);
    });
  } catch (error) {
    console.error('[SEMANTIC SEARCH] Error logging analytics:', error);
  }
}
