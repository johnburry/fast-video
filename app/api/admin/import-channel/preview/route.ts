import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getChannelByHandle, getChannelVideos, getChannelLiveVideos } from '@/lib/youtube/client';

export async function POST(request: NextRequest) {
  try {
    const { channelHandle, limit, includeLiveVideos } = await request.json();

    if (!channelHandle) {
      return NextResponse.json(
        { error: 'Channel handle is required' },
        { status: 400 }
      );
    }

    const videoLimit = Math.min(Math.max(1, limit || 50), 5000);
    const shouldIncludeLiveVideos = includeLiveVideos === true;

    // Fetch channel info from YouTube
    const channelInfo = await getChannelByHandle(channelHandle);

    if (!channelInfo) {
      return NextResponse.json(
        { error: 'Channel not found on YouTube' },
        { status: 404 }
      );
    }

    // Check if channel exists in database
    const { data: existingChannels } = await supabaseAdmin
      .from('channels')
      .select('id, channel_handle, youtube_channel_id')
      .or(`channel_handle.eq.${channelInfo.handle},youtube_channel_handle.eq.${channelInfo.handle},youtube_channel_id.eq.${channelInfo.channelId}`)
      .limit(1);

    let channelId: string | null = null;
    if (existingChannels && existingChannels.length > 0) {
      channelId = existingChannels[0].id;
    }

    // Fetch videos from YouTube
    const allVideos = await getChannelVideos(channelInfo.channelId, videoLimit);
    let liveVideos: any[] = [];
    let combinedVideos = allVideos;

    if (shouldIncludeLiveVideos) {
      liveVideos = await getChannelLiveVideos(channelInfo.channelId, 10000);
      const liveVideoIds = new Set(liveVideos.map(v => v.videoId));
      combinedVideos = [
        ...liveVideos,
        ...allVideos.filter(v => !liveVideoIds.has(v.videoId))
      ];
    }

    // Fetch existing videos from database if channel exists
    let existingVideoMap = new Map<string, boolean>();
    let videosWithTranscripts = 0;

    if (channelId) {
      let allExistingVideos: { youtube_video_id: string; has_transcript: boolean }[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: pageVideos, error: fetchError } = await supabaseAdmin
          .from('videos')
          .select('youtube_video_id, has_transcript')
          .eq('channel_id', channelId)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (fetchError) break;

        if (pageVideos && pageVideos.length > 0) {
          allExistingVideos = allExistingVideos.concat(pageVideos);
          hasMore = pageVideos.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      existingVideoMap = new Map(
        allExistingVideos.map(v => [v.youtube_video_id, v.has_transcript])
      );

      videosWithTranscripts = allExistingVideos.filter(v => v.has_transcript).length;
    }

    // Calculate breakdown
    const totalOnYouTube = combinedVideos.length;
    const alreadyImported = existingVideoMap.size;
    const newToImport = combinedVideos.filter(v => !existingVideoMap.has(v.videoId)).length;
    const importedWithTranscripts = videosWithTranscripts;
    const importedWithoutTranscripts = alreadyImported - videosWithTranscripts;

    // Build list of videos that need action (new to import or need transcript)
    const videosNeedingAction = combinedVideos
      .map(v => {
        const hasTranscript = existingVideoMap.get(v.videoId);
        const isNew = !existingVideoMap.has(v.videoId);

        if (isNew || hasTranscript === false) {
          return {
            videoId: v.videoId,
            title: v.title,
            thumbnailUrl: v.thumbnailUrl,
            publishedAt: v.publishedAt,
            status: isNew ? 'needs_import' : 'needs_transcript',
          };
        }
        return null;
      })
      .filter(v => v !== null)
      .sort((a, b) => {
        // Parse relative time to date for sorting (newest first)
        const parseRelativeTime = (relativeTime: string): number => {
          if (!relativeTime) return 0;

          const now = Date.now();
          const match = relativeTime.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i);

          if (!match) {
            const date = new Date(relativeTime);
            return isNaN(date.getTime()) ? 0 : date.getTime();
          }

          const amount = parseInt(match[1], 10);
          const unit = match[2].toLowerCase();

          let milliseconds = 0;
          switch (unit) {
            case 'second': milliseconds = amount * 1000; break;
            case 'minute': milliseconds = amount * 60 * 1000; break;
            case 'hour': milliseconds = amount * 60 * 60 * 1000; break;
            case 'day': milliseconds = amount * 24 * 60 * 60 * 1000; break;
            case 'week': milliseconds = amount * 7 * 24 * 60 * 60 * 1000; break;
            case 'month': milliseconds = amount * 30 * 24 * 60 * 60 * 1000; break;
            case 'year': milliseconds = amount * 365 * 24 * 60 * 60 * 1000; break;
          }

          return now - milliseconds;
        };

        const dateA = parseRelativeTime(a.publishedAt);
        const dateB = parseRelativeTime(b.publishedAt);

        // Sort newest first (descending)
        return dateB - dateA;
      });

    return NextResponse.json({
      channel: {
        name: channelInfo.name,
        handle: channelInfo.handle,
        thumbnailUrl: channelInfo.thumbnailUrl,
        subscriberCount: channelInfo.subscriberCount,
      },
      breakdown: {
        totalOnYouTube,
        alreadyImported,
        newToImport,
        importedWithTranscripts,
        importedWithoutTranscripts,
        needsTranscripts: importedWithoutTranscripts, // Videos that need transcripts
      },
      channelExists: channelId !== null,
      channelId: channelId,
      videos: videosNeedingAction,
    });
  } catch (error) {
    console.error('Error in preview:', error);
    return NextResponse.json(
      { error: 'Failed to fetch channel preview' },
      { status: 500 }
    );
  }
}
