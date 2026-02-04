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
  let protected = text
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
  const sentences = protected.split(sentencePattern);

  // Restore the dots and clean up
  return sentences
    .map(s => s.replace(/<DOT>/g, '.').trim())
    .filter(s => s.length > 0);
}

/**
 * Find which sentence(s) contain the search query or matched text
 */
function findMatchingSentences(text: string, originalSegment: string): string {
  const sentences = splitIntoSentences(text);

  // Normalize for comparison (lowercase, remove extra whitespace)
  const normalizedOriginal = originalSegment.toLowerCase().replace(/\s+/g, ' ').trim();

  // Find sentences that contain any part of the original segment
  const matchingSentences: string[] = [];
  const words = normalizedOriginal.split(' ');

  // Look for sentences that contain a significant portion of the matched text
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const normalizedSentence = sentence.toLowerCase().replace(/\s+/g, ' ');

    // Check if this sentence contains a meaningful portion of the original segment
    // (at least 3 consecutive words, or 50% of words if original is short)
    let hasMatch = false;

    // Check for consecutive word matches
    for (let start = 0; start < words.length; start++) {
      for (let end = start + Math.min(3, words.length); end <= words.length; end++) {
        const phrase = words.slice(start, end).join(' ');
        if (normalizedSentence.includes(phrase)) {
          hasMatch = true;
          break;
        }
      }
      if (hasMatch) break;
    }

    if (hasMatch) {
      // Include the matched sentence
      matchingSentences.push(sentence);

      // Optionally include the next sentence if current one is very short
      if (sentence.length < 50 && i + 1 < sentences.length) {
        matchingSentences.push(sentences[i + 1]);
      }
    }
  }

  // If we found matching sentences, return them joined
  if (matchingSentences.length > 0) {
    return matchingSentences.join(' ');
  }

  // Fallback: return the original segment if we couldn't find a good match
  return originalSegment;
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
