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
    console.log('[CHANNEL] Metadata keys:', Object.keys(metadata || {}));
    console.log('[CHANNEL] Avatar:', JSON.stringify(metadata?.avatar));
    console.log('[CHANNEL] Thumbnail:', JSON.stringify(metadata?.thumbnail));

    // Extract name and description
    const name = metadata?.title || header?.author?.name || '';
    const description = metadata?.description || header?.author?.description || '';

    // Try multiple approaches for thumbnail
    const thumbnailUrl = metadata?.avatar?.best_thumbnail?.url ||
                         metadata?.avatar?.[0]?.url ||
                         metadata?.thumbnail?.[0]?.url ||
                         header?.author?.best_thumbnail?.url || '';

    // For banner, we need to check the header.content
    console.log('[CHANNEL] Checking header.content for banner...');
    const headerContent = header?.content as any;

    if (headerContent) {
      console.log('[CHANNEL] Header content type:', headerContent?.type);
      console.log('[CHANNEL] Header content keys:', Object.keys(headerContent || {}));

      // Check if there's a banner in the content
      if (headerContent?.banner) {
        console.log('[CHANNEL] Found banner in content:', JSON.stringify(headerContent.banner).substring(0, 200));
      }
    }

    // Extract banner URL from multiple possible locations
    // Try to get the largest banner available
    const bannerUrl = metadata?.banner?.thumbnails?.[0]?.url ||
                      headerContent?.banner?.image?.thumbnails?.[headerContent?.banner?.image?.thumbnails?.length - 1]?.url ||
                      headerContent?.banner?.thumbnails?.[0]?.url ||
                      header?.banner?.thumbnails?.[0]?.url ||
                      header?.tv_banner?.thumbnails?.[0]?.url ||
                      header?.mobile_banner?.thumbnails?.[0]?.url ||
                      '';

    console.log('[CHANNEL] Extracted data:', {
      name,
      thumbnailUrl: thumbnailUrl?.substring(0, 50),
      bannerUrl: bannerUrl?.substring(0, 50),
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

export async function getChannelVideos(channelId: string): Promise<YouTubeVideoInfo[]> {
  try {
    const youtube = await getYouTubeClient();
    const channel = await youtube.getChannel(channelId);

    const videos: YouTubeVideoInfo[] = [];

    // Get videos from the channel's uploads
    const uploads = await channel.getVideos();

    for (const video of uploads.videos) {
      // Type guard for video object
      const v = video as any;
      if (!v.id) continue;

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
    }

    return videos;
  } catch (error) {
    console.error('Error fetching channel videos:', error);
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
