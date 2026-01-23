import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerTenantConfig } from '@/lib/tenant-config';
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

    // Call the database function to perform semantic search
    const { data: results, error } = await supabaseAdmin
      .rpc('search_transcripts_semantic', {
        query_embedding: JSON.stringify(queryEmbedding),
        channel_handle_filter: channelHandle,
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

    // Fetch previous segments for each match to get better start times
    const matchesWithPrevious = await Promise.all(
      (results || []).map(async (result: any) => {
        // Get previous segments that contain spoken text (not music)
        const { data: prevSegments } = await supabaseAdmin
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
        text: result.text,
        startTime: result.previousStartTime,
        actualStartTime: result.start_time,
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
