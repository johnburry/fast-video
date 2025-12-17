import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

// Initialize R2 client (S3-compatible)
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL!;

/**
 * Download a YouTube thumbnail and upload it to R2
 * @param youtubeVideoId - YouTube video ID
 * @param thumbnailUrl - Original YouTube thumbnail URL
 * @returns R2 public URL for the thumbnail
 */
export async function uploadThumbnailToR2(
  youtubeVideoId: string,
  thumbnailUrl: string
): Promise<string> {
  const key = `fast-video-thumbnails/${youtubeVideoId}.jpg`;

  try {
    // Check if thumbnail already exists in R2
    try {
      await r2Client.send(
        new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        })
      );
      // If no error, file exists - return the URL (no double slashes)
      const baseUrl = PUBLIC_URL.endsWith('/') ? PUBLIC_URL.slice(0, -1) : PUBLIC_URL;
      return `${baseUrl}/${key}`;
    } catch (headError: any) {
      // File doesn't exist, proceed with upload
      if (headError.name !== 'NotFound') {
        throw headError;
      }
    }

    // Download the thumbnail from YouTube
    const response = await fetch(thumbnailUrl);
    if (!response.ok) {
      throw new Error(`Failed to download thumbnail: ${response.statusText}`);
    }

    const imageBuffer = await response.arrayBuffer();

    // Upload to R2
    await r2Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: Buffer.from(imageBuffer),
        ContentType: 'image/jpeg',
      })
    );

    // Ensure no double slashes in URL
    const baseUrl = PUBLIC_URL.endsWith('/') ? PUBLIC_URL.slice(0, -1) : PUBLIC_URL;
    const r2Url = `${baseUrl}/${key}`;
    console.log(`Uploaded thumbnail for ${youtubeVideoId} to R2: ${r2Url}`);
    return r2Url;
  } catch (error) {
    console.error(`Error uploading thumbnail to R2 for ${youtubeVideoId}:`, error);
    // Return original URL as fallback
    return thumbnailUrl;
  }
}

/**
 * Download a channel thumbnail and upload it to R2
 * @param channelId - YouTube channel ID
 * @param thumbnailUrl - Original YouTube channel thumbnail URL
 * @returns R2 public URL for the channel thumbnail
 */
export async function uploadChannelThumbnailToR2(
  channelId: string,
  thumbnailUrl: string
): Promise<string> {
  const key = `fast-video-thumbnails/channels/${channelId}.jpg`;

  try {
    // Check if thumbnail already exists in R2
    try {
      await r2Client.send(
        new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        })
      );
      // If no error, file exists - return the URL (no double slashes)
      const baseUrl = PUBLIC_URL.endsWith('/') ? PUBLIC_URL.slice(0, -1) : PUBLIC_URL;
      return `${baseUrl}/${key}`;
    } catch (headError: any) {
      // File doesn't exist, proceed with upload
      if (headError.name !== 'NotFound') {
        throw headError;
      }
    }

    // Download the thumbnail from YouTube
    const response = await fetch(thumbnailUrl);
    if (!response.ok) {
      throw new Error(`Failed to download channel thumbnail: ${response.statusText}`);
    }

    const imageBuffer = await response.arrayBuffer();

    // Upload to R2
    await r2Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: Buffer.from(imageBuffer),
        ContentType: 'image/jpeg',
      })
    );

    // Ensure no double slashes in URL
    const baseUrl = PUBLIC_URL.endsWith('/') ? PUBLIC_URL.slice(0, -1) : PUBLIC_URL;
    const r2Url = `${baseUrl}/${key}`;
    console.log(`Uploaded channel thumbnail for ${channelId} to R2: ${r2Url}`);
    return r2Url;
  } catch (error) {
    console.error(`Error uploading channel thumbnail to R2 for ${channelId}:`, error);
    // Return original URL as fallback
    return thumbnailUrl;
  }
}

/**
 * Download a channel banner and upload it to R2
 * @param channelId - YouTube channel ID
 * @param bannerUrl - Original YouTube channel banner URL
 * @returns R2 public URL for the channel banner
 */
export async function uploadChannelBannerToR2(
  channelId: string,
  bannerUrl: string
): Promise<string> {
  const key = `fast-video-thumbnails/banners/${channelId}.jpg`;

  try {
    // Check if banner already exists in R2
    try {
      await r2Client.send(
        new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        })
      );
      // If no error, file exists - return the URL (no double slashes)
      const baseUrl = PUBLIC_URL.endsWith('/') ? PUBLIC_URL.slice(0, -1) : PUBLIC_URL;
      return `${baseUrl}/${key}`;
    } catch (headError: any) {
      // File doesn't exist, proceed with upload
      if (headError.name !== 'NotFound') {
        throw headError;
      }
    }

    // Download the banner from YouTube
    const response = await fetch(bannerUrl);
    if (!response.ok) {
      throw new Error(`Failed to download channel banner: ${response.statusText}`);
    }

    const imageBuffer = await response.arrayBuffer();

    // Upload to R2
    await r2Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: Buffer.from(imageBuffer),
        ContentType: 'image/jpeg',
      })
    );

    // Ensure no double slashes in URL
    const baseUrl = PUBLIC_URL.endsWith('/') ? PUBLIC_URL.slice(0, -1) : PUBLIC_URL;
    const r2Url = `${baseUrl}/${key}`;
    console.log(`Uploaded channel banner for ${channelId} to R2: ${r2Url}`);
    return r2Url;
  } catch (error) {
    console.error(`Error uploading channel banner to R2 for ${channelId}:`, error);
    // Return original URL as fallback
    return bannerUrl;
  }
}

/**
 * Get the R2 URL for a thumbnail, or return the original URL if not in R2
 */
export function getThumbnailUrl(youtubeVideoId: string, originalUrl?: string): string {
  if (PUBLIC_URL) {
    return `${PUBLIC_URL}/fast-video-thumbnails/${youtubeVideoId}.jpg`;
  }
  return originalUrl || '';
}
