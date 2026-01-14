import { Innertube } from 'youtubei.js';

let youtubeClient: Innertube | null = null;

export async function getYouTubeClient() {
  if (!youtubeClient) {
    youtubeClient = await Innertube.create();
  }
  return youtubeClient;
}

export interface YouTubeChannelInfo {
  channelId: string;
  handle: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  bannerUrl: string;
  subscriberCount: number;
  videoCount: number;
}

export interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  durationSeconds: number;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

export async function getChannelByHandle(handle: string): Promise<YouTubeChannelInfo | null> {
  try {
    const youtube = await getYouTubeClient();

    // Remove @ if present
    const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;

    // Resolve the handle URL to get the channel endpoint
    const resolved = await youtube.resolveURL(`https://www.youtube.com/@${cleanHandle}`);

    if (!resolved || resolved.payload?.browseId === undefined) {
      console.error('Could not resolve channel handle:', cleanHandle);
      return null;
    }

    const channelId = resolved.payload.browseId;
    const channel = await youtube.getChannel(channelId);

    if (!channel) {
      return null;
    }

    // Type guard for channel header
    const header = channel.header as any;

    console.log('[CHANNEL] Full header keys:', Object.keys(header || {}));
    console.log('[CHANNEL] Header type:', header?.type);

    // Try to get metadata from channel.metadata (more reliable)
    const metadata = channel.metadata as any;
    // Extract name and description
    const name = metadata?.title || header?.author?.name || '';
    const description = metadata?.description || header?.author?.description || '';

    // Try multiple approaches for thumbnail
    const thumbnailUrl = metadata?.avatar?.[0]?.url ||
                         metadata?.thumbnail?.[0]?.url ||
                         header?.author?.best_thumbnail?.url || '';

    // Create banner URL from thumbnail by changing size parameter from s200 to s500
    const bannerUrl = thumbnailUrl ? thumbnailUrl.replace(/=s\d+/g, '=s500') : '';

    console.log('[CHANNEL] Extracted data:', {
      name,
      thumbnailUrl,
      bannerUrl,
    });

    return {
      channelId: channelId,
      handle: cleanHandle,
      name: name,
      description: description,
      thumbnailUrl: thumbnailUrl,
      bannerUrl: bannerUrl,
      subscriberCount: metadata?.subscriber_count?.value || header?.subscribers?.value || 0,
      videoCount: 0, // Will be updated when fetching videos
    };
  } catch (error) {
    console.error('Error fetching channel:', error);
    return null;
  }
}

export async function getChannelVideos(channelId: string, limit: number = 50): Promise<YouTubeVideoInfo[]> {
  try {
    const youtube = await getYouTubeClient();
    const channel = await youtube.getChannel(channelId);

    const videos: YouTubeVideoInfo[] = [];

    // Get videos from the channel's uploads
    let uploads: any = await channel.getVideos();

    // Fetch videos until we reach the limit or run out of videos
    while (videos.length < limit) {
      for (const video of uploads.videos) {
        // Type guard for video object
        const v = video as any;
        if (!v.id) continue;

        // Filter out upcoming/scheduled videos (premieres or scheduled live streams)
        // Check for "upcoming" badge or if the video has no duration (indicates not yet available)
        const isUpcoming = v.upcoming !== undefined && v.upcoming !== null;
        const hasUpcomingBadge = v.badges?.some((badge: any) =>
          badge?.label?.toLowerCase().includes('upcoming') ||
          badge?.label?.toLowerCase().includes('premiere')
        );

        if (isUpcoming || hasUpcomingBadge) {
          console.log(`[YOUTUBE] Skipping upcoming video: ${v.title?.text} (${v.id})`);
          continue;
        }

        videos.push({
          videoId: v.id,
          title: v.title?.text || '',
          description: v.description || '',
          thumbnailUrl: v.best_thumbnail?.url || '',
          durationSeconds: v.duration?.seconds || 0,
          publishedAt: v.published?.text || '',
          viewCount: v.view_count?.value || 0,
          likeCount: 0, // Not available in list view
          commentCount: 0, // Not available in list view
        });

        // Stop if we've reached the limit
        if (videos.length >= limit) break;
      }

      // Check if there are more videos to fetch
      if (videos.length < limit && uploads.has_continuation) {
        uploads = await uploads.getContinuation();
      } else {
        break;
      }
    }

    console.log(`[YOUTUBE] Fetched ${videos.length} videos for channel ${channelId}`);
    return videos;
  } catch (error) {
    console.error('Error fetching channel videos:', error);
    return [];
  }
}

