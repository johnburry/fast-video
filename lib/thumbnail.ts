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
  // If no thumbnail URL provided, try to construct from video ID
  if (!thumbnailUrl && youtubeVideoId && R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/fast-video-thumbnails/${youtubeVideoId}.jpg`;
  }

  // If already an R2 URL, return as-is
  if (thumbnailUrl?.includes('/fast-video-thumbnails/')) {
    return thumbnailUrl;
  }

  // If it's a YouTube URL and we have the video ID, prefer R2
  if (thumbnailUrl?.includes('ytimg.com') && youtubeVideoId && R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/fast-video-thumbnails/${youtubeVideoId}.jpg`;
  }

  // Otherwise return original URL (fallback)
  return thumbnailUrl || '';
}
