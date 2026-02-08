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
 */
export function isQualityTranscript(transcripts: TranscriptSegment[]): boolean {
  if (!transcripts || transcripts.length === 0) {
    return false;
  }

  // Combine all transcript text
  const allText = transcripts.map(t => t.text.toLowerCase()).join(' ');
  const words = allText.split(/\s+/).filter(w => w.length > 0);
  const totalWords = words.length;

  if (totalWords === 0) {
    return false;
  }

  // Common filler words/phrases in auto-generated music transcripts
  const fillerWords = [
    'music', '[music]', 'applause', '[applause]', 'laughter', '[laughter]',
    'cheering', '[cheering]', 'instrumental', 'singing', 'clapping',
    'oh', 'ah', 'yeah', 'ooh', 'hmm', 'uh', 'um'
  ];

  // Count filler words
  const fillerCount = words.filter(word =>
    fillerWords.some(filler => word.includes(filler.replace(/\[|\]/g, '')))
  ).length;

  const fillerPercentage = fillerCount / totalWords;

  console.log(`[TRANSCRIPT QUALITY] Analysis: ${totalWords} words, ${fillerCount} filler (${(fillerPercentage * 100).toFixed(1)}%)`);

  // Dynamic threshold based on transcript length
  let fillerThreshold = 0.5; // Default: 50%

  if (totalWords < 50) {
    // Very short: must be 70% real content
    fillerThreshold = 0.3;
  } else if (totalWords < 100) {
    // Short: must be 60% real content
    fillerThreshold = 0.4;
  }

  // Additional check: if transcript has very few unique words, it's likely low quality
  const uniqueWords = new Set(words.filter(w => w.length > 3));
  const uniqueWordRatio = uniqueWords.size / totalWords;

  console.log(`[TRANSCRIPT QUALITY] Unique word ratio: ${(uniqueWordRatio * 100).toFixed(1)}%`);

  // If less than 20% unique words (very repetitive), consider low quality
  if (uniqueWordRatio < 0.2) {
    console.log(`[TRANSCRIPT QUALITY] ❌ Low quality: too repetitive (${(uniqueWordRatio * 100).toFixed(1)}% unique words)`);
    return false;
  }

  // If too many filler words, consider low quality
  if (fillerPercentage > fillerThreshold) {
    console.log(`[TRANSCRIPT QUALITY] ❌ Low quality: too much filler (${(fillerPercentage * 100).toFixed(1)}% > ${(fillerThreshold * 100).toFixed(0)}%)`);
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
  const totalWords = words.length;

  if (totalWords === 0) {
    return 'Empty transcript';
  }

  const fillerWords = [
    'music', '[music]', 'applause', '[applause]', 'laughter', '[laughter]',
    'cheering', '[cheering]', 'instrumental', 'singing', 'clapping'
  ];

  const fillerCount = words.filter(word =>
    fillerWords.some(filler => word.includes(filler.replace(/\[|\]/g, '')))
  ).length;

  const fillerPercentage = fillerCount / totalWords;

  if (fillerPercentage > 0.5) {
    return 'Primarily music or non-verbal content';
  }

  const uniqueWords = new Set(words.filter(w => w.length > 3));
  const uniqueWordRatio = uniqueWords.size / totalWords;

  if (uniqueWordRatio < 0.2) {
    return 'Highly repetitive content';
  }

  return 'Unknown quality issue';
}
