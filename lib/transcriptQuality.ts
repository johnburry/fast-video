/**
 * Utility functions for validating transcript quality
 * Detects low-quality auto-generated transcripts (music/applause only)
 */

interface TranscriptSegment {
  text: string;
  start_time?: number;
  duration?: number;
}

/**
 * Validates if a transcript contains meaningful speech content
 * Returns true if the transcript is high quality, false if it's just music/filler
 *
 * Quality Check: A transcript must have at least 10 unique words to be considered quality.
 * This simple threshold filters out music-only or extremely repetitive content.
 */
export function isQualityTranscript(transcripts: TranscriptSegment[]): boolean {
  if (!transcripts || transcripts.length === 0) {
    return false;
  }

  // Combine all transcript text
  const allText = transcripts.map(t => t.text.toLowerCase()).join(' ');
  const words = allText.split(/\s+/).filter(w => w.length > 0);

  if (words.length === 0) {
    console.log(`[TRANSCRIPT QUALITY] ❌ Low quality: no words found`);
    return false;
  }

  // Count unique words (case-insensitive)
  const uniqueWords = new Set(words);
  const uniqueWordCount = uniqueWords.size;

  console.log(`[TRANSCRIPT QUALITY] Analysis: ${words.length} total words, ${uniqueWordCount} unique words`);

  // Quality threshold: at least 10 unique words
  const MIN_UNIQUE_WORDS = 10;

  if (uniqueWordCount < MIN_UNIQUE_WORDS) {
    console.log(`[TRANSCRIPT QUALITY] ❌ Low quality: only ${uniqueWordCount} unique words (need ${MIN_UNIQUE_WORDS})`);
    return false;
  }

  console.log(`[TRANSCRIPT QUALITY] ✅ High quality transcript`);
  return true;
}

/**
 * Get a summary of why a transcript is low quality
 */
export function getTranscriptQualityReason(transcripts: TranscriptSegment[]): string {
  if (!transcripts || transcripts.length === 0) {
    return 'No transcript available';
  }

  const allText = transcripts.map(t => t.text.toLowerCase()).join(' ');
  const words = allText.split(/\s+/).filter(w => w.length > 0);

  if (words.length === 0) {
    return 'Empty transcript';
  }

  const uniqueWords = new Set(words);
  const uniqueWordCount = uniqueWords.size;

  if (uniqueWordCount < 10) {
    return `Only ${uniqueWordCount} unique words (need at least 10)`;
  }

  return 'Quality transcript';
}
