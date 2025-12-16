export interface TranscriptSegment {
  text: string;
  startTime: number;
  duration: number;
}

interface YouTubeTranscriptIOSegment {
  text: string;
  start: string;
  dur: string;
}

interface YouTubeTranscriptIOResponse {
  text?: string;
  id?: string;
  tracks?: Array<{
    language: string;
    transcript: YouTubeTranscriptIOSegment[];
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

    // The API returns an object with tracks array containing transcript segments
    if (!data.tracks || data.tracks.length === 0) {
      console.log(`[TRANSCRIPT] No tracks in response for video ${videoId}`);
      return null;
    }

    const track = data.tracks[0]; // Use first track (usually English)
    if (!track.transcript || track.transcript.length === 0) {
      console.log(`[TRANSCRIPT] No transcript segments in track for video ${videoId}`);
      return null;
    }

    console.log(`[TRANSCRIPT] Got ${track.transcript.length} transcript segments for video ${videoId}`);

    // Convert from youtube-transcript.io format to our format
    const result: TranscriptSegment[] = track.transcript.map((segment) => ({
      text: segment.text || '',
      startTime: parseFloat(segment.start),
      duration: parseFloat(segment.dur),
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
