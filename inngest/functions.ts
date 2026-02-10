import { inngest } from '@/lib/inngest/client';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getChannelByHandle, getChannelVideos, getChannelLiveVideos, getYouTubeClient } from '@/lib/youtube/client';
import { getVideoTranscript } from '@/lib/youtube/transcript';
import { uploadThumbnailToR2, uploadChannelThumbnailToR2, uploadChannelBannerToR2 } from '@/lib/r2';
import { isQualityTranscript } from '@/lib/transcriptQuality';

// This is a background job that can run for hours without timing out
export const importChannelJob = inngest.createFunction(
  { id: 'import-channel', name: 'Import YouTube Channel' },
  { event: 'channel/import.requested' },
  async ({ event, step }) => {
    const { jobId, channelHandle, limit, includeLiveVideos, skipTranscripts, tenantId } = event.data;

    // Update job status to 'running'
    await step.run('mark-job-as-running', async () => {
      await supabaseAdmin
        .from('channel_import_jobs')
        .update({
          status: 'running',
          started_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    });

    try {
      // The import logic will go here - we'll extract it from the existing route
      // For now, let's just mark it as a placeholder

      await step.run('update-progress', async () => {
        await supabaseAdmin
          .from('channel_import_jobs')
          .update({
            progress: { message: 'Starting import...' },
          })
          .eq('id', jobId);
      });

      // TODO: Add the full import logic here
      // This is where we'll move all the import code from the route

      // Mark job as completed
      await step.run('mark-job-as-completed', async () => {
        await supabaseAdmin
          .from('channel_import_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', jobId);
      });

      return { success: true };
    } catch (error) {
      // Mark job as failed
      await step.run('mark-job-as-failed', async () => {
        await supabaseAdmin
          .from('channel_import_jobs')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            completed_at: new Date().toISOString(),
          })
          .eq('id', jobId);
      });

      throw error;
    }
  }
);

export default [importChannelJob];
