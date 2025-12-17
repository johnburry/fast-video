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
  const key = `thumbnails/${youtubeVideoId}.jpg`;

  try {
    // Check if thumbnail already exists in R2
    try {
      await r2Client.send(
        new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        })
      );
      // If no error, file exists - return the URL
      return `${PUBLIC_URL}/${key}`;
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

    const r2Url = `${PUBLIC_URL}/${key}`;
    console.log(`Uploaded thumbnail for ${youtubeVideoId} to R2: ${r2Url}`);
    return r2Url;
  } catch (error) {
    console.error(`Error uploading thumbnail to R2 for ${youtubeVideoId}:`, error);
    // Return original URL as fallback
    return thumbnailUrl;
  }
}

/**
 * Get the R2 URL for a thumbnail, or return the original URL if not in R2
 */
export function getThumbnailUrl(youtubeVideoId: string, originalUrl?: string): string {
  if (PUBLIC_URL) {
    return `${PUBLIC_URL}/thumbnails/${youtubeVideoId}.jpg`;
  }
  return originalUrl || '';
}