export async function getChannelLiveVideos(channelId: string, limit: number = 5): Promise<YouTubeVideoInfo[]> {
  try {
    const youtube = await getYouTubeClient();
    const channel = await youtube.getChannel(channelId);

    const videos: YouTubeVideoInfo[] = [];

    console.log(`[YOUTUBE] Attempting to fetch live videos for channel ${channelId}...`);

    // Get live videos from the channel's live tab
    let liveVideos: any;
    try {
      liveVideos = await channel.getLiveStreams();
      console.log(`[YOUTUBE] Successfully got live streams tab, found ${liveVideos?.videos?.length || 0} videos`);
    } catch (error) {
      console.log(`[YOUTUBE] getLiveStreams() failed:`, error);
      console.log(`[YOUTUBE] Trying alternative: getVideos() with live filter...`);

      // Alternative approach: Get all videos and filter for live/completed live streams
      try {
        const allVideos = await channel.getVideos();

        // Process all videos and look for live/was live indicators
        const potentialLiveVideos = [];
        for (const video of allVideos.videos) {
          const v = video as any;

          // Check for live badges or indicators
          const isLive = v.badges?.some((badge: any) =>
            badge?.label?.toLowerCase().includes('live') ||
            badge?.label?.toLowerCase().includes('streamed')
          );

          const hasLiveIndicator = v.title?.text?.toLowerCase().includes('live') ||
                                  v.description?.toLowerCase().includes('live stream');

          if (isLive || hasLiveIndicator) {
            potentialLiveVideos.push(v);
          }

          if (potentialLiveVideos.length >= limit) break;
        }

        console.log(`[YOUTUBE] Found ${potentialLiveVideos.length} potential live videos from getVideos()`);
        liveVideos = { videos: potentialLiveVideos };
      } catch (videosError) {
        console.error('[YOUTUBE] Error getting videos with live filter:', videosError);
        return [];
      }
    }

    if (!liveVideos || !liveVideos.videos || liveVideos.videos.length === 0) {
      console.log(`[YOUTUBE] No live videos found for channel ${channelId}`);
      return [];
    }

    // Process live videos
    for (const video of liveVideos.videos) {
      const v = video as any;
      if (!v.id) continue;

      // Filter out upcoming/scheduled live streams
      const isUpcoming = v.upcoming !== undefined && v.upcoming !== null;
      const hasUpcomingBadge = v.badges?.some((badge: any) =>
        badge?.label?.toLowerCase().includes('upcoming') ||
        badge?.label?.toLowerCase().includes('premiere')
      );

      if (isUpcoming || hasUpcomingBadge) {
        console.log(`[YOUTUBE] Skipping upcoming live stream: ${v.title?.text} (${v.id})`);
        continue;
      }

      const videoInfo = {
        videoId: v.id,
        title: v.title?.text || '',
        description: v.description || '',
        thumbnailUrl: v.best_thumbnail?.url || '',
        durationSeconds: v.duration?.seconds || 0,
        publishedAt: v.published?.text || '',
        viewCount: v.view_count?.value || 0,
        likeCount: 0,
        commentCount: 0,
      };

      console.log(`[YOUTUBE] Adding live video: ${videoInfo.title} (${videoInfo.videoId})`);
      videos.push(videoInfo);

      // Stop if we've reached the limit
      if (videos.length >= limit) break;
    }

    console.log(`[YOUTUBE] Successfully fetched ${videos.length} live videos for channel ${channelId}`);
    return videos;
  } catch (error) {
    console.error('[YOUTUBE] Error fetching live videos:', error);
    return [];
  }
}

export async function getVideoDetails(videoId: string): Promise<YouTubeVideoInfo | null> {
  try {
    const youtube = await getYouTubeClient();
    const info = await youtube.getInfo(videoId);

    if (!info) {
      return null;
    }

    return {
      videoId: info.basic_info.id || '',
      title: info.basic_info.title || '',
      description: info.basic_info.short_description || '',
      thumbnailUrl: info.basic_info.thumbnail?.[0]?.url || '',
      durationSeconds: info.basic_info.duration || 0,
      publishedAt: info.basic_info.start_timestamp?.toISOString() || '',
      viewCount: info.basic_info.view_count || 0,
      likeCount: info.basic_info.like_count || 0,
      commentCount: 0, // Not directly available
    };
  } catch (error) {
    console.error('Error fetching video details:', error);
    return null;
  }
}
