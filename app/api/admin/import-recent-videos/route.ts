import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getChannelVideos, getChannelLiveVideos, getChannelByHandle } from '@/lib/youtube/client';
import { getVideoTranscript } from '@/lib/youtube/transcript';
import { uploadThumbnailToR2 } from '@/lib/r2';
import { sendCronJobStartedEmail, sendCronJobCompletedEmail } from '@/lib/mailgun';

// Parse relative time strings like "5 days ago" to ISO timestamp
function parseRelativeTime(relativeTime: string): string | null {
  if (!relativeTime) return null;

  const now = new Date();
  const match = relativeTime.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i);

  if (!match) {
    // Try to parse as ISO date
    const date = new Date(relativeTime);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    return null;
  }

  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 'second':
      now.setSeconds(now.getSeconds() - amount);
      break;
    case 'minute':
      now.setMinutes(now.getMinutes() - amount);
      break;
    case 'hour':
      now.setHours(now.getHours() - amount);
      break;
    case 'day':
      now.setDate(now.getDate() - amount);
      break;
    case 'week':
      now.setDate(now.getDate() - amount * 7);
      break;
    case 'month':
      now.setMonth(now.getMonth() - amount);
      break;
    case 'year':
      now.setFullYear(now.getFullYear() - amount);
      break;
    default:
      return null;
  }

  return now.toISOString();
}

// Check if a video is within the last N hours
function isWithinHours(publishedAt: string, hours: number): boolean {
  const publishedDate = parseRelativeTime(publishedAt);
  if (!publishedDate) {
    console.log(`[CRON] Failed to parse date: "${publishedAt}"`);
    return false;
  }

  const now = new Date();
  const cutoffDate = new Date(now.getTime() - hours * 60 * 60 * 1000);
  const videoDate = new Date(publishedDate);

  const isWithin = videoDate >= cutoffDate;

  return isWithin;
}

