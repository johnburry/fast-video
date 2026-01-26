import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Quote {
  text: string;
  startTime: number;
  duration: number;
  index: number;
}

/**
 * GET endpoint to fetch or generate quotes for a video
 *
 * This endpoint:
 * 1. Checks if quotes already exist in the database
 * 2. If not, fetches the full transcript
 * 3. Uses ChatGPT to analyze and extract 10 powerful quotes
 * 4. Stores the quotes in the database
 * 5. Returns the quotes
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    console.log(`[VIDEO QUOTES] Fetching quotes for video ${videoId}`);

    // First, check if quotes already exist for this video
    const { data: existingQuotes, error: fetchError } = await supabaseAdmin
      .from('video_quotes')
      .select('*')
      .eq('video_id', videoId)
      .order('quote_index', { ascending: true });

    if (fetchError) {
      console.error('[VIDEO QUOTES] Error fetching existing quotes:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch quotes' },
        { status: 500 }
      );
    }

    // If quotes exist, return them
    if (existingQuotes && existingQuotes.length > 0) {
      console.log(`[VIDEO QUOTES] Returning ${existingQuotes.length} cached quotes`);
      return NextResponse.json({
        quotes: existingQuotes.map(q => ({
          id: q.id,
          text: q.quote_text,
          startTime: q.start_time,
          duration: q.duration,
          index: q.quote_index,
        })),
        cached: true,
      });
    }

    // No existing quotes, need to generate them
    console.log(`[VIDEO QUOTES] No cached quotes found, generating new ones`);

    // Get video info
    const { data: video, error: videoError } = await supabaseAdmin
      .from('videos')
      .select('id, youtube_video_id, title')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      console.error('[VIDEO QUOTES] Video not found:', videoError);
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Get all transcripts for this video, ordered by start time
    const { data: transcripts, error: transcriptError } = await supabaseAdmin
      .from('transcripts')
      .select('id, text, start_time, duration')
      .eq('video_id', videoId)
      .order('start_time', { ascending: true });

    if (transcriptError || !transcripts || transcripts.length === 0) {
      console.error('[VIDEO QUOTES] No transcripts found:', transcriptError);
      return NextResponse.json(
        { error: 'No transcript available for this video' },
        { status: 404 }
      );
    }

    console.log(`[VIDEO QUOTES] Found ${transcripts.length} transcript segments`);

    // Build the full transcript with timestamps
    const fullTranscript = transcripts.map((t, idx) => {
      const timestamp = formatTimestamp(t.start_time);
      return `[${timestamp}] ${t.text}`;
    }).join('\n');

    // Use ChatGPT to analyze and extract powerful quotes
    console.log(`[VIDEO QUOTES] Sending transcript to ChatGPT for analysis`);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert content analyzer. Your task is to identify the 10 most powerful, impactful, and quotable moments from video transcripts.

A powerful quote should be:
- Emotionally impactful or intellectually profound
- Self-contained and understandable on its own
- Memorable and shareable
- Relevant to the video's core message
- Between 10-100 words in length

You will receive a transcript with timestamps in the format [HH:MM:SS] or [MM:SS].

Return ONLY a valid JSON array of exactly 10 quotes, with no additional text or formatting. Each quote must have:
- "text": the exact quote text from the transcript
- "timestamp": the timestamp where the quote appears (e.g., "1:23:45" or "5:32")

Example format:
[
  {"text": "The most powerful quote text here", "timestamp": "1:23"},
  {"text": "Another impactful quote", "timestamp": "5:47"}
]`
        },
        {
          role: 'user',
          content: `Video Title: ${video.title}\n\nTranscript:\n${fullTranscript}\n\nAnalyze this transcript and return exactly 10 powerful quotes in JSON format.`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0].message.content?.trim();

    if (!responseText) {
      throw new Error('No response from ChatGPT');
    }

    console.log(`[VIDEO QUOTES] Received response from ChatGPT`);

    // Parse the JSON response
    let quotesData: Array<{ text: string; timestamp: string }>;
    try {
      quotesData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[VIDEO QUOTES] Failed to parse ChatGPT response:', responseText);
      throw new Error('Invalid JSON response from ChatGPT');
    }

    if (!Array.isArray(quotesData) || quotesData.length === 0) {
      throw new Error('ChatGPT did not return valid quotes array');
    }

    // Match quotes to transcript segments to get precise timing
    const quotes: Quote[] = [];

    for (let i = 0; i < Math.min(quotesData.length, 10); i++) {
      const quote = quotesData[i];

      // Find the matching transcript segment
      const matchingSegment = findMatchingTranscript(quote.text, transcripts);

      if (matchingSegment) {
        quotes.push({
          text: quote.text,
          startTime: matchingSegment.start_time,
          duration: matchingSegment.duration,
          index: i + 1,
        });
      } else {
        // If we can't find exact match, try to parse the timestamp
        const timeInSeconds = parseTimestamp(quote.timestamp);
        const nearestSegment = findNearestTranscript(timeInSeconds, transcripts);

        if (nearestSegment) {
          quotes.push({
            text: quote.text,
            startTime: nearestSegment.start_time,
            duration: nearestSegment.duration,
            index: i + 1,
          });
        }
      }
    }

    if (quotes.length === 0) {
      throw new Error('Could not match any quotes to transcript segments');
    }

    console.log(`[VIDEO QUOTES] Matched ${quotes.length} quotes to transcript segments`);

    // Store quotes in database
    const quotesToInsert = quotes.map(q => ({
      video_id: videoId,
      quote_text: q.text,
      start_time: q.startTime,
      duration: q.duration,
      quote_index: q.index,
    }));

    const { data: insertedQuotes, error: insertError } = await supabaseAdmin
      .from('video_quotes')
      .insert(quotesToInsert)
      .select();

    if (insertError) {
      console.error('[VIDEO QUOTES] Error inserting quotes:', insertError);
      return NextResponse.json(
        { error: 'Failed to save quotes' },
        { status: 500 }
      );
    }

    console.log(`[VIDEO QUOTES] Successfully saved ${insertedQuotes.length} quotes`);

    return NextResponse.json({
      quotes: quotes.map(q => ({
        text: q.text,
        startTime: q.startTime,
        duration: q.duration,
        index: q.index,
      })),
      cached: false,
    });

  } catch (error) {
    console.error('[VIDEO QUOTES] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to find a transcript segment that contains the quote text
 */
