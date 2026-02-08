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
 * DELETE endpoint to remove existing quotes for a video
 * This allows regeneration of quotes by deleting the cached ones
 */
export async function DELETE(
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

    console.log(`[VIDEO QUOTES] Deleting quotes for video ${videoId}`);

    const { error: deleteError } = await supabaseAdmin
      .from('video_quotes')
      .delete()
      .eq('video_id', videoId);

    if (deleteError) {
      console.error('[VIDEO QUOTES] Error deleting quotes:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete quotes' },
        { status: 500 }
      );
    }

    console.log(`[VIDEO QUOTES] Successfully deleted quotes for video ${videoId}`);

    return NextResponse.json({
      success: true,
      message: 'Quotes deleted. Fetch again to regenerate.',
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

    // Validate transcript content quality
    // Check if transcript is mostly music/applause/filler words
    const allText = transcripts.map(t => t.text.toLowerCase()).join(' ');
    const words = allText.split(/\s+/);
    const totalWords = words.length;

    // Common filler words in music/low-content videos
    const fillerWords = ['music', 'applause', 'laughter', 'cheering', '[music]', '[applause]',
                         '[laughter]', 'instrumental', 'singing', 'oh', 'ah', 'yeah', 'ooh'];

    const fillerCount = words.filter(word =>
      fillerWords.some(filler => word.includes(filler))
    ).length;

    const fillerPercentage = totalWords > 0 ? (fillerCount / totalWords) : 0;

    console.log(`[VIDEO QUOTES] Transcript analysis: ${totalWords} words, ${fillerCount} filler words (${(fillerPercentage * 100).toFixed(1)}%)`);

    // Determine appropriate filler threshold based on transcript length
    // Short transcripts need stricter thresholds (must have some real content)
    // Long transcripts can tolerate more filler
    let fillerThreshold = 0.5; // Default: 50%

    if (totalWords < 50) {
      // Very short transcript: require at least 70% real content
      fillerThreshold = 0.3;
    } else if (totalWords < 100) {
      // Short transcript: require at least 60% real content
      fillerThreshold = 0.4;
    }

    // If transcript exceeds filler threshold, don't generate quotes
    if (fillerPercentage > fillerThreshold) {
      console.log(`[VIDEO QUOTES] Transcript is mostly music/filler (${(fillerPercentage * 100).toFixed(1)}% > ${(fillerThreshold * 100).toFixed(0)}% threshold). Skipping quote generation.`);
      return NextResponse.json({
        quotes: [],
        cached: false,
        error: 'This video appears to be primarily music or non-verbal content. Quotes cannot be extracted.',
      });
    }

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
- At least 5 words in length (minimum)
- Between 10-100 words in length (ideal)
- UNIQUE - no duplicates or near-duplicates
- Substantive - avoid single words, fragments, or filler phrases

CRITICAL RULES:
1. Each quote must be EXACTLY as it appears in the transcript - do not paraphrase, modify, or make up quotes
2. Only extract quotes that actually exist in the provided transcript
3. If you cannot find 10 high-quality quotes, return fewer quotes rather than inventing content
4. Do not hallucinate or create quotes based on assumptions about the video content
5. Each quote must be completely different from the others

You will receive a transcript with timestamps in the format [HH:MM:SS] or [MM:SS].

Return ONLY a valid JSON array of UNIQUE quotes (up to 10), with no additional text or formatting. Each quote must have:
- "text": the EXACT quote text from the transcript (word-for-word)
- "timestamp": the timestamp where the quote appears (e.g., "1:23:45" or "5:32")

Example format:
[
  {"text": "The most powerful quote text here", "timestamp": "1:23"},
  {"text": "Another impactful quote", "timestamp": "5:47"}
]

If the transcript does not contain meaningful quotes (e.g., only music, applause, or repetitive filler), return an empty array: []`
        },
        {
          role: 'user',
          content: `Video Title: ${video.title}\n\nTranscript:\n${fullTranscript}\n\nAnalyze this transcript and extract the most powerful quotes (up to 10). If the transcript is short, extract fewer high-quality quotes rather than padding with low-quality content. Return quotes in JSON format.`
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

    if (!Array.isArray(quotesData)) {
      throw new Error('ChatGPT did not return valid quotes array');
    }

    // If ChatGPT returned an empty array (no quotes found), return empty result
    if (quotesData.length === 0) {
      console.log(`[VIDEO QUOTES] ChatGPT returned no quotes - transcript likely has no quotable content`);
      return NextResponse.json({
        quotes: [],
        cached: false,
        error: 'No meaningful quotes could be extracted from this video.',
      });
    }

    // Deduplicate quotes - remove similar or identical quotes
    const uniqueQuotes: Array<{ text: string; timestamp: string }> = [];
    const seenTexts = new Set<string>();

    for (const quote of quotesData) {
      const normalizedText = quote.text.toLowerCase().trim();

      // Skip if too short (less than 5 words)
      const wordCount = normalizedText.split(/\s+/).length;
      if (wordCount < 5) {
        console.log(`[VIDEO QUOTES] Skipping short quote: "${quote.text}"`);
        continue;
      }

      // Check for exact duplicates
      if (seenTexts.has(normalizedText)) {
        console.log(`[VIDEO QUOTES] Skipping duplicate quote: "${quote.text}"`);
        continue;
      }

      // Check for near-duplicates (quotes that are very similar)
      let isSimilar = false;
      for (const seenText of seenTexts) {
        if (areSimilarQuotes(normalizedText, seenText)) {
          console.log(`[VIDEO QUOTES] Skipping similar quote: "${quote.text}"`);
          isSimilar = true;
          break;
        }
      }

      if (!isSimilar) {
        seenTexts.add(normalizedText);
        uniqueQuotes.push(quote);
      }
    }

    if (uniqueQuotes.length === 0) {
      throw new Error('No valid unique quotes after deduplication');
    }

    console.log(`[VIDEO QUOTES] After deduplication: ${uniqueQuotes.length} unique quotes from ${quotesData.length} original`);

    // Use the deduplicated quotes
    quotesData = uniqueQuotes;

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

/**
 * Check if two quotes are similar (likely duplicates)
 * Returns true if quotes share more than 70% of their words
 */
function areSimilarQuotes(text1: string, text2: string): boolean {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  // Count common words
  let commonWords = 0;
  for (const word of words1) {
    if (word.length > 2 && words2.has(word)) {
      commonWords++;
    }
  }

  // Calculate similarity percentage
  const minWords = Math.min(words1.size, words2.size);
  const similarity = commonWords / minWords;

  // Consider similar if more than 70% of words are the same
  return similarity > 0.7;
}
