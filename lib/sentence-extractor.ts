/**
 * Extract complete sentences from text that contain a search match
 *
 * This function finds the portion of text that matches the search query
 * and extracts complete sentences around it, ensuring we don't return
 * sentence fragments in search results.
 */

/**
 * Split text into sentences, handling common abbreviations and edge cases
 */
function splitIntoSentences(text: string): string[] {
  // First, protect common abbreviations and titles
  let protectedText = text
    .replace(/Mr\./g, 'Mr<DOT>')
    .replace(/Mrs\./g, 'Mrs<DOT>')
    .replace(/Ms\./g, 'Ms<DOT>')
    .replace(/Dr\./g, 'Dr<DOT>')
    .replace(/Sr\./g, 'Sr<DOT>')
    .replace(/Jr\./g, 'Jr<DOT>')
    .replace(/St\./g, 'St<DOT>')
    .replace(/Ave\./g, 'Ave<DOT>')
    .replace(/([A-Z])\./g, '$1<DOT>'); // Single letter abbreviations like "U.S."

  // Split on sentence-ending punctuation followed by whitespace and capital letter
  // or end of string
  const sentencePattern = /[.!?]+(?:\s+(?=[A-Z])|$)/g;
  const sentences = protectedText.split(sentencePattern);

  // Restore the dots and clean up
  return sentences
    .map(s => s.replace(/<DOT>/g, '.').trim())
    .filter(s => s.length > 0);
}

/**
 * Find the position where the original segment starts in the search text
 */
function findSegmentPosition(searchText: string, originalSegment: string): number {
  const normalizedSearch = searchText.toLowerCase().replace(/\s+/g, ' ');
  const normalizedSegment = originalSegment.toLowerCase().replace(/\s+/g, ' ').trim();

  // Try to find the exact segment
  let pos = normalizedSearch.indexOf(normalizedSegment);
  if (pos !== -1) return pos;

  // If not found exactly, try to find the first few words
  const words = normalizedSegment.split(' ');
  for (let wordCount = Math.max(3, words.length); wordCount >= 3; wordCount--) {
    const phrase = words.slice(0, wordCount).join(' ');
    pos = normalizedSearch.indexOf(phrase);
    if (pos !== -1) return pos;
  }

  return -1;
}

/**
 * Find complete sentence(s) that contain the matched segment
 * This ensures we show the beginning of the sentence AND continue until
 * we've shown enough context (or the sentence ends)
 */
function findMatchingSentences(text: string, originalSegment: string): string {
  // Find where the original segment appears in the text
  const segmentPos = findSegmentPosition(text, originalSegment);
  if (segmentPos === -1) {
    // Couldn't find the segment, return as is
    return originalSegment;
  }

  const sentences = splitIntoSentences(text);

  // Find which sentence contains the segment start position
  let charCount = 0;
  let startSentenceIdx = -1;

  for (let i = 0; i < sentences.length; i++) {
    const sentenceLength = sentences[i].length + 1; // +1 for space or punctuation
    if (charCount <= segmentPos && segmentPos < charCount + sentenceLength) {
      startSentenceIdx = i;
      break;
    }
    charCount += sentenceLength;
  }

  if (startSentenceIdx === -1) {
    return originalSegment;
  }

  // Start from the sentence that contains the segment
  const matchingSentences: string[] = [sentences[startSentenceIdx]];

  // Continue adding sentences until we've shown at least 150 characters
  // or we've included the next sentence (whichever gives more context)
  let totalLength = sentences[startSentenceIdx].length;
  let nextIdx = startSentenceIdx + 1;

  while (nextIdx < sentences.length && (totalLength < 150 || nextIdx === startSentenceIdx + 1)) {
    matchingSentences.push(sentences[nextIdx]);
    totalLength += sentences[nextIdx].length;
    nextIdx++;

    // Don't add more than 2 sentences unless really needed
    if (nextIdx > startSentenceIdx + 1 && totalLength >= 150) {
      break;
    }
  }

  return matchingSentences.join(' ');
}

/**
 * Extract complete sentences from search context that contain the matched segment
 *
 * @param searchText - The full search context (multiple segments stitched together)
 * @param originalSegment - The original matched segment text
 * @returns Complete sentence(s) containing the match
 */
export function extractCompleteSentences(
  searchText: string,
  originalSegment: string
): string {
  // If search text is the same as original, just try to extract sentences from it
  if (searchText === originalSegment || !searchText || !originalSegment) {
    return originalSegment;
  }

  // Find and return complete sentences from the search context
  return findMatchingSentences(searchText, originalSegment);
}
