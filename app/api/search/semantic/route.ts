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

    // Expand matches to full sentences and get context
    const matchesWithPrevious = await Promise.all(
      (results || []).map(async (result: any) => {
        // Get segments before and after the match to build full sentences
        const { data: segments } = await supabaseAdmin
          .from('transcripts')
          .select('start_time, text, duration')
          .eq('video_id', result.video_id)
          .gte('start_time', result.start_time - 30) // Look back 30 seconds
          .lte('start_time', result.start_time + 30) // Look forward 30 seconds
          .order('start_time', { ascending: true });

        if (!segments || segments.length === 0) {
          return {
            ...result,
            previousStartTime: result.start_time,
            fullSentence: result.text,
          };
        }

        // Find the index of the current segment
        const currentIndex = segments.findIndex(seg => seg.start_time === result.start_time);
        if (currentIndex === -1) {
          return {
            ...result,
            previousStartTime: result.start_time,
            fullSentence: result.text,
          };
        }

        // Use a simple context window: current segment ± 2 segments
        // This gives roughly one sentence of context without over-extending
        const contextWindow = 2;
        let sentenceStart = Math.max(0, currentIndex - contextWindow);
        let sentenceEnd = Math.min(segments.length - 1, currentIndex + contextWindow);

        // Check if text has clear sentence-ending punctuation
        const hasSentenceEnder = (text: string): boolean => {
          const trimmed = text.trim();
          if (!/[.!?]$/.test(trimmed)) return false;

          // Exclude common abbreviations
          const commonAbbrevs = /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|Inc|Ltd|Co|Corp|Ave|St|Rd|Blvd|Ph\.D|M\.D)\s*\.$/i;
          return !commonAbbrevs.test(trimmed);
        };

        // Refine start: look backwards for sentence ender (but don't go beyond context window)
        for (let i = currentIndex - 1; i >= sentenceStart; i--) {
          const text = segments[i].text?.trim() || '';
          if (text.includes('[music]') || text.includes('♪') || text.match(/^\[.*\]$/)) {
            sentenceStart = i + 1;
            break;
          }
          if (hasSentenceEnder(text)) {
            sentenceStart = i + 1;
            break;
          }
        }

        // Refine end: look forwards for sentence ender (but don't go beyond context window)
        for (let i = currentIndex; i <= sentenceEnd; i++) {
          const text = segments[i].text?.trim() || '';
          if (text.includes('[music]') || text.includes('♪') || text.match(/^\[.*\]$/)) {
            sentenceEnd = i - 1;
            break;
          }
          if (hasSentenceEnder(text)) {
            sentenceEnd = i;
            break;
          }
        }

        // Build full sentence text
        const sentenceSegments = segments.slice(sentenceStart, sentenceEnd + 1);
        const fullSentence = sentenceSegments
          .map(seg => seg.text?.trim())
          .filter(text => text && !text.includes('[music]') && !text.includes('♪'))
          .join(' ')
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();

        // Calculate start time (3 seconds before sentence start)
        const sentenceStartTime = segments[sentenceStart].start_time;
        const playbackStartTime = Math.max(0, sentenceStartTime - 3);

        return {
          ...result,
          previousStartTime: playbackStartTime,
          fullSentence: fullSentence || result.text,
          sentenceStartTime: sentenceStartTime,
        };
      })
    );

    // Build grouped results by video
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
        text: result.fullSentence, // Use full sentence instead of just the segment
        startTime: result.previousStartTime, // Start 3 seconds before sentence
        actualStartTime: result.start_time, // Keep original for reference
        sentenceStartTime: result.sentenceStartTime, // When the sentence actually starts
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
