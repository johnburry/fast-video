import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

interface SupadataTranscriptSegment {
  text: string;
  offset: number;
  duration: number;
  lang?: string;
}

interface SupadataJobStatusResponse {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  content?: SupadataTranscriptSegment[];
  segments?: SupadataTranscriptSegment[];
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.SUPADATA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'SUPADATA_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Fetch pending jobs (older than 10 seconds to avoid race conditions)
    const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
    const { data: pendingJobs, error: fetchError } = await supabaseAdmin
      .from('transcript_jobs')
      .select('*')
      .in('status', ['pending', 'processing'])
      .lt('created_at', tenSecondsAgo)
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error('[JOBS] Error fetching pending jobs:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch pending jobs' },
        { status: 500 }
      );
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return NextResponse.json({
        message: 'No pending jobs to process',
        processed: 0,
      });
    }

    console.log(`[JOBS] Found ${pendingJobs.length} pending jobs to process`);

    let completedCount = 0;
    let failedCount = 0;
    let stillProcessingCount = 0;

    // Process each job
    for (const job of pendingJobs) {
      try {
        console.log(`[JOBS] Processing job ${job.job_id} for video ${job.video_id}`);

        // Check job status with Supadata API
        const jobUrl = `https://api.supadata.ai/v1/transcript?jobId=${job.job_id}`;
        const jobResponse = await fetch(jobUrl, {
          method: 'GET',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
          },
        });

        if (!jobResponse.ok) {
          console.error(`[JOBS] Job ${job.job_id} status check failed: ${jobResponse.status}`);

          // Mark as failed if it's a 404 or other client error
          if (jobResponse.status === 404 || jobResponse.status >= 400) {
            await supabaseAdmin
              .from('transcript_jobs')
              .update({
                status: 'failed',
                error_message: `API returned ${jobResponse.status}`,
              })
              .eq('id', job.id);
            failedCount++;
          }
          continue;
        }

        const jobData: SupadataJobStatusResponse = await jobResponse.json();
        console.log(`[JOBS] Job ${job.job_id} status: ${jobData.status}`);

        if (jobData.status === 'completed') {
          const segments = jobData.content || jobData.segments;

          if (!segments || segments.length === 0) {
            console.log(`[JOBS] Job ${job.job_id} completed but no segments returned`);
            await supabaseAdmin
              .from('transcript_jobs')
              .update({
                status: 'failed',
                error_message: 'No segments in completed job',
                completed_at: new Date().toISOString(),
              })
              .eq('id', job.id);
            failedCount++;
            continue;
          }

          console.log(`[JOBS] Job ${job.job_id} completed with ${segments.length} segments`);

          // Save transcript segments
          const transcriptRecords = segments
            .filter((segment) => {
              const text = segment.text?.trim();
              const offset = segment.offset;
              const duration = segment.duration;
              return text && text.length > 0 && !isNaN(offset) && !isNaN(duration);
            })
            .map((segment) => ({
              video_id: job.video_id,
              text: segment.text.trim(),
              start_time: segment.offset / 1000, // Convert ms to seconds
              duration: segment.duration / 1000, // Convert ms to seconds
            }));

          if (transcriptRecords.length === 0) {
            console.log(`[JOBS] Job ${job.job_id} had no valid segments after filtering`);
            await supabaseAdmin
              .from('transcript_jobs')
              .update({
                status: 'failed',
                error_message: 'No valid segments after filtering',
                completed_at: new Date().toISOString(),
              })
              .eq('id', job.id);
            failedCount++;
            continue;
          }

          // Insert transcript segments
          const { error: insertError } = await supabaseAdmin
            .from('transcripts')
            .insert(transcriptRecords);

          if (insertError) {
            console.error(`[JOBS] Error inserting transcripts for job ${job.job_id}:`, insertError);
            await supabaseAdmin
              .from('transcript_jobs')
              .update({
                status: 'failed',
                error_message: `Database insert failed: ${insertError.message}`,
              })
              .eq('id', job.id);
            failedCount++;
            continue;
          }

          // Update video has_transcript flag
          await supabaseAdmin
            .from('videos')
            .update({ has_transcript: true })
            .eq('id', job.video_id);

          // Mark job as completed
          await supabaseAdmin
            .from('transcript_jobs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          console.log(`[JOBS] Successfully processed job ${job.job_id} with ${transcriptRecords.length} segments`);
          completedCount++;

        } else if (jobData.status === 'failed') {
          console.log(`[JOBS] Job ${job.job_id} failed: ${jobData.error}`);
          await supabaseAdmin
            .from('transcript_jobs')
            .update({
              status: 'failed',
              error_message: jobData.error || 'Job failed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', job.id);
          failedCount++;

        } else {
          // Still processing or pending
          console.log(`[JOBS] Job ${job.job_id} still ${jobData.status}`);
          await supabaseAdmin
            .from('transcript_jobs')
            .update({ status: jobData.status })
            .eq('id', job.id);
          stillProcessingCount++;
        }

      } catch (error) {
        console.error(`[JOBS] Exception processing job ${job.job_id}:`, error);
        failedCount++;
      }
    }

    return NextResponse.json({
      message: 'Job processing complete',
      totalProcessed: pendingJobs.length,
      completed: completedCount,
      failed: failedCount,
      stillProcessing: stillProcessingCount,
    });

  } catch (error) {
    console.error('[JOBS] Error in process-transcript-jobs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
