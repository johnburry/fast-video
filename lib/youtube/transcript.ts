export interface TranscriptSegment {
  text: string;
  startTime: number;
  duration: number;
}

interface YouTubeTranscriptAPIResponse {
  video_id: string;
  language: string;
  language_code: string;
  snippets: Array<{
    text: string;
    start: number;
    duration: number;
  }>;
}

interface SupadataTranscriptSegment {
  text: string;
  offset: number;
  duration: number;
  lang?: string;
}

interface SupadataTranscriptResponse {
  content?: SupadataTranscriptSegment[];
  lang?: string;
  availableLangs?: string[];
  segments?: SupadataTranscriptSegment[];
  text?: string;
  language?: string;
  error?: string;
  jobId?: string;
}

interface SupadataJobStatusResponse {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  content?: SupadataTranscriptSegment[];
  segments?: SupadataTranscriptSegment[];
  error?: string;
}

/**
 * Fetch transcript using youtubetranscripts.org API
 */
async function getTranscriptFromYouTubeTranscriptAPI(videoId: string): Promise<TranscriptSegment[] | null> {
  try {
    const apiKey = process.env.YOUTUBE_TRANSCRIPT_API_KEY;
    if (!apiKey) {
      console.error('[TRANSCRIPT] YOUTUBE_TRANSCRIPT_API_KEY not set in environment');
      return null;
    }

    const url = `https://youtube-tanscript.vercel.app/transcripts/${videoId}/first`;
    console.log(`[TRANSCRIPT] Fetching from YouTubeTranscript API: ${url}`);
    console.log(`[TRANSCRIPT] Using API key: ${apiKey.substring(0, 10)}...`);

    // Add 30 second timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error(`[TRANSCRIPT] YouTubeTranscript API taking too long, aborting after 30s`);
      controller.abort();
    }, 30000); // 30 second timeout

    try {
      const fetchStartTime = Date.now();
      console.log(`[TRANSCRIPT] Starting fetch at ${new Date().toISOString()}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const fetchDuration = Date.now() - fetchStartTime;
      console.log(`[TRANSCRIPT] YouTubeTranscript API responded in ${fetchDuration}ms with status: ${response.status}`);

      if (!response.ok) {
        console.error(`[TRANSCRIPT] YouTubeTranscript API request failed: ${response.status}`);
        const errorText = await response.text();
        console.error(`[TRANSCRIPT] Error response: ${errorText}`);
        return null;
      }

      const data: YouTubeTranscriptAPIResponse = await response.json();

      if (!data.snippets || data.snippets.length === 0) {
        console.log(`[TRANSCRIPT] No transcript snippets found for ${videoId}`);
        return null;
      }

      console.log(`[TRANSCRIPT] Successfully fetched ${data.snippets.length} snippets from YouTubeTranscript API`);

      // Map to our format
      const result: TranscriptSegment[] = data.snippets
        .filter(snippet => snippet.text && snippet.text.trim().length > 0)
        .map(snippet => ({
          text: snippet.text.trim(),
          startTime: snippet.start,
          duration: snippet.duration,
        }));

      return result;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error(`[TRANSCRIPT] YouTubeTranscript API timed out after 30 seconds for ${videoId}`);
      } else {
        console.error(`[TRANSCRIPT] Fetch error from YouTubeTranscript API:`, fetchError);
      }
      return null;
    }
  } catch (error) {
    console.error(`[TRANSCRIPT] Error fetching from YouTubeTranscript API:`, error);
    return null;
  }
}

/**
 * Main transcript fetching function
 * Tries YouTubeTranscript API first (faster), falls back to Supadata
 */
export async function getVideoTranscript(
  videoId: string,
  preferNative: boolean = false,
  dbVideoId?: string
): Promise<TranscriptSegment[] | null> {
  console.log(`[TRANSCRIPT] Fetching transcript for video ${videoId}...`);

  // Try YouTubeTranscript API first if API key is available
  if (process.env.YOUTUBE_TRANSCRIPT_API_KEY) {
    console.log(`[TRANSCRIPT] Trying YouTubeTranscript API first...`);
    const result = await getTranscriptFromYouTubeTranscriptAPI(videoId);
    if (result && result.length > 0) {
      console.log(`[TRANSCRIPT] ✓ Successfully fetched transcript from YouTubeTranscript API`);
      return result;
    }
    console.log(`[TRANSCRIPT] YouTubeTranscript API returned no results, falling back to Supadata...`);
  }

  // Fall back to Supadata API
  if (process.env.SUPADATA_API_KEY) {
    console.log(`[TRANSCRIPT] Trying Supadata API...`);
    const result = await getTranscriptFromSupadata(videoId);
    if (result && result.length > 0) {
      console.log(`[TRANSCRIPT] ✓ Successfully fetched transcript from Supadata API`);
      return result;
    }
  }

  console.log(`[TRANSCRIPT] No transcript available from any API for video ${videoId}`);
  return null;
}

/**
 * Fetch transcript using Supadata API (fallback)
 */
async function getTranscriptFromSupadata(videoId: string): Promise<TranscriptSegment[] | null> {
  try {
    const apiKey = process.env.SUPADATA_API_KEY;
    if (!apiKey) {
      console.error('[TRANSCRIPT] SUPADATA_API_KEY not set in environment');
      return null;
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`[TRANSCRIPT] Fetching from Supadata API for URL: ${videoUrl}`);

    // Always use 'auto' mode - waits for transcript to be ready (synchronous)
    const url = new URL('https://api.supadata.ai/v1/transcript');
    url.searchParams.append('url', videoUrl);
    url.searchParams.append('mode', 'auto');

    // Add 60 second timeout for Supadata (they may take longer to generate transcripts)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log(`[TRANSCRIPT] API response status: ${response.status} ${response.statusText}`);

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
      console.log(`[TRANSCRIPT] Transcript not available for ${videoId}: ${data.error}`);
      return null;
    }

    // In auto mode, Supadata should wait and return the transcript synchronously
    // If we get a jobId without content, something went wrong
    if (data.jobId && !data.content && !data.segments) {
      console.warn(`[TRANSCRIPT] Unexpected: Received async job ID in auto mode: ${data.jobId}`);
      console.warn(`[TRANSCRIPT] Auto mode should be synchronous. Skipping video.`);
      return null;
    }

    // Check if we have content (supadata.ai uses 'content' array)
    const segments = data.content || data.segments;
    if (!segments || segments.length === 0) {
      console.log(`[TRANSCRIPT] No segments in response for video ${videoId}`);
      console.log(`[TRANSCRIPT] data.content:`, data.content);
      console.log(`[TRANSCRIPT] data.segments:`, data.segments);
      return null;
    }

    console.log(`[TRANSCRIPT] Got ${segments.length} transcript segments for video ${videoId}`);

    // Convert from supadata.ai format to our format
    // Filter out segments with invalid data (empty text, null/NaN timing)
    const result: TranscriptSegment[] = segments
      .filter((segment) => {
        const text = segment.text?.trim();
        const offset = segment.offset;
        const duration = segment.duration;

        // Skip segments with empty text or invalid timing
        return text && text.length > 0 && !isNaN(offset) && !isNaN(duration);
      })
      .map((segment) => ({
        text: segment.text.trim(),
        startTime: segment.offset / 1000, // Convert milliseconds to seconds
        duration: segment.duration / 1000, // Convert milliseconds to seconds
      }));

      console.log(`[TRANSCRIPT] Successfully processed ${result.length} segments for video ${videoId} (filtered from ${segments.length})`);
      return result;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error(`[TRANSCRIPT] Supadata API timed out after 60 seconds for ${videoId}`);
      } else {
        console.error(`[TRANSCRIPT] Fetch error from Supadata API:`, fetchError);
      }
      return null;
    }
  } catch (error: any) {
    console.error(`[TRANSCRIPT] Error fetching transcript for video ${videoId}:`, error);
    return null;
  }
}

export function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

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