async function runImportJob(request: NextRequest) {
  const startTime = Date.now();

  // Send job started email
  await sendCronJobStartedEmail();

  console.log('[CRON] Starting video import job');

  const metrics = {
    channels: [] as Array<{ channelName: string; videosImported: number }>,
    errors: [] as string[],
    elapsedTimeMs: 0,
  };

  try {
    // Fetch all channels
    const { data: channels, error: channelsError } = await supabaseAdmin
      .from('channels')
      .select('id, channel_name, youtube_channel_id, youtube_channel_handle, is_music_channel')
      .order('channel_name');

    if (channelsError) {
      console.error('[CRON] Error fetching channels:', channelsError);
      metrics.errors.push(`Failed to fetch channels: ${channelsError.message}`);
      metrics.elapsedTimeMs = Date.now() - startTime;
      await sendCronJobCompletedEmail(metrics);
      return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 });
    }

    if (!channels || channels.length === 0) {
      console.log('[CRON] No channels found');
      metrics.elapsedTimeMs = Date.now() - startTime;
      await sendCronJobCompletedEmail(metrics);
      return NextResponse.json({ message: 'No channels to process' });
    }

    console.log(`[CRON] Processing ${channels.length} channels`);

    // Process each channel
    for (const channel of channels) {
      try {
        console.log(`[CRON] Processing channel: ${channel.channel_name} (ID: ${channel.id}, YT ID: ${channel.youtube_channel_id}, Handle: ${channel.youtube_channel_handle})`);

        // Resolve YouTube channel ID from handle if not present
        let youtubeChannelId = channel.youtube_channel_id;

        if (!youtubeChannelId && channel.youtube_channel_handle) {
          console.log(`[CRON] No youtube_channel_id, resolving from handle: ${channel.youtube_channel_handle}`);
          const channelInfo = await getChannelByHandle(channel.youtube_channel_handle);

          if (channelInfo) {
            youtubeChannelId = channelInfo.channelId;
            console.log(`[CRON] Resolved channel ID: ${youtubeChannelId}`);

            // Update the database with the resolved channel ID for future use
            await supabaseAdmin
              .from('channels')
              .update({ youtube_channel_id: youtubeChannelId })
              .eq('id', channel.id);
          } else {
            console.log(`[CRON] Failed to resolve channel ID from handle ${channel.youtube_channel_handle}`);
            metrics.errors.push(`${channel.channel_name}: Could not resolve YouTube channel from handle`);
            continue;
          }
        }

        if (!youtubeChannelId) {
          console.log(`[CRON] Skipping ${channel.channel_name} - no youtube_channel_id or youtube_channel_handle`);
          metrics.errors.push(`${channel.channel_name}: No YouTube channel ID or handle configured`);
          continue;
        }

        // Fetch regular videos (limit to 100 to cover 4 weeks)
        const regularVideos = await getChannelVideos(youtubeChannelId, 100);

        // Fetch live videos (limit to 100 to cover 4 weeks)
        const liveVideos = await getChannelLiveVideos(youtubeChannelId, 100);

        // Combine and deduplicate
        const liveVideoIds = new Set(liveVideos.map(v => v.videoId));
        const allVideos = [
          ...liveVideos,
          ...regularVideos.filter(v => !liveVideoIds.has(v.videoId))
        ];

        console.log(`[CRON] Found ${allVideos.length} videos for ${channel.channel_name} (${regularVideos.length} regular, ${liveVideos.length} live)`);

        // Filter videos from last 4 weeks (672 hours)
        const recentVideos = allVideos.filter(video => {
          const isRecent = isWithinHours(video.publishedAt, 672);
          if (!isRecent && allVideos.length > 0) {
            console.log(`[CRON] Video filtered out (too old): ${video.title} - published: ${video.publishedAt}`);
          }
          return isRecent;
        });
        console.log(`[CRON] ${recentVideos.length} videos from last 4 weeks for ${channel.channel_name}`);

        if (recentVideos.length === 0) {
          console.log(`[CRON] No recent videos for ${channel.channel_name}, skipping`);
          continue;
        }

        // Check which videos already exist
        const videoIds = recentVideos.map(v => v.videoId);
        const { data: existingVideos } = await supabaseAdmin
          .from('videos')
          .select('youtube_video_id')
          .eq('channel_id', channel.id)
          .in('youtube_video_id', videoIds);

        const existingVideoIds = new Set(existingVideos?.map(v => v.youtube_video_id) || []);
        const newVideos = recentVideos.filter(v => !existingVideoIds.has(v.videoId));

        console.log(`[CRON] ${newVideos.length} new videos to import for ${channel.channel_name}`);

        if (newVideos.length === 0) {
          console.log(`[CRON] No new videos to import for ${channel.channel_name}, skipping`);
          continue;
        }

        let importedCount = 0;

        // Import each new video
        for (const video of newVideos) {
          try {
            console.log(`[CRON] Importing video: ${video.title} (${video.videoId})`);

            // Upload thumbnail to R2
            const r2ThumbnailUrl = await uploadThumbnailToR2(
              video.videoId,
              video.thumbnailUrl
            );

            // Create video record
            const publishedAt = parseRelativeTime(video.publishedAt);
            const { data: newVideo, error: videoError } = await supabaseAdmin
              .from('videos')
              .insert({
                channel_id: channel.id,
                youtube_video_id: video.videoId,
                title: video.title,
                description: video.description,
                thumbnail_url: r2ThumbnailUrl,
                duration_seconds: video.durationSeconds,
                published_at: publishedAt,
                view_count: video.viewCount,
                like_count: video.likeCount,
                comment_count: video.commentCount,
                has_transcript: false,
              })
              .select('id')
              .single();

            if (videoError || !newVideo) {
              console.error(`[CRON] Error creating video ${video.videoId}:`, videoError);
              metrics.errors.push(`${channel.channel_name}: Failed to create video ${video.title}`);
              continue;
            }

            const videoId = newVideo.id;

            // Skip transcript fetching for music channels
            if (channel.is_music_channel) {
              console.log(`[CRON] Skipping transcript fetch for music channel`);
              importedCount++;
              continue;
            }

            // Fetch transcript
            console.log(`[CRON] Fetching transcript for ${video.videoId}...`);
            const transcript = await getVideoTranscript(video.videoId, false);

            if (transcript && transcript.length > 0) {
              console.log(`[CRON] Saving ${transcript.length} transcript segments for ${video.videoId}...`);

              const transcriptRecords = transcript.map((segment) => ({
                video_id: videoId,
                text: segment.text,
                start_time: segment.startTime,
                duration: segment.duration,
              }));

              const { error: transcriptError } = await supabaseAdmin
                .from('transcripts')
                .insert(transcriptRecords);

              if (transcriptError) {
                console.error(`[CRON] Error saving transcript for video ${video.videoId}:`, transcriptError);
                metrics.errors.push(`${channel.channel_name}: Failed to save transcript for ${video.title}`);
              } else {
                // Update video to mark transcript as available
                await supabaseAdmin
                  .from('videos')
                  .update({ has_transcript: true })
                  .eq('id', videoId);

                // Generate embeddings if OpenAI API key is available
                if (process.env.OPENAI_API_KEY) {
                  try {
                    const response = await fetch(new URL('/api/embeddings/generate', request.url), {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        videoId: videoId,
                        batchSize: 100,
                      }),
                    });

                    if (!response.ok) {
                      console.error(`[CRON] Failed to generate embeddings for video ${video.videoId}`);
                      metrics.errors.push(`${channel.channel_name}: Failed to generate embeddings for ${video.title}`);
                    } else {
                      console.log(`[CRON] Successfully generated embeddings for ${video.videoId}`);
                    }
                  } catch (error) {
                    console.error(`[CRON] Error generating embeddings for video ${video.videoId}:`, error);
                    metrics.errors.push(`${channel.channel_name}: Error generating embeddings for ${video.title}`);
                  }
                }

                console.log(`[CRON] Successfully imported video with transcript: ${video.title}`);
              }
            } else {
              console.log(`[CRON] No transcript available for ${video.videoId}`);
              metrics.errors.push(`${channel.channel_name}: No transcript available for ${video.title}`);
            }

            importedCount++;
          } catch (error) {
            console.error(`[CRON] Error importing video ${video.videoId}:`, error);
            metrics.errors.push(`${channel.channel_name}: Error importing ${video.title} - ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        if (importedCount > 0) {
          metrics.channels.push({
            channelName: channel.channel_name,
            videosImported: importedCount,
          });
        }

        console.log(`[CRON] Finished processing ${channel.channel_name}: ${importedCount} videos imported`);
      } catch (error) {
        console.error(`[CRON] Error processing channel ${channel.channel_name}:`, error);
        metrics.errors.push(`${channel.channel_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    metrics.elapsedTimeMs = Date.now() - startTime;
    console.log(`[CRON] Job completed in ${(metrics.elapsedTimeMs / 1000).toFixed(2)}s`);
    console.log(`[CRON] Total videos imported: ${metrics.channels.reduce((sum, ch) => sum + ch.videosImported, 0)}`);
    console.log(`[CRON] Total errors: ${metrics.errors.length}`);

    // Send completion email with metrics
    await sendCronJobCompletedEmail(metrics);

    return NextResponse.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error('[CRON] Fatal error in cron job:', error);
    metrics.errors.push(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    metrics.elapsedTimeMs = Date.now() - startTime;
    await sendCronJobCompletedEmail(metrics);

    return NextResponse.json(
      { error: 'Cron job failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET handler for Vercel cron jobs
export async function GET(request: NextRequest) {
  return runImportJob(request);
}

// POST handler for manual triggers
export async function POST(request: NextRequest) {
  return runImportJob(request);
}
