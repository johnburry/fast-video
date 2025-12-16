import { YoutubeTranscript } from 'youtube-transcript';

export interface TranscriptSegment {
  text: string;
  startTime: number;
  duration: number;
}

export async function getVideoTranscript(videoId: string): Promise<TranscriptSegment[] | null> {
  try {
    console.log(`[TRANSCRIPT] Fetching transcript for video ${videoId}...`);

    // Use youtube-transcript library which is simpler and more reliable
    // than youtubei.js for transcript fetching
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);

    if (!transcriptItems || transcriptItems.length === 0) {
      console.log(`[TRANSCRIPT] No transcript items returned for video ${videoId}`);
      return null;
    }

    console.log(`[TRANSCRIPT] Got ${transcriptItems.length} transcript items for video ${videoId}`);

    // Convert from youtube-transcript format to our format
    const result: TranscriptSegment[] = transcriptItems.map((item: any) => ({
      text: item.text || '',
      startTime: item.offset / 1000, // Convert milliseconds to seconds
      duration: item.duration / 1000, // Convert milliseconds to seconds
    }));

    console.log(`[TRANSCRIPT] Successfully processed ${result.length} segments for video ${videoId}`);
    return result;
  } catch (error: any) {
    // Handle cases where transcripts are not available
    if (error.message?.includes('Could not find captions') ||
        error.message?.includes('Transcript is disabled') ||
        error.message?.includes('No transcripts available')) {
      console.log(`[TRANSCRIPT] Transcript not available for video ${videoId}: ${error.message}`);
      return null;
    }

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
