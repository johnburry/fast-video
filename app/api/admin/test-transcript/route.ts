import { NextRequest, NextResponse } from 'next/server';
import { getVideoTranscript } from '@/lib/youtube/transcript';

export async function POST(request: NextRequest) {
  try {
    const { videoId, preferNative } = await request.json();

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    console.log(`[TEST-TRANSCRIPT] Testing transcript fetch for video ${videoId} with mode: ${preferNative ? 'native' : 'auto'}`);

    const startTime = Date.now();
    const transcript = await getVideoTranscript(videoId, preferNative || false);
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`[TEST-TRANSCRIPT] Transcript fetch completed in ${duration}ms`);

    if (!transcript) {
      return NextResponse.json({
        videoId,
        segmentCount: 0,
        hasContent: false,
        segments: [],
        duration,
        error: 'No transcript returned (may be async job or unavailable)',
      });
    }

    return NextResponse.json({
      videoId,
      segmentCount: transcript.length,
      hasContent: true,
      segments: transcript,
      duration,
    });
  } catch (error) {
    console.error('[TEST-TRANSCRIPT] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch transcript' },
      { status: 500 }
    );
  }
}
