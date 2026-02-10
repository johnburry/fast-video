import { inngest } from '@/lib/inngest/client';
import { supabaseAdmin } from '@/lib/supabase/server';
import { importChannel, ImportProgress } from '@/lib/import/channelImport';

// This is a background job that can run for hours without timing out
export const importChannelJob = inngest.createFunction(
  {
    id: 'import-channel',
    name: 'Import YouTube Channel',
    // No retries - imports should only run once per request
    retries: 0,
  },
  { event: 'channel/import.requested' },
  async ({ event, step }) => {
    const { jobId, channelHandle, limit, includeLiveVideos, skipTranscripts, transcriptsOnly, tenantId } = event.data;

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
      // Run the import with progress tracking
      await step.run('import-channel-data', async () => {
        await importChannel({
          channelHandle,
          limit,
          includeLiveVideos,
          skipTranscripts,
          transcriptsOnly,
          tenantId,
          jobId,
          onProgress: async (progress: ImportProgress) => {
            // Update job progress in database
            const updateData: any = {
              progress: {
                type: progress.type,
                message: progress.message,
                current: progress.current,
                total: progress.total,
                videoTitle: progress.videoTitle,
              }
            };

            // Update specific fields if available
            if (progress.current !== undefined) {
              updateData.videos_processed = progress.current;
            }
            if (progress.total !== undefined) {
              updateData.videos_total = progress.total;
            }
            if (progress.videoTitle) {
              updateData.current_video_title = progress.videoTitle;
            }
            if (progress.transcriptsDownloaded !== undefined) {
              updateData.transcripts_downloaded = progress.transcriptsDownloaded;
            }
            if (progress.embeddingsGenerated !== undefined) {
              updateData.embeddings_generated = progress.embeddingsGenerated;
            }

            await supabaseAdmin
              .from('channel_import_jobs')
              .update(updateData)
              .eq('id', jobId);
          },
        });
      });

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

      return { success: true, jobId };
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
