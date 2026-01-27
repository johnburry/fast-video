import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getChannelVideos, getChannelLiveVideos, getChannelByHandle } from '@/lib/youtube/client';

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
  try {
    const { channelId } = await request.json();

    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID required' }, { status: 400 });
    }

    // Fetch channel details
    const { data: channel, error: channelError } = await supabaseAdmin
      .from('channels')
      .select('id, channel_name, youtube_channel_id, youtube_channel_handle, channel_handle')
      .eq('id', channelId)
      .single();

    if (channelError || !channel) {
      return NextResponse.json({ error: 'Channel not found', details: channelError }, { status: 404 });
    }

    const debug: any = {
      channel: channel,
      hasYoutubeChannelId: !!channel.youtube_channel_id,
      hasYoutubeChannelHandle: !!channel.youtube_channel_handle,
      resolvedChannelId: null,
      videos: {
        regular: [],
        live: [],
        combined: [],
        recentOnly: [],
        existingInDb: [],
        newVideos: []
      },
      errors: []
    };

    // Resolve YouTube channel ID from handle if not present
    let youtubeChannelId = channel.youtube_channel_id;

    if (!youtubeChannelId && channel.youtube_channel_handle) {
      debug.errors.push(`Channel has no youtube_channel_id, attempting to resolve from handle: ${channel.youtube_channel_handle}`);

      try {
        const channelInfo = await getChannelByHandle(channel.youtube_channel_handle);

        if (channelInfo) {
          youtubeChannelId = channelInfo.channelId;
          debug.resolvedChannelId = youtubeChannelId;
          debug.errors.push(`Successfully resolved channel ID: ${youtubeChannelId}`);
        } else {
          debug.errors.push(`Failed to resolve channel ID from handle: ${channel.youtube_channel_handle}`);
          return NextResponse.json(debug);
        }
      } catch (error) {
        debug.errors.push(`Error resolving channel from handle: ${error instanceof Error ? error.message : 'Unknown'}`);
        return NextResponse.json(debug);
      }
    }

    if (!youtubeChannelId) {
      debug.errors.push('Channel has no youtube_channel_id or youtube_channel_handle');
      return NextResponse.json(debug);
    }

    try {
      // Fetch regular videos
      debug.videos.regular = await getChannelVideos(youtubeChannelId, 100);
      debug.videos.regularCount = debug.videos.regular.length;
    } catch (error) {
      debug.errors.push(`Error fetching regular videos: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    try {
      // Fetch live videos
      debug.videos.live = await getChannelLiveVideos(youtubeChannelId, 100);
      debug.videos.liveCount = debug.videos.live.length;
    } catch (error) {
      debug.errors.push(`Error fetching live videos: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Combine and deduplicate
    const liveVideoIds = new Set(debug.videos.live.map((v: any) => v.videoId));
    debug.videos.combined = [
      ...debug.videos.live,
      ...debug.videos.regular.filter((v: any) => !liveVideoIds.has(v.videoId))
    ];
    debug.videos.combinedCount = debug.videos.combined.length;

    // Filter for last 72 hours
    const now = new Date();
    const cutoff72h = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    debug.videos.recentOnly = debug.videos.combined.map((video: any) => {
      const parsedDate = parseRelativeTime(video.publishedAt);
      const videoDate = parsedDate ? new Date(parsedDate) : null;
      const isRecent = isWithinHours(video.publishedAt, 72);
      const hoursAgo = videoDate ? (now.getTime() - videoDate.getTime()) / (1000 * 60 * 60) : null;

      return {
        videoId: video.videoId,
        title: video.title,
        publishedAt: video.publishedAt,
        parsedDate: parsedDate,
        isRecent: isRecent,
        hoursAgo: hoursAgo ? hoursAgo.toFixed(1) : 'unknown',
        isLive: liveVideoIds.has(video.videoId)
      };
    });

    debug.videos.recentOnlyFiltered = debug.videos.recentOnly.filter((v: any) => v.isRecent);
    debug.videos.recentCount = debug.videos.recentOnlyFiltered.length;
    debug.currentTime = now.toISOString();
    debug.cutoffTime72h = cutoff72h.toISOString();

    // Check which videos already exist in DB
    if (debug.videos.recentOnlyFiltered.length > 0) {
      const recentVideoIds = debug.videos.recentOnlyFiltered.map((v: any) => v.videoId);
      const { data: existingVideos } = await supabaseAdmin
        .from('videos')
        .select('youtube_video_id, title, created_at')
        .eq('channel_id', channel.id)
        .in('youtube_video_id', recentVideoIds);

      debug.videos.existingInDb = existingVideos || [];
      debug.videos.existingCount = debug.videos.existingInDb.length;

      const existingIds = new Set(debug.videos.existingInDb.map((v: any) => v.youtube_video_id));
      debug.videos.newVideos = debug.videos.recentOnlyFiltered.filter((v: any) => !existingIds.has(v.videoId));
      debug.videos.newCount = debug.videos.newVideos.length;
    }

    return NextResponse.json(debug);
  } catch (error) {
    console.error('[DEBUG] Error:', error);
    return NextResponse.json(
      { error: 'Debug failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
