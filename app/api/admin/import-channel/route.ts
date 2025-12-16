import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getChannelByHandle, getChannelVideos } from '@/lib/youtube/client';
import { getVideoTranscript } from '@/lib/youtube/transcript';
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
  try {
    const { channelHandle } = await request.json();

    if (!channelHandle) {
      return NextResponse.json(
        { error: 'Channel handle is required' },
        { status: 400 }
      );
    }

    // Fetch channel info from YouTube
    const channelInfo = await getChannelByHandle(channelHandle);

    if (!channelInfo) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    console.log('[IMPORT] Channel info:', {
      name: channelInfo.name,
      handle: channelInfo.handle,
      bannerUrl: channelInfo.bannerUrl,
    });

    // Check if channel already exists
    const { data: existingChannels } = await supabaseAdmin
      .from('channels')
      .select('id, channel_handle')
      .eq('channel_handle', channelInfo.handle)
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
          thumbnail_url: channelInfo.thumbnailUrl,
          banner_url: channelInfo.bannerUrl,
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
          channel_name: channelInfo.name,
          channel_description: channelInfo.description,
          thumbnail_url: channelInfo.thumbnailUrl,
          banner_url: channelInfo.bannerUrl,
          subscriber_count: channelInfo.subscriberCount,
          last_synced_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (channelError || !newChannel) {
        console.error('Error creating channel:', channelError);
        return NextResponse.json(
          { error: 'Failed to create channel' },
          { status: 500 }
        );
      }

      channelId = newChannel.id;
    }

    // Fetch videos from YouTube
    console.log(`Fetching videos for @${channelInfo.handle}...`);
    const allVideos = await getChannelVideos(channelInfo.channelId);

    // Import first 50 videos and fetch transcripts for all
    const videos = allVideos.slice(0, 50);

    console.log(`Found ${allVideos.length} videos, processing first ${videos.length} videos`);

    // Update channel video count
    await supabaseAdmin
      .from('channels')
      .update({ video_count: videos.length })
      .eq('id', channelId);

    let processedCount = 0;
    let transcriptCount = 0;

    // Process each video
    for (const video of videos) {
      try {
        // Check if video already exists
        const { data: existingVideos } = await supabaseAdmin
          .from('videos')
          .select('id, has_transcript')
          .eq('youtube_video_id', video.videoId)
          .limit(1);

        let videoId: string;

        if (existingVideos && existingVideos.length > 0) {
          // @ts-ignore - Supabase type inference issue
          videoId = existingVideos[0].id;

          // Skip if transcript already exists
          // @ts-ignore - Supabase type inference issue
          if (existingVideos[0].has_transcript) {
            processedCount++;
            transcriptCount++;
            continue;
          }

          // Update video info
          await supabaseAdmin
            .from('videos')
            .update({
              title: video.title,
              description: video.description,
              thumbnail_url: video.thumbnailUrl,
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
              thumbnail_url: video.thumbnailUrl,
              duration_seconds: video.durationSeconds,
              published_at: publishedAt,
              view_count: video.viewCount,
              like_count: video.likeCount,
              comment_count: video.commentCount,
            })
            .select('id')
            .single();

          if (videoError || !newVideo) {
            console.error(`Error creating video ${video.videoId}:`, videoError);
            continue;
          }

          videoId = newVideo.id;
        }

        // Fetch and save transcript for all videos
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
            await supabaseAdmin
              .from('videos')
              .update({
                has_transcript: true,
                transcript_language: 'en',
              })
              .eq('id', videoId);

            transcriptCount++;
          }
        } else {
          console.log(`[IMPORT] No transcript found for ${video.videoId} - transcript was null or empty`);
        }

        processedCount++;
        console.log(`Processed ${processedCount}/${videos.length} videos`);
      } catch (error) {
        console.error(`Error processing video ${video.videoId}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      channel: channelInfo,
      videosProcessed: processedCount,
      transcriptsDownloaded: transcriptCount,
    });
  } catch (error) {
    console.error('Error importing channel:', error);
    return NextResponse.json(
      { error: 'Failed to import channel' },
      { status: 500 }
    );
  }
}
