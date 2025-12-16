export interface TranscriptSegment {
  text: string;
  startTime: number;
  duration: number;
}

interface YouTubeTranscriptIOSegment {
  text: string;
  start: number;
  duration: number;
}

// The API returns an array of segments directly, not nested in a transcripts object
type YouTubeTranscriptIOResponse = YouTubeTranscriptIOSegment[];

export async function getVideoTranscript(videoId: string): Promise<TranscriptSegment[] | null> {
  try {
    console.log(`[TRANSCRIPT] Fetching transcript for video ${videoId}...`);

    const apiToken = process.env.YOUTUBE_TRANSCRIPT_API_TOKEN;
    if (!apiToken) {
      console.error('[TRANSCRIPT] YOUTUBE_TRANSCRIPT_API_TOKEN not set in environment');
      return null;
    }

    // Use youtube-transcript.io commercial API v2 endpoint for segment data
    const response = await fetch('https://www.youtube-transcript.io/api/transcripts/v2', {
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

    const data = await response.json();

    console.log(`[TRANSCRIPT] Raw API response for video ${videoId}:`, JSON.stringify(data).substring(0, 500));

    // The API returns an array of segments directly
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.log(`[TRANSCRIPT] No segments in response for video ${videoId}, response type: ${typeof data}, isArray: ${Array.isArray(data)}`);
      return null;
    }

    console.log(`[TRANSCRIPT] Got ${data.length} transcript segments for video ${videoId}`);
    console.log(`[TRANSCRIPT] First segment structure:`, JSON.stringify(data[0], null, 2));

    // Convert from youtube-transcript.io format to our format
    const result: TranscriptSegment[] = data.map((segment) => ({
      text: segment.text || '',
      startTime: segment.start,
      duration: segment.duration,
    }));

    console.log(`[TRANSCRIPT] First mapped segment:`, JSON.stringify(result[0], null, 2));

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