function findMatchingTranscript(
  quoteText: string,
  transcripts: Array<{ id: string; text: string; start_time: number; duration: number }>
): { start_time: number; duration: number } | null {
  // Normalize the quote text for comparison
  const normalizedQuote = quoteText.toLowerCase().trim();

  // Try to find exact or partial match
  for (const transcript of transcripts) {
    const normalizedTranscript = transcript.text.toLowerCase().trim();

    // Check if the quote is contained in this segment or vice versa
    if (normalizedTranscript.includes(normalizedQuote) || normalizedQuote.includes(normalizedTranscript)) {
      return {
        start_time: transcript.start_time,
        duration: transcript.duration,
      };
    }
  }

  // Try fuzzy matching - check if significant portion of words match
  for (const transcript of transcripts) {
    const quoteWords = normalizedQuote.split(/\s+/);
    const transcriptWords = transcript.text.toLowerCase().split(/\s+/);

    let matchCount = 0;
    for (const word of quoteWords) {
      if (word.length > 3 && transcriptWords.some(tw => tw.includes(word) || word.includes(tw))) {
        matchCount++;
      }
    }

    // If more than 60% of significant words match, consider it a match
    if (matchCount / quoteWords.length > 0.6) {
      return {
        start_time: transcript.start_time,
        duration: transcript.duration,
      };
    }
  }

  return null;
}

/**
 * Helper function to find the nearest transcript segment to a given timestamp
 */
function findNearestTranscript(
  targetTime: number,
  transcripts: Array<{ id: string; text: string; start_time: number; duration: number }>
): { start_time: number; duration: number } | null {
  if (transcripts.length === 0) return null;

  let nearest = transcripts[0];
  let minDiff = Math.abs(transcripts[0].start_time - targetTime);

  for (const transcript of transcripts) {
    const diff = Math.abs(transcript.start_time - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = transcript;
    }
  }

  return {
    start_time: nearest.start_time,
    duration: nearest.duration,
  };
}

/**
 * Parse timestamp string (e.g., "1:23:45" or "5:32") to seconds
 */
function parseTimestamp(timestamp: string): number {
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

/**
 * Format seconds to timestamp string (e.g., 125 -> "2:05")
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}
