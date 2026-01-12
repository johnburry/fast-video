export interface TranscriptSegment {
  text: string;
  startTime: number;
  duration: number;
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
    console.log(`[TRANSCRIPT] Requesting transcript from Supadata API for URL: ${videoUrl}`);

    // Use supadata.ai API
    const url = new URL('https://api.supadata.ai/v1/transcript');
    url.searchParams.append('url', videoUrl);
    url.searchParams.append('mode', 'auto'); // Try native first, then generate if needed

    console.log(`[TRANSCRIPT] Full API URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

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
      console.error(`[TRANSCRIPT] API returned error: ${data.error}`);
      return null;
    }

    // Check if this is an async job response
    if (data.jobId && !data.content && !data.segments) {
      console.log(`[TRANSCRIPT] Received async job ID: ${data.jobId} - live videos require async processing`);

      // For live videos, try polling a few times with shorter intervals
      const maxAttempts = 6; // Poll for up to 1 minute (6 attempts * 10 seconds)
      const pollInterval = 10000; // 10 seconds

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`[TRANSCRIPT] Polling job ${data.jobId} (attempt ${attempt}/${maxAttempts})...`);

        // Wait before polling
        await new Promise(resolve => setTimeout(resolve, pollInterval));

        const jobUrl = `https://api.supadata.ai/v1/transcript/job/${data.jobId}`;

        const jobResponse = await fetch(jobUrl, {
          method: 'GET',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
          },
        });

        console.log(`[TRANSCRIPT] Job poll response status: ${jobResponse.status}`);

        if (!jobResponse.ok) {
          const errorText = await jobResponse.text();
          console.error(`[TRANSCRIPT] Job status request failed: ${jobResponse.status}`);
          console.error(`[TRANSCRIPT] Error: ${errorText.substring(0, 200)}`);

          // If endpoint doesn't exist, API might not support job polling
          if (jobResponse.status === 404) {
            console.error(`[TRANSCRIPT] Job polling endpoint not found - live video transcripts may not be supported`);
            return null;
          }
          continue;
        }

        const jobData: SupadataJobStatusResponse = await jobResponse.json();
        console.log(`[TRANSCRIPT] Job status: ${jobData.status}`);

        if (jobData.status === 'completed') {
          const jobSegments = jobData.content || jobData.segments;
          if (jobSegments && jobSegments.length > 0) {
            console.log(`[TRANSCRIPT] Job completed! Got ${jobSegments.length} segments`);
            const result: TranscriptSegment[] = jobSegments
              .filter((segment) => {
                const text = segment.text?.trim();
                const offset = segment.offset;
                const duration = segment.duration;
                return text && text.length > 0 && !isNaN(offset) && !isNaN(duration);
              })
              .map((segment) => ({
                text: segment.text.trim(),
                startTime: segment.offset / 1000,
                duration: segment.duration / 1000,
              }));

            console.log(`[TRANSCRIPT] Successfully processed ${result.length} segments from async job`);
            return result;
          } else {
            console.log(`[TRANSCRIPT] Job completed but no segments returned`);
            return null;
          }
        } else if (jobData.status === 'failed') {
          console.error(`[TRANSCRIPT] Job failed: ${jobData.error || 'Unknown error'}`);
          return null;
        }
        // Continue polling if status is 'pending' or 'processing'
      }

      console.log(`[TRANSCRIPT] Job still processing after ${maxAttempts} attempts - live video transcripts may take longer`);
      console.log(`[TRANSCRIPT] Job ID ${data.jobId} can be checked later for completion`);
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
