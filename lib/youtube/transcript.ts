import { supabaseAdmin } from '@/lib/supabase/server';

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

export async function getVideoTranscript(
  videoId: string,
  preferNative: boolean = false,
  dbVideoId?: string
): Promise<TranscriptSegment[] | null> {
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
    // For live videos, use 'native' mode to get existing captions only (faster, synchronous)
    // For regular videos, use 'auto' mode (tries native first, then generates)
    url.searchParams.append('mode', preferNative ? 'native' : 'auto');

    console.log(`[TRANSCRIPT] Full API URL: ${url.toString()} (mode: ${preferNative ? 'native' : 'auto'})`);

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
      // If native mode failed with transcript-unavailable, skip auto mode and move on
      if (data.error === 'transcript-unavailable' && preferNative) {
        console.log(`[TRANSCRIPT] Native captions not available, skipping video (not trying auto mode)`);
        return null;
      }

      console.error(`[TRANSCRIPT] API returned error: ${data.error}`);
      return null;
    }

    // Check if this is an async job response
    if (data.jobId && !data.content && !data.segments) {
      console.log(`[TRANSCRIPT] Received async job ID: ${data.jobId}`);
      console.log(`[TRANSCRIPT] Live video transcripts require async processing`);

      // Save job to database for background processing
      if (dbVideoId) {
        await saveTranscriptJob(dbVideoId, data.jobId);
        console.log(`[TRANSCRIPT] Saved job ${data.jobId} to database for background processing`);
      }

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

// Helper function to save transcript job to database
async function saveTranscriptJob(videoId: string, jobId: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('transcript_jobs')
      .insert({
        video_id: videoId,
        job_id: jobId,
        status: 'pending',
      });

    if (error) {
      // If unique constraint violation, job already exists - that's fine
      if (error.code !== '23505') {
        console.error(`[TRANSCRIPT] Error saving job to database:`, error);
      }
    } else {
      console.log(`[TRANSCRIPT] Successfully saved job ${jobId} for video ${videoId}`);
    }
  } catch (error) {
    console.error(`[TRANSCRIPT] Exception saving job to database:`, error);
  }
}
