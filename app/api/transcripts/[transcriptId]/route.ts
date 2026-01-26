import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transcriptId: string }> }
) {
  try {
    const { transcriptId } = await params;

    const { data: transcript, error } = await supabaseAdmin
      .from('transcripts')
      .select('id, text, start_time, duration')
      .eq('id', transcriptId)
      .single();

    if (error) {
      console.error('Error fetching transcript:', error);
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: transcript.id,
      text: transcript.text,
      startTime: transcript.start_time,
      duration: transcript.duration,
    });
  } catch (error) {
    console.error('Error in transcript API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transcript' },
      { status: 500 }
    );
  }
}
