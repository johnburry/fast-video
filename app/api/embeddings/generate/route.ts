import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { videoId, batchSize = 50 } = await request.json();

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    // Get all transcripts for this video that don't have embeddings yet
    const { data: transcripts, error: fetchError } = await supabaseAdmin
      .from('transcripts')
      .select('id, text, video_id')
      .eq('video_id', videoId)
      .is('embedding', null)
      .limit(batchSize);

    if (fetchError) {
      console.error('Error fetching transcripts:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch transcripts' },
        { status: 500 }
      );
    }

    if (!transcripts || transcripts.length === 0) {
      return NextResponse.json({
        message: 'No transcripts to process',
        processed: 0,
      });
    }

    console.log(`[EMBEDDINGS] Processing ${transcripts.length} transcripts for video ${videoId}`);

    // Generate embeddings in batches
    const updates = [];
    for (const transcript of transcripts) {
      try {
        // Generate embedding using OpenAI
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: transcript.text,
          encoding_format: 'float',
        });

        const embedding = response.data[0].embedding;

        updates.push({
          id: transcript.id,
          embedding: JSON.stringify(embedding),
        });

        console.log(`[EMBEDDINGS] Generated embedding for transcript ${transcript.id}`);
      } catch (error) {
        console.error(`[EMBEDDINGS] Error generating embedding for transcript ${transcript.id}:`, error);
      }
    }

    // Update transcripts with embeddings
    if (updates.length > 0) {
      // Update each transcript individually (Supabase doesn't support batch upsert with embeddings easily)
      const updatePromises = updates.map(async (update) => {
        return supabaseAdmin
          .from('transcripts')
          .update({ embedding: update.embedding })
          .eq('id', update.id);
      });

      await Promise.all(updatePromises);
      console.log(`[EMBEDDINGS] Updated ${updates.length} transcripts with embeddings`);
    }

    return NextResponse.json({
      message: `Successfully generated embeddings for ${updates.length} transcripts`,
      processed: updates.length,
      total: transcripts.length,
    });
  } catch (error) {
    console.error('[EMBEDDINGS] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check embedding status for a video
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    // Count transcripts with and without embeddings
    const { data: stats, error } = await supabaseAdmin
      .from('transcripts')
      .select('id, embedding')
      .eq('video_id', videoId);

    if (error) {
      console.error('Error fetching stats:', error);
      return NextResponse.json(
        { error: 'Failed to fetch stats' },
        { status: 500 }
      );
    }

    const total = stats?.length || 0;
    const withEmbeddings = stats?.filter(t => t.embedding !== null).length || 0;
    const withoutEmbeddings = total - withEmbeddings;

    return NextResponse.json({
      total,
      withEmbeddings,
      withoutEmbeddings,
      progress: total > 0 ? (withEmbeddings / total) * 100 : 0,
    });
  } catch (error) {
    console.error('[EMBEDDINGS] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
