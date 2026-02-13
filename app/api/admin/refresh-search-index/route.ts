import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

const BATCH_SIZE = 20;

/**
 * Rebuild the transcript search index table in batches.
 * Streams progress as newline-delimited JSON so the admin UI can show a live log.
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
      };

      try {
        send({ type: 'status', message: 'Starting search index rebuild...' });

        let offset = 0;
        let totalVideos = 0;
        let batchCount = 0;
        let done = false;

        while (!done) {
          const { data, error } = await supabaseAdmin
            .rpc('populate_search_context_batch', {
              p_batch_size: BATCH_SIZE,
              p_offset: offset,
            });

          if (error) {
            send({ type: 'error', message: `Batch error at offset ${offset}: ${error.message}` });
            break;
          }

          const result = data?.[0] || data;

          if (!result?.success) {
            send({ type: 'error', message: result?.message || 'Batch failed' });
            break;
          }

          totalVideos = result.total_eligible || 0;
          const videosInBatch = result.videos_in_batch || 0;
          batchCount++;

          send({
            type: 'batch',
            batch: batchCount,
            videosInBatch,
            totalVideos,
            offset,
            message: result.message,
          });

          if (videosInBatch === 0 || videosInBatch < BATCH_SIZE) {
            done = true;
          } else {
            offset += BATCH_SIZE;
          }
        }

        send({
          type: 'complete',
          totalVideos,
          batchCount,
          message: `Search index rebuilt: ${totalVideos} videos processed in ${batchCount} batches`,
        });
      } catch (error) {
        send({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}

/**
 * Check current state of the search index
 */
export async function GET(request: NextRequest) {
  try {
    const { count, error: countError } = await supabaseAdmin
      .from('transcript_search_context')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      return NextResponse.json(
        { error: countError.message },
        { status: 500 }
      );
    }

    // Count total eligible videos
    const { data: videoCount } = await supabaseAdmin
      .rpc('populate_search_context_batch', {
        p_batch_size: 0,
        p_offset: 0,
      });

    const totalEligible = videoCount?.[0]?.total_eligible || videoCount?.total_eligible || null;

    return NextResponse.json({
      indexedRows: count || 0,
      totalEligibleVideos: totalEligible,
      needsRebuild: count === 0,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
