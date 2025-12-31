import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getChannelByHandle, getChannelVideos } from '@/lib/youtube/client';
import { getVideoTranscript } from '@/lib/youtube/transcript';
import { uploadThumbnailToR2, uploadChannelThumbnailToR2, uploadChannelBannerToR2 } from '@/lib/r2';
import type { Database } from '@/lib/supabase/database.types';

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

export async function POST(request: NextRequest) {
  const { channelHandle, limit } = await request.json();

  if (!channelHandle) {
    return NextResponse.json(
      { error: 'Channel handle is required' },
      { status: 400 }
    );
  }

  // Use provided limit or default to 50, with max of 1000
  const videoLimit = Math.min(Math.max(1, limit || 50), 1000);

  // Create a streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (data: any) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
      };

      try {

        // Fetch channel info from YouTube
        sendProgress({ type: 'status', message: 'Fetching channel info...' });
        const channelInfo = await getChannelByHandle(channelHandle);

        if (!channelInfo) {
          sendProgress({ type: 'error', message: 'Channel not found' });
          controller.close();
          return;
        }

        console.log('[IMPORT] Channel info:', {
          name: channelInfo.name,
          handle: channelInfo.handle,
          bannerUrl: channelInfo.bannerUrl,
        });

        sendProgress({ type: 'status', message: 'Setting up channel...' });

        // Upload channel thumbnail to R2
        const r2ChannelThumbnailUrl = await uploadChannelThumbnailToR2(
          channelInfo.channelId,
          channelInfo.thumbnailUrl
        );

        // Upload channel banner to R2 (if available)
        let r2ChannelBannerUrl = channelInfo.bannerUrl;
        if (channelInfo.bannerUrl) {
          r2ChannelBannerUrl = await uploadChannelBannerToR2(
            channelInfo.channelId,
            channelInfo.bannerUrl
          );
        }

        // Check if channel already exists (by handle, youtube_channel_handle, or youtube_channel_id)
        const { data: existingChannels } = await supabaseAdmin
      .from('channels')
      .select('id, channel_handle, youtube_channel_id')
      .or(`channel_handle.eq.${channelInfo.handle},youtube_channel_handle.eq.${channelInfo.handle},youtube_channel_id.eq.${channelInfo.channelId}`)
      .limit(1);

    let channelId: string;

    if (existingChannels && existingChannels.length > 0) {
      // @ts-ignore - Supabase type inference issue
      channelId = existingChannels[0].id;
      console.log(`Channel @${channelInfo.handle} already exists, updating...`);

      // Update existing channel
      await supabaseAdmin.from('channels').update({
          channel_name: channelInfo.name,
          channel_description: channelInfo.description,
          thumbnail_url: r2ChannelThumbnailUrl,
          banner_url: r2ChannelBannerUrl,
          subscriber_count: channelInfo.subscriberCount,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', channelId);
    } else {
      // Create new channel
      const { data: newChannel, error: channelError } = await supabaseAdmin
        .from('channels')
        .insert({
          youtube_channel_id: channelInfo.channelId,
          channel_handle: channelInfo.handle,
          youtube_channel_handle: channelInfo.handle,
          channel_name: channelInfo.name,
          channel_description: channelInfo.description,
          thumbnail_url: r2ChannelThumbnailUrl,
          banner_url: r2ChannelBannerUrl,
          subscriber_count: channelInfo.subscriberCount,
          last_synced_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (channelError) {
        console.error('Error creating channel:', channelError);

        // Check if it's a duplicate key error
        if (channelError.code === '23505') {
          sendProgress({
            type: 'error',
            message: `Channel already exists in the database. This channel may have been imported with a different handle.`
          });
        } else {
          sendProgress({
            type: 'error',
            message: `Failed to create channel: ${channelError.message}`
          });
        }
        controller.close();
        return;
      }

      if (!newChannel) {
        sendProgress({ type: 'error', message: 'Failed to create channel - no data returned' });
        controller.close();
        return;
      }

      channelId = newChannel.id;
    }

        // Fetch videos from YouTube
        sendProgress({ type: 'status', message: 'Fetching videos from YouTube...' });
        console.log(`Fetching videos for @${channelInfo.handle}...`);
        const allVideos = await getChannelVideos(channelInfo.channelId);

        // Fetch all existing video IDs for this channel to avoid re-importing
        sendProgress({ type: 'status', message: 'Checking for existing videos...' });
        const { data: existingVideos } = await supabaseAdmin
          .from('videos')
          .select('youtube_video_id, has_transcript')
          .eq('channel_id', channelId);

        const existingVideoMap = new Map(
          (existingVideos || []).map(v => [v.youtube_video_id, v.has_transcript])
        );

        console.log(`Found ${existingVideoMap.size} existing videos in database`);

        // Filter out videos that already exist with transcripts
        const newVideos = allVideos.filter(v => !existingVideoMap.has(v.videoId));
        const videosWithoutTranscripts = allVideos.filter(v =>
          existingVideoMap.has(v.videoId) && !existingVideoMap.get(v.videoId)
        );

        // Combine new videos and videos needing transcripts, up to the limit
        const videosToProcess = [...newVideos, ...videosWithoutTranscripts].slice(0, videoLimit);

        console.log(`Found ${allVideos.length} total videos, ${newVideos.length} new, ${videosWithoutTranscripts.length} need transcripts`);
        console.log(`Processing ${videosToProcess.length} videos (limit: ${videoLimit})`);

        sendProgress({
          type: 'status',
          message: `Found ${newVideos.length} new videos and ${videosWithoutTranscripts.length} videos needing transcripts. Starting import...`
        });

    // Update channel video count with actual total
    await supabaseAdmin
      .from('channels')
      .update({ video_count: allVideos.length })
      .eq('id', channelId);

    let processedCount = 0;
    let transcriptCount = 0;
    let skippedCount = 0;

        // Process each video
        for (const video of videosToProcess) {
          try {
            sendProgress({
              type: 'progress',
              current: processedCount + 1,
              total: videosToProcess.length,
              videoTitle: video.title,
            });

            // Upload thumbnail to R2
            const r2ThumbnailUrl = await uploadThumbnailToR2(
              video.videoId,
              video.thumbnailUrl
            );

        let videoId: string;
        const videoExists = existingVideoMap.has(video.videoId);

        if (videoExists) {
          // Video exists, get its ID and update metadata (but don't re-fetch transcript)
          const { data: existingVideo } = await supabaseAdmin
            .from('videos')
            .select('id')
            .eq('youtube_video_id', video.videoId)
            .single();

          if (!existingVideo) {
            console.error(`Video ${video.videoId} marked as existing but not found in DB`);
            continue;
          }

          videoId = existingVideo.id;

          // Update video metadata
          await supabaseAdmin
            .from('videos')
            .update({
              title: video.title,
              description: video.description,
              thumbnail_url: r2ThumbnailUrl,
              duration_seconds: video.durationSeconds,
              view_count: video.viewCount,
            })
            .eq('id', videoId);
        } else {
          // Create new video
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

          videoId = newVideo.id;
        }

        // Only fetch transcript if video doesn't have one
        const hasTranscript = existingVideoMap.get(video.videoId) || false;
        if (hasTranscript) {
          console.log(`[IMPORT] Skipping transcript for ${video.videoId} - already exists`);
          processedCount++;
          skippedCount++;
          continue;
        }

        // Fetch and save transcript
        console.log(`[IMPORT] Fetching transcript for ${video.videoId} (${video.title})...`);
        const transcript = await getVideoTranscript(video.videoId);

        if (transcript && transcript.length > 0) {
          console.log(`[IMPORT] Saving ${transcript.length} transcript segments for ${video.videoId}...`);
          // Save transcript segments
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
            console.error(`[IMPORT] Error saving transcript for video ${video.videoId}:`, transcriptError);
          } else {
            console.log(`[IMPORT] Successfully saved transcript for video ${video.videoId}`);
            // Update video to mark transcript as available
            console.log(`[IMPORT] Updating has_transcript flag for database video ID: ${videoId}, YouTube ID: ${video.videoId}`);
            const { error: updateError } = await supabaseAdmin
              .from('videos')
              .update({
                has_transcript: true,
                transcript_language: 'en',
              })
              .eq('id', videoId);

            if (updateError) {
              console.error(`[IMPORT] Error updating has_transcript flag for video ${video.videoId} (DB ID: ${videoId}):`, updateError);
            } else {
              console.log(`[IMPORT] Successfully updated has_transcript=true for video ${video.videoId} (DB ID: ${videoId})`);
            }

            transcriptCount++;
          }
        } else {
          console.log(`[IMPORT] No transcript found for ${video.videoId} - transcript was null or empty`);
        }

            processedCount++;
            console.log(`Processed ${processedCount}/${videosToProcess.length} videos`);
          } catch (error) {
            console.error(`Error processing video ${video.videoId}:`, error);
          }
        }

        // Update has_transcript flag for all videos in this channel that have transcripts
        sendProgress({ type: 'status', message: 'Updating transcript flags...' });

        // First, get all video IDs for this channel
        const { data: channelVideos } = await supabaseAdmin
          .from('videos')
          .select('id')
          .eq('channel_id', channelId);

        if (channelVideos && channelVideos.length > 0) {
          const channelVideoIds = channelVideos.map(v => v.id);

          // Get all video IDs that have transcripts
          const { data: videoIdsWithTranscripts } = await supabaseAdmin
            .from('transcripts')
            .select('video_id')
            .in('video_id', channelVideoIds);

          if (videoIdsWithTranscripts && videoIdsWithTranscripts.length > 0) {
            const uniqueVideoIds = [...new Set(videoIdsWithTranscripts.map(t => t.video_id))];

            const { error: updateError } = await supabaseAdmin
              .from('videos')
              .update({ has_transcript: true })
              .in('id', uniqueVideoIds);

            if (updateError) {
              console.error('Error updating has_transcript flags:', updateError);
            } else {
              console.log(`Updated has_transcript flag for ${uniqueVideoIds.length} videos`);
            }
          }
        }

        // Fetch the database channel info to get the channel_handle
        const { data: dbChannel } = await supabaseAdmin
          .from('channels')
          .select('channel_handle')
          .eq('id', channelId)
          .single();

        sendProgress({
          type: 'complete',
          channel: {
            ...channelInfo,
            channelHandle: dbChannel?.channel_handle || channelInfo.handle,
          },
          videosProcessed: processedCount,
          transcriptsDownloaded: transcriptCount,
          skippedExisting: skippedCount,
        });

        controller.close();
      } catch (error) {
        console.error('Error importing channel:', error);
        sendProgress({ type: 'error', message: 'Failed to import channel' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
