import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerTenantConfig } from '@/lib/tenant-config';
import { sendSearchNotification } from '@/lib/mailgun';

/**
 * Hybrid Search API - Combines keyword and semantic search
 *
 * This endpoint performs both keyword (full-text) search and semantic (vector) search,
 * then merges and ranks the results to provide the best of both worlds:
 * - Keyword search: Fast, exact matches, good for specific terms
 * - Semantic search: Context-aware, understands intent, finds related concepts
 */
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

    console.log(`[HYBRID SEARCH] Query: "${query}"`);

    // Build URLs for both search endpoints
    const baseUrl = new URL(request.url).origin;
    const keywordUrl = new URL('/api/search', baseUrl);
    keywordUrl.searchParams.set('q', query);
    keywordUrl.searchParams.set('limit', (limit * 2).toString()); // Get more results for better merging
    if (channelHandle) keywordUrl.searchParams.set('channel', channelHandle);

    const semanticUrl = new URL('/api/search/semantic', baseUrl);
    semanticUrl.searchParams.set('q', query);
    semanticUrl.searchParams.set('limit', (limit * 2).toString());
    if (channelHandle) semanticUrl.searchParams.set('channel', channelHandle);

    // Perform both searches in parallel
    const [keywordResponse, semanticResponse] = await Promise.all([
      fetch(keywordUrl.toString()).then(r => r.json()),
      fetch(semanticUrl.toString()).then(r => r.json()).catch(err => {
        console.error('[HYBRID SEARCH] Semantic search failed, falling back to keyword only:', err);
        return { results: [] };
      }),
    ]);

    const keywordResults = keywordResponse.results || [];
    const semanticResults = semanticResponse.results || [];

    console.log(`[HYBRID SEARCH] Keyword: ${keywordResults.length}, Semantic: ${semanticResults.length}`);

    // Merge results using a scoring system
    const mergedResults = new Map<string, any>();

    // Add keyword results with base score
    keywordResults.forEach((result: any, index: number) => {
      const score = (keywordResults.length - index) / keywordResults.length;
      mergedResults.set(result.videoId, {
        ...result,
        hybridScore: score * 0.5, // 50% weight for keyword
        keywordRank: index + 1,
      });
    });

    // Add/merge semantic results
    semanticResults.forEach((result: any, index: number) => {
      const score = (semanticResults.length - index) / semanticResults.length;
      const existing = mergedResults.get(result.videoId);

      if (existing) {
        // Video found in both searches - boost its score
        existing.hybridScore += score * 0.5; // Add 50% weight for semantic
        existing.semanticRank = index + 1;
        existing.avgSimilarity = result.avgSimilarity;

        // Merge matches, preferring semantic matches for their similarity scores
        const matchMap = new Map();
        existing.matches.forEach((m: any) => matchMap.set(m.transcriptId, m));
        result.matches.forEach((m: any) => {
          if (!matchMap.has(m.transcriptId)) {
            matchMap.set(m.transcriptId, m);
          }
        });
        existing.matches = Array.from(matchMap.values());
      } else {
        // Video only found in semantic search
        mergedResults.set(result.videoId, {
          ...result,
          hybridScore: score * 0.5,
          semanticRank: index + 1,
        });
      }
    });

    // Convert to array and sort by hybrid score
    const finalResults = Array.from(mergedResults.values())
      .sort((a, b) => b.hybridScore - a.hybridScore)
      .slice(0, limit);

    console.log(`[HYBRID SEARCH] Returning ${finalResults.length} merged results`);

    // Log search analytics (async, don't wait for it)
    logSearchAnalytics(request, query, channelHandle, finalResults.length, 'hybrid').catch(err => {
      console.error('[HYBRID SEARCH] Failed to log analytics:', err);
    });

    return NextResponse.json({
      query,
      results: finalResults,
      totalResults: finalResults.length,
      searchType: 'hybrid',
      breakdown: {
        keywordResults: keywordResults.length,
        semanticResults: semanticResults.length,
        mergedResults: finalResults.length,
      },
    });
  } catch (error) {
    console.error('[HYBRID SEARCH] Error:', error);
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

    if (channelHandle) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(channelHandle);

      const query = supabaseAdmin
        .from('channels')
        .select('id, channel_name')
        .eq('tenant_id', tenantData.id);

      const { data: channelData } = isUUID
        ? await query.eq('id', channelHandle).single()
        : await query.eq('channel_handle', channelHandle).single();

      if (channelData) {
        channelId = channelData.id;
        channelName = channelData.channel_name;
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
      channelName: channelName,
      ipAddress: ipAddress,
      searchQuery: query,
    }).catch(err => {
      console.error('[SEARCH ANALYTICS] Failed to send email notification:', err);
    });
  } catch (error) {
    console.error('[SEARCH ANALYTICS] Error logging search:', error);
  }
}
