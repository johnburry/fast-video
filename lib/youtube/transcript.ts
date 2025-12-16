export interface TranscriptSegment {
  text: string;
  startTime: number;
  duration: number;
}

interface SupadataTranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

interface SupadataTranscriptResponse {
  segments?: SupadataTranscriptSegment[];
  text?: string;
  language?: string;
  error?: string;
}

export async function getVideoTranscript(videoId: string): Promise<TranscriptSegment[] | null> {
  try {
    console.log(`[TRANSCRIPT] Fetching transcript for video ${videoId}...`);

    const apiKey = process.env.SUPADATA_API_KEY;
    if (!apiKey) {
      console.error('[TRANSCRIPT] SUPADATA_API_KEY not set in environment');
      return null;
    }

    // Construct YouTube URL
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Use supadata.ai API
    const url = new URL('https://api.supadata.ai/v1/transcript');
    url.searchParams.append('url', videoUrl);
    url.searchParams.append('mode', 'auto'); // Try native first, then generate if needed

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[TRANSCRIPT] API request failed with status ${response.status}: ${response.statusText}`);
      const errorText = await response.text();
      console.error(`[TRANSCRIPT] Error response: ${errorText}`);
      return null;
    }

    const data: SupadataTranscriptResponse = await response.json();

    // Log the full response to debug
    console.log(`[TRANSCRIPT] Full API response for ${videoId}:`, JSON.stringify(data).substring(0, 500));
    console.log(`[TRANSCRIPT] Response keys:`, Object.keys(data));

    // Check for error in response
    if (data.error) {
      console.error(`[TRANSCRIPT] API returned error: ${data.error}`);
      return null;
    }

    // Check if we have segments
    if (!data.segments || data.segments.length === 0) {
      console.log(`[TRANSCRIPT] No segments in response for video ${videoId}`);
      console.log(`[TRANSCRIPT] data.segments:`, data.segments);
      return null;
    }

    console.log(`[TRANSCRIPT] Got ${data.segments.length} transcript segments for video ${videoId}`);

    // Convert from supadata.ai format to our format
    // Filter out segments with invalid data (empty text, null/NaN timing)
    const result: TranscriptSegment[] = data.segments
      .filter((segment) => {
        const text = segment.text?.trim();
        const offset = segment.offset;
        const duration = segment.duration;

        // Skip segments with empty text or invalid timing
        return text && text.length > 0 && !isNaN(offset) && !isNaN(duration);
      })
      .map((segment) => ({
        text: segment.text.trim(),
        startTime: segment.offset,
        duration: segment.duration,
      }));

    console.log(`[TRANSCRIPT] Successfully processed ${result.length} segments for video ${videoId} (filtered from ${data.segments.length})`);
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
