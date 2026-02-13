import { NextRequest } from 'next/server';
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

function isWithinHours(publishedAt: string, hours: number): boolean {
  const publishedDate = parseRelativeTime(publishedAt);
  if (!publishedDate) {
    return false;
  }

  const now = new Date();
  const cutoffDate = new Date(now.getTime() - hours * 60 * 60 * 1000);
  const videoDate = new Date(publishedDate);

  return videoDate >= cutoffDate;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const log = (message: string) => {
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'log', message }) + '\n'));
      };

      const startTime = Date.now();
      // Set safety timeout to 4 minutes (240 seconds) to leave 60 seconds buffer before Vercel's 5-minute timeout
      const MAX_EXECUTION_TIME_MS = 240 * 1000; // 4 minutes

      const isTimeoutApproaching = () => {
        const elapsed = Date.now() - startTime;
        return elapsed > MAX_EXECUTION_TIME_MS;
      };

      // Send job started email
      await sendCronJobStartedEmail();
      log('[INFO] Starting video import job');
      log('[INFO] Email notification sent to systems@reorbit.com');

      const metrics = {
        channels: [] as Array<{ channelName: string; videosImported: number }>,
        errors: [] as string[],
        elapsedTimeMs: 0,
      };

      try {
        log('[INFO] Fetching channels from database...');

        // Fetch all channels
        const { data: channels, error: channelsError } = await supabaseAdmin
          .from('channels')
          .select('id, channel_name, youtube_channel_id, youtube_channel_handle, is_music_channel')
          .order('channel_name');

        if (channelsError) {
          log(`[ERROR] Failed to fetch channels: ${channelsError.message}`);
          metrics.errors.push(`Failed to fetch channels: ${channelsError.message}`);
          metrics.elapsedTimeMs = Date.now() - startTime;
          await sendCronJobCompletedEmail(metrics);
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', message: 'Failed to fetch channels' }) + '\n'));
          controller.close();
          return;
        }

        if (!channels || channels.length === 0) {
          log('[INFO] No channels found');
          metrics.elapsedTimeMs = Date.now() - startTime;
          await sendCronJobCompletedEmail(metrics);
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'complete', metrics }) + '\n'));
          controller.close();
          return;
        }

        log(`[INFO] Processing ${channels.length} channels`);
        log(`[INFO] Will stop processing after 4 minutes to avoid timeout`);
        log('');

        let timeoutReached = false;

        // Process each channel
        for (const channel of channels) {
          // Check if we're approaching timeout before starting a new channel
          if (isTimeoutApproaching()) {
            log('[WARNING] ========================================');
            log('[WARNING] Approaching timeout limit (4 minutes)');
            log('[WARNING] Stopping processing to avoid Vercel timeout');
            log('[WARNING] Run the job again to continue importing remaining channels');
            timeoutReached = true;
            break;
          }

          try {
            log(`[INFO] ========================================`);
            log(`[INFO] Channel: ${channel.channel_name}`);
            log(`[INFO] Database ID: ${channel.id}`);
            log(`[INFO] YouTube ID: ${channel.youtube_channel_id || 'Not set'}`);
            log(`[INFO] YouTube Handle: ${channel.youtube_channel_handle || 'Not set'}`);

            // Resolve YouTube channel ID from handle if not present or if ID looks like a handle
            let youtubeChannelId = channel.youtube_channel_id;

            // Check if we need to resolve the handle
            // A proper channel ID starts with "UC", if it doesn't, it's likely a handle
            const needsResolution = !youtubeChannelId ||
                                   (youtubeChannelId && !youtubeChannelId.startsWith('UC'));

            if (needsResolution) {
              const handleToResolve = channel.youtube_channel_handle || youtubeChannelId;

              if (!handleToResolve) {
                log(`[ERROR] Skipping - no YouTube channel ID or handle configured`);
                metrics.errors.push(`${channel.channel_name}: No YouTube channel ID or handle configured`);
                continue;
              }

              log(`[INFO] Resolving channel ID from handle: ${handleToResolve}`);
              const channelInfo = await getChannelByHandle(handleToResolve);

              if (channelInfo) {
                youtubeChannelId = channelInfo.channelId;
                log(`[INFO] Resolved channel ID: ${youtubeChannelId}`);

                // Update the database with the resolved channel ID
                await supabaseAdmin
                  .from('channels')
                  .update({
                    youtube_channel_id: youtubeChannelId,
                    youtube_channel_handle: channelInfo.handle
                  })
                  .eq('id', channel.id);
                log(`[INFO] Updated database with resolved channel ID`);
              } else {
                log(`[ERROR] Failed to resolve channel ID from handle`);
                metrics.errors.push(`${channel.channel_name}: Could not resolve YouTube channel from handle`);
                continue;
              }
            }

            if (!youtubeChannelId) {
              log(`[ERROR] Skipping - no YouTube channel ID or handle configured`);
              metrics.errors.push(`${channel.channel_name}: No YouTube channel ID or handle configured`);
              continue;
            }

            log(`[INFO] Fetching videos from YouTube...`);

            // Fetch regular and live videos
            const regularVideos = await getChannelVideos(youtubeChannelId, 100);
            const liveVideos = await getChannelLiveVideos(youtubeChannelId, 100);

            // Combine and deduplicate
            const liveVideoIds = new Set(liveVideos.map(v => v.videoId));
            const allVideos = [
              ...liveVideos,
              ...regularVideos.filter(v => !liveVideoIds.has(v.videoId))
            ];

            log(`[INFO] Found ${allVideos.length} videos (${regularVideos.length} regular, ${liveVideos.length} live)`);

            // Filter videos from last 4 weeks (672 hours)
            const recentVideos = allVideos.filter(video => isWithinHours(video.publishedAt, 672));
            log(`[INFO] ${recentVideos.length} videos from last 4 weeks`);

            if (recentVideos.length === 0) {
              log(`[INFO] No recent videos to import, skipping`);
              log('');
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

            log(`[INFO] ${newVideos.length} new videos to import`);

            if (newVideos.length === 0) {
              log(`[INFO] All recent videos already imported, skipping`);
              log('');
              continue;
            }

            let importedCount = 0;
            const importedVideoDbIds: string[] = [];

            // Import each new video
            for (const video of newVideos) {
              // Check timeout before each video import
              if (isTimeoutApproaching()) {
                log('[WARNING] Timeout approaching, stopping video imports for this channel');
                log(`[WARNING] ${newVideos.length - importedCount} videos remaining for ${channel.channel_name}`);
                timeoutReached = true;
                break;
              }

              try {
                log(`[INFO] Importing: ${video.title}`);

                // Upload thumbnail
                const r2ThumbnailUrl = await uploadThumbnailToR2(video.videoId, video.thumbnailUrl);

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
                  log(`[ERROR] Failed to create video record`);
                  metrics.errors.push(`${channel.channel_name}: Failed to create video ${video.title}`);
                  continue;
                }

                const videoId = newVideo.id;

                // Skip transcript fetching for music channels
                if (channel.is_music_channel) {
                  log(`[INFO] Skipping transcript fetch for music channel`);
                  importedCount++;
                  continue;
                }

                // Fetch transcript
                log(`[INFO] Fetching transcript...`);
                const transcript = await getVideoTranscript(video.videoId, false);

                if (transcript && transcript.length > 0) {
                  log(`[INFO] Saving ${transcript.length} transcript segments`);

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
                    log(`[ERROR] Failed to save transcript`);
                    metrics.errors.push(`${channel.channel_name}: Failed to save transcript for ${video.title}`);
                  } else {
                    await supabaseAdmin
                      .from('videos')
                      .update({ has_transcript: true })
                      .eq('id', videoId);

                    // Generate embeddings (skip for music channels)
                    if (process.env.OPENAI_API_KEY && !channel.is_music_channel) {
                      log(`[INFO] Generating embeddings...`);
                      try {
                        const response = await fetch(new URL('/api/embeddings/generate', request.url), {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ videoId: videoId, batchSize: 100 }),
                        });

                        if (!response.ok) {
                          log(`[ERROR] Failed to generate embeddings`);
                          metrics.errors.push(`${channel.channel_name}: Failed to generate embeddings for ${video.title}`);
                        } else {
                          log(`[INFO] Embeddings generated successfully`);
                        }
                      } catch (error) {
                        log(`[ERROR] Error generating embeddings`);
                        metrics.errors.push(`${channel.channel_name}: Error generating embeddings for ${video.title}`);
                      }
                    } else if (channel.is_music_channel) {
                      log(`[INFO] Skipping embedding generation for music channel`);
                    }

                    log(`[SUCCESS] Video imported successfully`);
                    importedVideoDbIds.push(videoId);
                  }
                } else {
                  log(`[ERROR] No transcript available`);
                  metrics.errors.push(`${channel.channel_name}: No transcript available for ${video.title}`);
                }

                importedCount++;
              } catch (error) {
                log(`[ERROR] Failed to import video: ${error instanceof Error ? error.message : 'Unknown error'}`);
                metrics.errors.push(`${channel.channel_name}: Error importing ${video.title}`);
              }
            }

            // Refresh search index for newly imported videos
            if (importedVideoDbIds.length > 0) {
              log(`[INFO] Refreshing search index for ${importedVideoDbIds.length} videos...`);
              const { error: refreshError } = await supabaseAdmin
                .rpc('refresh_transcript_search_for_videos', {
                  p_video_ids: importedVideoDbIds,
                });
              if (refreshError) {
                log(`[ERROR] Search index refresh failed: ${refreshError.message}`);
              } else {
                log(`[SUCCESS] Search index refreshed for ${importedVideoDbIds.length} videos`);
              }
            }

            if (importedCount > 0) {
              metrics.channels.push({
                channelName: channel.channel_name,
                videosImported: importedCount,
              });
            }

            log(`[SUCCESS] Finished processing ${channel.channel_name}: ${importedCount} videos imported`);
            log('');

            // If timeout was reached during this channel, break out of channel loop
            if (timeoutReached) {
              break;
            }
          } catch (error) {
            log(`[ERROR] Failed to process channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
            metrics.errors.push(`${channel.channel_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        metrics.elapsedTimeMs = Date.now() - startTime;

        log('[INFO] ========================================');

        if (timeoutReached) {
          log(`[WARNING] Job stopped early after ${(metrics.elapsedTimeMs / 1000).toFixed(2)}s to avoid timeout`);
          log('[WARNING] Some channels may not have been processed');
          log('[WARNING] Run the import again to continue processing remaining videos');
        } else {
          log(`[SUCCESS] Job completed in ${(metrics.elapsedTimeMs / 1000).toFixed(2)}s`);
        }

        log(`[INFO] Sending completion email...`);

        // Send completion email
        await sendCronJobCompletedEmail(metrics);

        controller.enqueue(encoder.encode(JSON.stringify({
          type: timeoutReached ? 'partial' : 'complete',
          metrics,
          timeoutReached
        }) + '\n'));
        controller.close();
      } catch (error) {
        log(`[ERROR] Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        metrics.errors.push(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        metrics.elapsedTimeMs = Date.now() - startTime;
        await sendCronJobCompletedEmail(metrics);

        controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', message: error instanceof Error ? error.message : 'Unknown error' }) + '\n'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
