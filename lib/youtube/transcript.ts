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

    console.log(`Transcript info keys: ${transcriptInfo ? Object.keys(transcriptInfo) : 'null'}`);

    if (!transcriptInfo) {
      console.log(`No transcriptInfo for video ${videoId}`);
      return null;
    }

    // Log the structure to understand the API response
    console.log(`transcriptInfo.transcript exists: ${!!transcriptInfo.transcript}`);

    if (!transcriptInfo.transcript) {
      console.log(`No transcript object for video ${videoId}`);
      return null;
    }

    console.log(`transcript.content exists: ${!!transcriptInfo.transcript.content}`);

    if (!transcriptInfo.transcript.content) {
      console.log(`No transcript content for video ${videoId}`);
      return null;
    }

    console.log(`transcript.content.body exists: ${!!transcriptInfo.transcript.content.body}`);
    console.log(`transcript.content keys: ${Object.keys(transcriptInfo.transcript.content)}`);

    const segments = transcriptInfo.transcript.content.body?.initial_segments || [];

    if (segments.length === 0) {
      console.log(`No transcript segments found for video ${videoId}`);
      // Log the body structure if it exists
      if (transcriptInfo.transcript.content.body) {
        console.log(`body keys: ${Object.keys(transcriptInfo.transcript.content.body)}`);
      }
      return null;
    }

    console.log(`Got ${segments.length} transcript segments for video ${videoId}`);
    console.log(`First segment keys: ${Object.keys(segments[0])}`);
    console.log(`First segment: ${JSON.stringify(segments[0])}`);

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
