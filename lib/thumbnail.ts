/**
 * Utility to ensure thumbnail URLs use R2 public URL
 * Handles migration from YouTube URLs to R2 URLs
 */

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL;

/**
 * Get the correct thumbnail URL, preferring R2 over YouTube
 * @param thumbnailUrl - Original thumbnail URL from database
 * @param youtubeVideoId - YouTube video ID (optional, for constructing R2 URL)
 * @returns R2 public URL or original URL
 */
export function getThumbnailUrl(thumbnailUrl: string | null | undefined, youtubeVideoId?: string): string {
  // Ensure no double slashes in constructed URLs
  const baseUrl = R2_PUBLIC_URL ? (R2_PUBLIC_URL.endsWith('/') ? R2_PUBLIC_URL.slice(0, -1) : R2_PUBLIC_URL) : '';

  // If no thumbnail URL provided, try to construct from video ID
  if (!thumbnailUrl && youtubeVideoId && baseUrl) {
    return `${baseUrl}/fast-video-thumbnails/${youtubeVideoId}.jpg`;
  }

  // If already an R2 URL, fix double slashes if present
  if (thumbnailUrl?.includes('/fast-video-thumbnails/')) {
    return thumbnailUrl.replace(/([^:]\/)\/+/g, '$1');
  }

  // If it's a YouTube URL and we have the video ID, prefer R2
  if (thumbnailUrl?.includes('ytimg.com') && youtubeVideoId && baseUrl) {
    return `${baseUrl}/fast-video-thumbnails/${youtubeVideoId}.jpg`;
  }

  // Otherwise return original URL (fallback), fixing any double slashes
  return thumbnailUrl ? thumbnailUrl.replace(/([^:]\/)\/+/g, '$1') : '';
}
