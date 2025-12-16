export interface TranscriptSegment {
  text: string;
  startTime: number;
  duration: number;
}

interface YouTubeTranscriptIOResponse {
  transcripts: Array<{
    id: string;
    title: string;
    segments: Array<{
      text: string;
      start: number;
      duration: number;
    }>;
  }>;
}

export async function getVideoTranscript(videoId: string): Promise<TranscriptSegment[] | null> {
  try {
    console.log(`[TRANSCRIPT] Fetching transcript for video ${videoId}...`);

    const apiToken = process.env.YOUTUBE_TRANSCRIPT_API_TOKEN;
    if (!apiToken) {
      console.error('[TRANSCRIPT] YOUTUBE_TRANSCRIPT_API_TOKEN not set in environment');
      return null;
    }

    // Use youtube-transcript.io commercial API
    const response = await fetch('https://www.youtube-transcript.io/api/transcripts', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ids: [videoId],
      }),
    });

    if (!response.ok) {
      console.error(`[TRANSCRIPT] API request failed with status ${response.status}: ${response.statusText}`);
      const errorText = await response.text();
      console.error(`[TRANSCRIPT] Error response: ${errorText}`);
      return null;
    }

    const data: YouTubeTranscriptIOResponse = await response.json();

    if (!data.transcripts || data.transcripts.length === 0) {
      console.log(`[TRANSCRIPT] No transcripts returned for video ${videoId}`);
      return null;
    }

    const transcript = data.transcripts[0];
    if (!transcript.segments || transcript.segments.length === 0) {
      console.log(`[TRANSCRIPT] No segments in transcript for video ${videoId}`);
      return null;
    }

    console.log(`[TRANSCRIPT] Got ${transcript.segments.length} transcript segments for video ${videoId}`);

    // Convert from youtube-transcript.io format to our format
    const result: TranscriptSegment[] = transcript.segments.map((segment) => ({
      text: segment.text || '',
      startTime: segment.start,
      duration: segment.duration,
    }));

    console.log(`[TRANSCRIPT] Successfully processed ${result.length} segments for video ${videoId}`);
    return result;
  } catch (error: any) {
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
