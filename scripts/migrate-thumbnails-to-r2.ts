/**
 * Migration script to upload existing YouTube thumbnails to Cloudflare R2
 *
 * Usage: npx tsx scripts/migrate-thumbnails-to-r2.ts
 */

import { createClient } from '@supabase/supabase-js';
import { uploadThumbnailToR2 } from '../lib/r2';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function migrateThumbnails() {
  console.log('Starting thumbnail migration to R2...\n');

  // Fetch all videos with YouTube thumbnails
  const { data: videos, error } = await supabase
    .from('videos')
    .select('id, youtube_video_id, thumbnail_url')
    .like('thumbnail_url', '%ytimg.com%')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching videos:', error);
    return;
  }

  if (!videos || videos.length === 0) {
    console.log('No videos with YouTube thumbnails found.');
    return;
  }

  console.log(`Found ${videos.length} videos with YouTube thumbnails.\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const progress = `[${i + 1}/${videos.length}]`;

    try {
      console.log(`${progress} Processing video ${video.youtube_video_id}...`);

      // Upload to R2
      const r2Url = await uploadThumbnailToR2(
        video.youtube_video_id,
        video.thumbnail_url
      );

      // Update database with R2 URL
      const { error: updateError } = await supabase
        .from('videos')
        .update({ thumbnail_url: r2Url })
        .eq('id', video.id);

      if (updateError) {
        console.error(`${progress} Error updating database:`, updateError);
        errorCount++;
      } else {
        console.log(`${progress} ✓ Updated: ${video.youtube_video_id}`);
        successCount++;
      }
    } catch (error) {
      console.error(`${progress} Error processing ${video.youtube_video_id}:`, error);
      errorCount++;
    }

    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n=== Migration Complete ===');
  console.log(`Successfully migrated: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Total processed: ${videos.length}`);
}

migrateThumbnails().catch(console.error);
