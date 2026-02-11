/**
 * Shared channel import logic used by both streaming API and Inngest background jobs
 * This file contains the core import logic extracted from the API route
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import { getChannelByHandle, getChannelVideos, getChannelLiveVideos, getYouTubeClient } from '@/lib/youtube/client';
import { getVideoTranscript } from '@/lib/youtube/transcript';
import { uploadThumbnailToR2, uploadChannelThumbnailToR2, uploadChannelBannerToR2 } from '@/lib/r2';
import { isQualityTranscript } from '@/lib/transcriptQuality';

// Sanitize handle for use as subdomain
function sanitizeHandleForSubdomain(handle: string): string {
  return handle
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

// Parse relative time strings
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
    case 'second': now.setSeconds(now.getSeconds() - amount); break;
    case 'minute': now.setMinutes(now.getMinutes() - amount); break;
    case 'hour': now.setHours(now.getHours() - amount); break;
    case 'day': now.setDate(now.getDate() - amount); break;
    case 'week': now.setDate(now.getDate() - amount * 7); break;
    case 'month': now.setMonth(now.getMonth() - amount); break;
    case 'year': now.setFullYear(now.getFullYear() - amount); break;
    default: return null;
  }

  return now.toISOString();
}

export interface ImportProgress {
  type: 'status' | 'progress' | 'complete' | 'error';
  message?: string;
  current?: number;
  total?: number;
  videoTitle?: string;
  channel?: any;
  videosProcessed?: number;
  transcriptsDownloaded?: number;
  embeddingsGenerated?: number;
}

export interface ImportOptions {
  channelHandle: string;
  limit?: number;
  includeLiveVideos?: boolean;
  skipTranscripts?: boolean;
  transcriptsOnly?: boolean; // Only fetch missing transcripts, don't import new videos
  tenantId?: string;
  jobId?: string; // For tracking in database
  onProgress?: (progress: ImportProgress) => void | Promise<void>;
}

/**
 * Main channel import function
 * Can be called from streaming API or Inngest background job
 */
