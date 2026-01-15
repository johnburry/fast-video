import { NextRequest, NextResponse } from 'next/server';

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
