import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;

    const { data: transcripts, error } = await supabaseAdmin
      .from('transcripts')
      .select('id, text, start_time, duration')
      .eq('video_id', videoId)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching transcripts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch transcripts' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      transcripts: transcripts || [],
    });
  } catch (error) {
    console.error('Error in transcripts API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transcripts' },
      { status: 500 }
    );
  }
}
