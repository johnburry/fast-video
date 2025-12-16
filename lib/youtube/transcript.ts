import { getYouTubeClient } from './client';

export interface TranscriptSegment {
  text: string;
  startTime: number;
  duration: number;
}

export async function getVideoTranscript(videoId: string): Promise<TranscriptSegment[] | null> {
  try {
    console.log(`Fetching transcript for video ${videoId}...`);

    const youtube = await getYouTubeClient();
    const info = await youtube.getInfo(videoId);

    // Get transcript from the video info
    const transcriptInfo = await info.getTranscript();

    if (!transcriptInfo || !transcriptInfo.transcript || !transcriptInfo.transcript.content) {
      console.log(`No transcript available for video ${videoId}`);
      return null;
    }

    const segments = transcriptInfo.transcript.content.body?.initial_segments || [];

    if (segments.length === 0) {
      console.log(`No transcript segments found for video ${videoId}`);
      return null;
    }

    console.log(`Got ${segments.length} transcript segments for video ${videoId}`);

    return segments.map((segment: any) => ({
      text: segment.snippet?.text || '',
      startTime: parseFloat(segment.start_ms || '0') / 1000,
      duration: parseFloat(segment.end_ms || '0') / 1000 - parseFloat(segment.start_ms || '0') / 1000,
    }));
  } catch (error) {
    console.error(`Error fetching transcript for video ${videoId}:`, error);
    return null;
  }
}

export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(':').map(Number);

  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    // SS
    return parts[0];
  }

  return 0;
}