export async function importChannel(options: ImportOptions): Promise<void> {
  const {
    channelHandle,
    limit = 50,
    includeLiveVideos = false,
    skipTranscripts = false,
    transcriptsOnly = false,
    tenantId,
    jobId,
    onProgress = () => {},
  } = options;

  const videoLimit = Math.min(Math.max(1, limit), 5000);

  try {
    // Fetch channel info
    await onProgress({ type: 'status', message: 'Fetching channel info...' });
    const channelInfo = await getChannelByHandle(channelHandle);

    if (!channelInfo) {
      await onProgress({ type: 'error', message: 'Channel not found' });
      throw new Error('Channel not found');
    }

    console.log('[IMPORT] Channel info:', {
      name: channelInfo.name,
      handle: channelInfo.handle,
    });

    // Upload channel assets
    await onProgress({ type: 'status', message: 'Setting up channel...' });
    const r2ChannelThumbnailUrl = await uploadChannelThumbnailToR2(
      channelInfo.channelId,
      channelInfo.thumbnailUrl
    );

    let r2ChannelBannerUrl = channelInfo.bannerUrl;
    if (channelInfo.bannerUrl) {
      r2ChannelBannerUrl = await uploadChannelBannerToR2(
        channelInfo.channelId,
        channelInfo.bannerUrl
      );
    }

    // Check if channel exists
    const { data: existingChannels } = await supabaseAdmin
      .from('channels')
      .select('id, channel_handle, youtube_channel_id, is_music_channel')
      .or(`channel_handle.eq.${channelInfo.handle},youtube_channel_handle.eq.${channelInfo.handle},youtube_channel_id.eq.${channelInfo.channelId}`)
      .limit(1);

    let channelId: string;
    let isMusicChannel = false;

    if (existingChannels && existingChannels.length > 0) {
      channelId = existingChannels[0].id;
      isMusicChannel = existingChannels[0].is_music_channel || false;

      const { data: existingChannel } = await supabaseAdmin
        .from('channels')
        .select('channel_name')
        .eq('id', channelId)
        .single();

      const updateData: any = {
        channel_description: channelInfo.description,
        thumbnail_url: r2ChannelThumbnailUrl,
        banner_url: r2ChannelBannerUrl,
        subscriber_count: channelInfo.subscriberCount,
        last_synced_at: new Date().toISOString(),
      };

      if (!existingChannel?.channel_name) {
        updateData.channel_name = channelInfo.name;
      }

      await supabaseAdmin.from('channels').update(updateData).eq('id', channelId);
    } else {
      const sanitizedHandle = sanitizeHandleForSubdomain(channelInfo.handle);
      const insertData: any = {
        youtube_channel_id: channelInfo.channelId,
        channel_handle: sanitizedHandle,
        youtube_channel_handle: channelInfo.handle,
        channel_name: channelInfo.name,
        channel_description: channelInfo.description,
        thumbnail_url: r2ChannelThumbnailUrl,
        banner_url: r2ChannelBannerUrl,
        subscriber_count: channelInfo.subscriberCount,
        last_synced_at: new Date().toISOString(),
      };

      if (tenantId) {
        insertData.tenant_id = tenantId;
      }

      const { data: newChannel, error: channelError } = await supabaseAdmin
        .from('channels')
        .insert(insertData)
        .select('id')
        .single();

      if (channelError || !newChannel) {
        throw new Error(`Failed to create channel: ${channelError?.message}`);
      }

      channelId = newChannel.id;
    }

    // Update job with channel_id if we have a jobId
    if (jobId) {
      await supabaseAdmin
        .from('channel_import_jobs')
        .update({ progress: { channel_id: channelId, message: 'Channel setup complete' } })
        .eq('id', jobId);
    }

    // Fetch videos from YouTube
    // Note: We fetch up to 10000 videos to get an accurate count and ensure we have enough
    // to select from, even if we only import a subset
    await onProgress({ type: 'status', message: 'Fetching videos from YouTube...' });
    const allVideos = await getChannelVideos(channelInfo.channelId, 10000);

    let liveVideos: any[] = [];
    let combinedVideos = allVideos;

    if (includeLiveVideos) {
      await onProgress({ type: 'status', message: 'Fetching ALL live videos from YouTube...' });
      liveVideos = await getChannelLiveVideos(channelInfo.channelId, 10000);

      const liveVideoIds = new Set(liveVideos.map(v => v.videoId));
      combinedVideos = [
        ...liveVideos,
        ...allVideos.filter(v => !liveVideoIds.has(v.videoId))
      ];
    }

    // Get existing videos from database
    await onProgress({ type: 'status', message: 'Checking for existing videos...' });

    let allExistingVideos: { youtube_video_id: string; has_transcript: boolean }[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: pageVideos } = await supabaseAdmin
        .from('videos')
        .select('youtube_video_id, has_transcript')
        .eq('channel_id', channelId)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (pageVideos && pageVideos.length > 0) {
        allExistingVideos = allExistingVideos.concat(pageVideos);
        hasMore = pageVideos.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    const existingVideoMap = new Map(
      allExistingVideos.map(v => [v.youtube_video_id, v.has_transcript])
    );

    const newVideos = combinedVideos.filter(v => !existingVideoMap.has(v.videoId));
    const existingVideosWithoutTranscripts = combinedVideos.filter(v => {
      const hasTranscript = existingVideoMap.get(v.videoId);
      return existingVideoMap.has(v.videoId) && hasTranscript === false;
    });

    console.log('[IMPORT] Video analysis:', {
      totalFromYouTube: combinedVideos.length,
      existingInDB: allExistingVideos.length,
      newVideos: newVideos.length,
      existingNeedingTranscripts: existingVideosWithoutTranscripts.length,
    });

    // Sort new videos by publish date
    newVideos.sort((a, b) => {
      const dateA = parseRelativeTime(a.publishedAt);
      const dateB = parseRelativeTime(b.publishedAt);
      if (!dateA || !dateB) return 0;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    // Determine which videos to import
    let videosToImport: any[];
    let videosForTranscripts: any[] = [];

    if (transcriptsOnly) {
      // Transcripts Only mode: Only fetch missing transcripts, don't import new videos
      // Sort existing videos without transcripts by publish date (most recent first)
      videosToImport = [];
      videosForTranscripts = existingVideosWithoutTranscripts.slice(0, videoLimit);
    } else {
      // Normal mode: Import new videos, then fill remaining slots with transcript-only
      // Strategy:
      // 1. Import up to videoLimit NEW videos (priority)
      // 2. If fewer than videoLimit new videos, fill remaining slots with existing videos needing transcripts
      // 3. Total processed should be up to videoLimit (or less if not enough videos available)

      if (includeLiveVideos && liveVideos.length > 0) {
        const liveVideoIdsSet = new Set(liveVideos.map(v => v.videoId));
        const liveVideosToImport = newVideos.filter(v => liveVideoIdsSet.has(v.videoId));
        const regularVideosToImport = newVideos.filter(v => !liveVideoIdsSet.has(v.videoId));
        videosToImport = [...liveVideosToImport, ...regularVideosToImport].slice(0, videoLimit);
      } else {
        videosToImport = newVideos.slice(0, videoLimit);
      }

      // Fill remaining slots (if any) with existing videos that need transcripts
      if (!skipTranscripts && videosToImport.length < videoLimit) {
        const remainingSlots = videoLimit - videosToImport.length;
        videosForTranscripts = existingVideosWithoutTranscripts.slice(0, remainingSlots);
      }
    }

    const totalToProcess = videosToImport.length + videosForTranscripts.length;

    console.log('[IMPORT] Final processing plan:', {
      newVideosToImport: videosToImport.length,
      existingNeedingTranscripts: videosForTranscripts.length,
      totalToProcess,
      videoLimit,
    });

    // Update job with total count
    if (jobId) {
      await supabaseAdmin
        .from('channel_import_jobs')
        .update({
          videos_total: totalToProcess,
          progress: { message: `Processing ${totalToProcess} videos...` }
        })
        .eq('id', jobId);
    }

    await onProgress({
      type: 'status',
      message: `Importing ${videosToImport.length} new videos${videosForTranscripts.length > 0 ? ` and fetching ${videosForTranscripts.length} transcripts` : ''}...`
    });

    // Update channel video count
    await supabaseAdmin
      .from('channels')
      .update({ video_count: combinedVideos.length })
      .eq('id', channelId);

    let processedCount = 0;
    let transcriptCount = 0;
    const processedVideoIds: string[] = [];

    // Process new videos
    for (const video of videosToImport) {
      try {
        const isLiveVideo = includeLiveVideos && liveVideos.some(lv => lv.videoId === video.videoId);

        await onProgress({
          type: 'progress',
          current: processedCount + 1,
          total: totalToProcess,
          videoTitle: `${video.title}${isLiveVideo ? ' [LIVE]' : ''}`,
        });

        // Update job progress
        if (jobId) {
          await supabaseAdmin
            .from('channel_import_jobs')
            .update({
              videos_processed: processedCount + 1,
              current_video_title: video.title,
            })
            .eq('id', jobId);
        }

        // Upload thumbnail
        const r2ThumbnailUrl = await uploadThumbnailToR2(
          video.videoId,
          video.thumbnailUrl
        );

        // Create video record
        const publishedAt = parseRelativeTime(video.publishedAt);
        const { data: newVideo, error: videoError } = await supabaseAdmin
          .from('videos')
          .insert({
            channel_id: channelId,
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
          console.error(`Error creating video ${video.videoId}:`, videoError);
          continue;
        }

        const videoId = newVideo.id;
        processedVideoIds.push(videoId);

        // Log video import
        if (jobId) {
          await supabaseAdmin
            .from('channel_import_logs')
            .insert({
              job_id: jobId,
              video_id: videoId,
              youtube_video_id: video.videoId,
              video_title: video.title,
              video_published_at: publishedAt,
              action_type: 'video_imported',
            });
        }

        // Skip transcripts if requested
        if (skipTranscripts) {
          processedCount++;
          continue;
        }

        // Fetch transcript
        await onProgress({
          type: 'status',
          message: `Fetching transcript for: ${video.title}${isLiveVideo ? ' [LIVE]' : ''}...`
        });

        let transcript = await getVideoTranscript(video.videoId, false);

        if (transcript && transcript.length > 0) {
          const transcriptRecords = transcript.map((segment) => ({
            video_id: videoId,
            text: segment.text,
            start_time: segment.startTime,
            duration: segment.duration,
          }));

          // Insert transcripts in batches to avoid hitting database limits
          const batchSize = 100;
          let transcriptError = null;

          for (let i = 0; i < transcriptRecords.length; i += batchSize) {
            const batch = transcriptRecords.slice(i, i + batchSize);
            const { error } = await supabaseAdmin
              .from('transcripts')
              .insert(batch);

            if (error) {
              console.error(`Error inserting transcript batch ${i}-${i + batch.length}:`, error);
              transcriptError = error;
              break;
            }
          }

          if (!transcriptError) {
            // Verify transcripts were inserted correctly using COUNT (not limited by Supabase's 1000-row default)
            const { count: insertedCount, error: countError } = await supabaseAdmin
              .from('transcripts')
              .select('*', { count: 'exact', head: true })
              .eq('video_id', videoId);

            if (countError) {
              console.error(`[IMPORT] Error verifying transcript count for video ${video.videoId}:`, countError);
            } else if (insertedCount !== transcriptRecords.length) {
              console.error(`[IMPORT] Transcript count mismatch for video ${video.videoId}: expected ${transcriptRecords.length}, got ${insertedCount}`);
              transcriptError = new Error(`Transcript verification failed: ${insertedCount}/${transcriptRecords.length} inserted`);
            } else {
              console.log(`[IMPORT] Verified ${insertedCount} transcripts inserted for video ${video.videoId}`);
            }
          }

          if (!transcriptError) {
            const hasQualityTranscript = isQualityTranscript(transcript);

            await supabaseAdmin
              .from('videos')
              .update({
                has_transcript: true,
                has_quality_transcript: hasQualityTranscript,
              })
              .eq('id', videoId);

            transcriptCount++;

            // Log transcript download
            if (jobId) {
              await supabaseAdmin
                .from('channel_import_logs')
                .insert({
                  job_id: jobId,
                  video_id: videoId,
                  youtube_video_id: video.videoId,
                  video_title: video.title,
                  video_published_at: publishedAt,
                  action_type: 'transcript_downloaded',
                });
            }

            // Update job transcript count
            if (jobId) {
              await supabaseAdmin
                .from('channel_import_jobs')
                .update({ transcripts_downloaded: transcriptCount })
                .eq('id', jobId);
            }
          }
        } else if (jobId) {
          // Log transcript skipped (no transcript available)
          await supabaseAdmin
            .from('channel_import_logs')
            .insert({
              job_id: jobId,
              video_id: videoId,
              youtube_video_id: video.videoId,
              video_title: video.title,
              video_published_at: publishedAt,
              action_type: 'transcript_skipped',
            });
        }

        processedCount++;
      } catch (error) {
        console.error(`Error processing video ${video.videoId}:`, error);
      }
    }

    // Process existing videos needing transcripts
    for (const video of videosForTranscripts) {
      try {
        const { data: existingVideo } = await supabaseAdmin
          .from('videos')
          .select('id')
          .eq('youtube_video_id', video.videoId)
          .eq('channel_id', channelId)
          .single();

        if (!existingVideo) continue;

        const videoId = existingVideo.id;

        await onProgress({
          type: 'progress',
          current: processedCount + 1,
          total: totalToProcess,
          videoTitle: `${video.title} [TRANSCRIPT ONLY]`,
        });

        let transcript = await getVideoTranscript(video.videoId, false);

        if (transcript && transcript.length > 0) {
          const transcriptRecords = transcript.map((segment) => ({
            video_id: videoId,
            text: segment.text,
            start_time: segment.startTime,
            duration: segment.duration,
          }));

          // Insert transcripts in batches to avoid hitting database limits
          const batchSize = 100;
          let transcriptError = null;

          for (let i = 0; i < transcriptRecords.length; i += batchSize) {
            const batch = transcriptRecords.slice(i, i + batchSize);
            const { error } = await supabaseAdmin
              .from('transcripts')
              .insert(batch);

            if (error) {
              console.error(`Error inserting transcript batch ${i}-${i + batch.length}:`, error);
              transcriptError = error;
              break;
            }
          }

          if (!transcriptError) {
            // Verify transcripts were inserted correctly using COUNT (not limited by Supabase's 1000-row default)
            const { count: insertedCount, error: countError } = await supabaseAdmin
              .from('transcripts')
              .select('*', { count: 'exact', head: true })
              .eq('video_id', videoId);

            if (countError) {
              console.error(`[IMPORT] Error verifying transcript count for video ${video.videoId}:`, countError);
            } else if (insertedCount !== transcriptRecords.length) {
              console.error(`[IMPORT] Transcript count mismatch for video ${video.videoId}: expected ${transcriptRecords.length}, got ${insertedCount}`);
              transcriptError = new Error(`Transcript verification failed: ${insertedCount}/${transcriptRecords.length} inserted`);
            } else {
              console.log(`[IMPORT] Verified ${insertedCount} transcripts inserted for video ${video.videoId}`);
            }
          }

          if (!transcriptError) {
            const hasQualityTranscript = isQualityTranscript(transcript);

            await supabaseAdmin
              .from('videos')
              .update({
                has_transcript: true,
                has_quality_transcript: hasQualityTranscript,
              })
              .eq('id', videoId);

            transcriptCount++;
            processedVideoIds.push(videoId);

            // Log transcript download
            if (jobId) {
              const publishedAt = parseRelativeTime(video.publishedAt);
              await supabaseAdmin
                .from('channel_import_logs')
                .insert({
                  job_id: jobId,
                  video_id: videoId,
                  youtube_video_id: video.videoId,
                  video_title: video.title,
                  video_published_at: publishedAt,
                  action_type: 'transcript_downloaded',
                });
            }
          } else if (jobId) {
            // Log transcript skipped (no transcript available)
            const publishedAt = parseRelativeTime(video.publishedAt);
            await supabaseAdmin
              .from('channel_import_logs')
              .insert({
                job_id: jobId,
                video_id: videoId,
                youtube_video_id: video.videoId,
                video_title: video.title,
                video_published_at: publishedAt,
                action_type: 'transcript_skipped',
              });
          }
        }

        processedCount++;
      } catch (error) {
        console.error(`Error processing transcript for video ${video.videoId}:`, error);
      }
    }

    // Refresh the search index if we imported/updated any transcripts
    if (transcriptCount > 0 && processedVideoIds.length > 0) {
      await onProgress({
        type: 'status',
        message: 'Refreshing search index...'
      });

      console.log(`[IMPORT] Refreshing search index for ${processedVideoIds.length} videos...`);

      try {
        // Use incremental refresh for just the videos we imported
        // This is much faster than refreshing the entire materialized view
        const { data: refreshData, error: refreshError } = await supabaseAdmin
          .rpc('refresh_transcript_search_for_videos', {
            p_video_ids: processedVideoIds
          });

        if (refreshError) {
          console.error('[IMPORT] Error refreshing search index:', refreshError);
          // Don't fail the import if search refresh fails, just log it
        } else if (refreshData && refreshData.length > 0) {
          const result = refreshData[0];
          console.log(`[IMPORT] Search index refreshed: ${result.message}`);
        } else {
          console.log('[IMPORT] Search index refreshed successfully');
        }
      } catch (error) {
        console.error('[IMPORT] Fatal error refreshing search index:', error);
        // Don't fail the import if search refresh fails
      }
    }

    await onProgress({
      type: 'complete',
      message: 'Import complete!',
      videosProcessed: processedCount,
      transcriptsDownloaded: transcriptCount,
    });

  } catch (error) {
    console.error('Error importing channel:', error);
    await onProgress({
      type: 'error',
      message: error instanceof Error ? error.message : 'Failed to import channel'
    });
    throw error;
  }
}
