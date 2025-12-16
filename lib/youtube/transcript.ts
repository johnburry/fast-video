import { getYouTubeClient } from './client';

export interface TranscriptSegment {
  text: string;
  startTime: number;
  duration: number;
}

export async function getVideoTranscript(videoId: string): Promise<TranscriptSegment[] | null> {
  try {
    console.log(`[TRANSCRIPT] Fetching transcript for video ${videoId}...`);

    const youtube = await getYouTubeClient();

    // Try to fetch transcript directly using the transcript API
    // This bypasses the getInfo() call that's causing type mismatch errors
    let transcriptInfo;
    try {
      // Use the getTranscript method directly on the client
      const transcriptData = await youtube.getTranscript(videoId);

      if (!transcriptData || !transcriptData.transcript) {
        console.log(`[TRANSCRIPT] No transcript data returned for video ${videoId}`);
        return null;
      }

      transcriptInfo = transcriptData;
      console.log(`[TRANSCRIPT] Successfully fetched transcript data for video ${videoId}`);
    } catch (transcriptError: any) {
      // Handle cases where transcripts are not available
      if (transcriptError.message?.includes('400') ||
          transcriptError.message?.includes('Precondition check failed') ||
          transcriptError.message?.includes('Transcript panel not found') ||
          transcriptError.message?.includes('no transcript')) {
        console.log(`[TRANSCRIPT] Transcript not available for video ${videoId}: ${transcriptError.message}`);
        return null;
      }
      console.error(`[TRANSCRIPT] Unexpected error getting transcript for video ${videoId}:`, transcriptError);
      throw transcriptError;
    }

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

    console.log(`[TRANSCRIPT] Got ${segments.length} transcript segments for video ${videoId}`);
    console.log(`[TRANSCRIPT] First segment keys: ${Object.keys(segments[0])}`);
    console.log(`[TRANSCRIPT] First segment: ${JSON.stringify(segments[0])}`);

    const result = segments.map((segment: any) => ({
      text: segment.snippet?.text || '',
      startTime: parseFloat(segment.start_ms || '0') / 1000,
      duration: parseFloat(segment.end_ms || '0') / 1000 - parseFloat(segment.start_ms || '0') / 1000,
    }));

    console.log(`[TRANSCRIPT] Successfully processed ${result.length} segments for video ${videoId}`);
    return result;
  } catch (error) {
    console.error(`[TRANSCRIPT] Error fetching transcript for video ${videoId}:`, error);
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
