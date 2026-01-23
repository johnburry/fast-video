import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getChannelByHandle, getChannelVideos, getChannelLiveVideos } from '@/lib/youtube/client';
import { getVideoTranscript } from '@/lib/youtube/transcript';
import { uploadThumbnailToR2, uploadChannelThumbnailToR2, uploadChannelBannerToR2 } from '@/lib/r2';
import type { Database } from '@/lib/supabase/database.types';

// Sanitize handle for use as subdomain (replace invalid characters with hyphens)
function sanitizeHandleForSubdomain(handle: string): string {
  // Subdomains can only contain: a-z, 0-9, and hyphens (-)
  // Cannot start or end with hyphen, cannot have consecutive hyphens
  return handle
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-') // Replace invalid chars with hyphen
    .replace(/^-+|-+$/g, '')      // Remove leading/trailing hyphens
    .replace(/-{2,}/g, '-');       // Replace consecutive hyphens with single hyphen
}

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
  const { channelHandle, limit, includeLiveVideos, skipTranscripts, tenantId } = await request.json();

  if (!channelHandle) {
    return NextResponse.json(
      { error: 'Channel handle is required' },
      { status: 400 }
    );
  }

  // Use provided limit or default to 50, with max of 5000
  const videoLimit = Math.min(Math.max(1, limit || 50), 5000);
  const shouldIncludeLiveVideos = includeLiveVideos === true;
  const shouldSkipTranscripts = skipTranscripts === true;

  // Get tenant_id from request or derive from hostname
  let assignedTenantId = tenantId;
  if (!assignedTenantId) {
    const hostname = request.headers.get('host') || '';
    const cleanDomain = hostname.split(':')[0];

    // Try to find tenant by domain
    const { data: tenantData } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('domain', cleanDomain)
      .single();

    if (tenantData) {
      assignedTenantId = tenantData.id;
    }
  }

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

      // Fetch the existing channel to check if channel_name is empty
      const { data: existingChannel } = await supabaseAdmin
        .from('channels')
        .select('channel_name')
        .eq('id', channelId)
        .single();

      // Update existing channel
      const updateData: any = {
        channel_description: channelInfo.description,
        thumbnail_url: r2ChannelThumbnailUrl,
        banner_url: r2ChannelBannerUrl,
        subscriber_count: channelInfo.subscriberCount,
        last_synced_at: new Date().toISOString(),
      };

      // Only update channel_name if it's currently empty or null
      if (!existingChannel?.channel_name) {
        updateData.channel_name = channelInfo.name;
      }

      // DO NOT update tenant_id - keep the existing tenant assignment

      await supabaseAdmin.from('channels').update(updateData).eq('id', channelId);
    } else {
      // Create new channel
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

      // Add tenant_id if provided
      if (assignedTenantId) {
        insertData.tenant_id = assignedTenantId;
      }

      const { data: newChannel, error: channelError} = await supabaseAdmin
        .from('channels')
        .insert(insertData)
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
        const allVideos = await getChannelVideos(channelInfo.channelId, videoLimit);

        // Conditionally fetch live videos if option is enabled
        let liveVideos: any[] = [];
        let combinedVideos = allVideos;

        if (shouldIncludeLiveVideos) {
          sendProgress({ type: 'status', message: 'Fetching ALL live videos from YouTube...' });
          console.log(`Fetching all live videos for @${channelInfo.handle}...`);
          // Fetch all live videos (no limit - pass a very high number)
          liveVideos = await getChannelLiveVideos(channelInfo.channelId, 10000);

          // Combine live videos first, then regular videos, removing duplicates
          const liveVideoIds = new Set(liveVideos.map(v => v.videoId));
          combinedVideos = [
            ...liveVideos,
            ...allVideos.filter(v => !liveVideoIds.has(v.videoId))
          ];

          console.log(`[IMPORT] Found ${allVideos.length} regular videos and ${liveVideos.length} live videos (${combinedVideos.length} total after deduplication)`);
        } else {
          console.log(`[IMPORT] Found ${allVideos.length} videos`);
        }

        // Fetch ALL existing video IDs for this channel to avoid re-importing
        // Supabase has a hard limit of 1000 rows per query, so we need to paginate
        sendProgress({ type: 'status', message: 'Checking for existing videos...' });

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

          if (fetchError) {
            console.error(`[IMPORT] Error fetching existing videos (page ${page}):`, fetchError);
            break;
          }

          if (pageVideos && pageVideos.length > 0) {
            allExistingVideos = allExistingVideos.concat(pageVideos);
            console.log(`[IMPORT] Fetched page ${page + 1}: ${pageVideos.length} videos (total so far: ${allExistingVideos.length})`);
            hasMore = pageVideos.length === pageSize;
            page++;
          } else {
            hasMore = false;
          }
        }

        const existingVideoMap = new Map(
          allExistingVideos.map(v => [v.youtube_video_id, v.has_transcript])
        );

        console.log(`Found ${existingVideoMap.size} existing videos in database (fetched ${allExistingVideos.length} total rows across ${page} pages)`);
        console.log(`First 3 existing videos:`, Array.from(existingVideoMap.entries()).slice(0, 3));

        // Check if the "new" videos are actually in the existingVideoMap
        const firstNewVideo = combinedVideos.find(v => !existingVideoMap.has(v.videoId));
        console.log(`First truly new video:`, firstNewVideo ? { id: firstNewVideo.videoId, title: firstNewVideo.title } : 'NONE - all videos exist!');

        // Filter videos based on import mode
        const newVideos = combinedVideos.filter(v => !existingVideoMap.has(v.videoId));
        const existingVideosWithoutTranscripts = combinedVideos.filter(v => {
          const hasTranscript = existingVideoMap.get(v.videoId);
          return existingVideoMap.has(v.videoId) && hasTranscript === false;
        });

        // Sort new videos by publish date (newest to oldest)
        newVideos.sort((a, b) => {
          const dateA = parseRelativeTime(a.publishedAt);
          const dateB = parseRelativeTime(b.publishedAt);

          // If dates are invalid, keep original order
          if (!dateA || !dateB) return 0;

          // Newest first (descending order)
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        });

        console.log(`[IMPORT] Video breakdown:`);
        console.log(`  - Total from YouTube: ${combinedVideos.length}`);
        console.log(`  - Already in DB: ${existingVideoMap.size}`);
        console.log(`  - New videos to import: ${newVideos.length}`);
        console.log(`  - Existing videos without transcripts: ${existingVideosWithoutTranscripts.length}`);
        console.log(`  - Skip transcripts mode: ${shouldSkipTranscripts}`);

        // Send early progress update so user can see what's happening
        const needsTranscriptDownload = !shouldSkipTranscripts && existingVideosWithoutTranscripts.length > 0;
        sendProgress({
          type: 'status',
          message: `Analysis: ${combinedVideos.length} videos on YouTube, ${existingVideoMap.size} already imported, ${newVideos.length} new to import${needsTranscriptDownload ? `, ${existingVideosWithoutTranscripts.length} need transcripts` : ''}${shouldSkipTranscripts ? ' (skip transcripts mode)' : ''}`
        });

        // Determine which videos to process
        let videosToImport: any[]; // New videos to create
        let videosForTranscripts: any[] = []; // Existing videos needing transcripts

        if (shouldIncludeLiveVideos && liveVideos.length > 0) {
          const liveVideoIdsSet = new Set(liveVideos.map(v => v.videoId));
          const liveVideosToImport = newVideos.filter(v => liveVideoIdsSet.has(v.videoId));
          const regularVideosToImport = newVideos.filter(v => !liveVideoIdsSet.has(v.videoId));

          // Combine with live videos first, up to the limit
          videosToImport = [...liveVideosToImport, ...regularVideosToImport].slice(0, videoLimit);

          console.log(`Live videos to import: ${liveVideosToImport.length}, Regular videos to import: ${regularVideosToImport.length}`);
        } else {
          videosToImport = newVideos.slice(0, videoLimit);
        }

        // If not skipping transcripts, also process existing videos without transcripts
        if (!shouldSkipTranscripts) {
          videosForTranscripts = existingVideosWithoutTranscripts.slice(0, videoLimit - videosToImport.length);
        }

        const totalToProcess = videosToImport.length + videosForTranscripts.length;
        console.log(`Processing ${videosToImport.length} new videos and ${videosForTranscripts.length} existing videos for transcripts (total: ${totalToProcess})`);

        sendProgress({
          type: 'status',
          message: `Importing ${videosToImport.length} new videos${videosForTranscripts.length > 0 ? ` and fetching ${videosForTranscripts.length} transcripts` : ''}...`
        });

    // Update channel video count with actual total
    await supabaseAdmin
      .from('channels')
      .update({ video_count: combinedVideos.length })
      .eq('id', channelId);

    let processedCount = 0;
    let transcriptCount = 0;
    let skippedCount = 0;
    const processedVideoIds: string[] = [];  // Track video IDs for embeddings later

        console.log(`[IMPORT] About to process ${totalToProcess} total (${videosToImport.length} new + ${videosForTranscripts.length} transcript-only)`);
        sendProgress({
          type: 'status',
          message: `Starting to process ${totalToProcess} videos...`
        });

        // Process new videos (create records + transcripts)
        for (const video of videosToImport) {
          try {
            const videoStartTime = Date.now();
            console.log(`[TIMING] Starting video ${processedCount + 1}/${totalToProcess}: ${video.videoId}`);

            const isLiveVideo = shouldIncludeLiveVideos && liveVideos.some(lv => lv.videoId === video.videoId);
            sendProgress({
              type: 'progress',
              current: processedCount + 1,
              total: totalToProcess,
              videoTitle: `${video.title}${isLiveVideo ? ' [LIVE]' : ''}`,
            });

            // Upload thumbnail to R2
            const r2Start = Date.now();
            const r2ThumbnailUrl = await uploadThumbnailToR2(
              video.videoId,
              video.thumbnailUrl
            );
            console.log(`[TIMING] R2 upload took ${Date.now() - r2Start}ms`);

        // Create new video (all videos in videosToProcess are new)
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

        // Track this video ID for embeddings later
        processedVideoIds.push(videoId);

        // Skip transcript fetching if requested (for faster imports)
        if (shouldSkipTranscripts) {
          console.log(`[IMPORT] Skipping transcript for ${video.videoId} - skipTranscripts enabled`);
          processedCount++;
          continue;
        }

        // Fetch and save transcript (synchronous - waits for completion)
        console.log(`[IMPORT] Fetching transcript for ${video.videoId} (${video.title})...${isLiveVideo ? ' [LIVE VIDEO]' : ''}`);
        sendProgress({
          type: 'status',
          message: `Fetching transcript for: ${video.title}${isLiveVideo ? ' [LIVE]' : ''} (this may take a minute)...`
        });

        // Always use auto mode (synchronous) - waits for transcript to be ready
        const transcriptStart = Date.now();
        let transcript = await getVideoTranscript(video.videoId, false);
        console.log(`[TIMING] Transcript fetch took ${Date.now() - transcriptStart}ms`);

        // Don't retry - if it failed once, it will fail again (and Supadata is slow for unavailable transcripts)
        if (!transcript || transcript.length === 0) {
          console.log(`[IMPORT] No transcript available for ${video.videoId}${isLiveVideo ? ' [LIVE VIDEO]' : ''} - skipping (no retry)`);
          sendProgress({
            type: 'status',
            message: `⚠️ No transcript available for: ${video.title}${isLiveVideo ? ' [LIVE VIDEO]' : ''}`
          });
        }

        if (transcript && transcript.length > 0) {
          console.log(`[IMPORT] Saving ${transcript.length} transcript segments for ${video.videoId}...`);
          // Save transcript segments
          const transcriptRecords = transcript.map((segment) => ({
            video_id: videoId,
            text: segment.text,
            start_time: segment.startTime,
            duration: segment.duration,
          }));

          const dbStart = Date.now();
          const { error: transcriptError } = await supabaseAdmin
            .from('transcripts')
            .insert(transcriptRecords);
          console.log(`[TIMING] Database insert of ${transcript.length} segments took ${Date.now() - dbStart}ms`);

          if (transcriptError) {
            console.error(`[IMPORT] Error saving transcript for video ${video.videoId}:`, transcriptError);
          } else {
            console.log(`[IMPORT] Successfully saved transcript for video ${video.videoId}`);
            // Update video to mark transcript as available
            console.log(`[IMPORT] Updating has_transcript flag for database video ID: ${videoId}, YouTube ID: ${video.videoId}`);
            const { data: updateData, error: updateError, count } = await supabaseAdmin
              .from('videos')
              .update({
                has_transcript: true,
              })
              .eq('id', videoId)
              .select();

            if (updateError) {
              console.error(`[IMPORT] ERROR updating has_transcript flag for video ${video.videoId} (DB ID: ${videoId}):`, updateError);
            } else if (!updateData || updateData.length === 0) {
              console.error(`[IMPORT] WARNING: Update returned no rows for video ${video.videoId} (DB ID: ${videoId}). This means the video was not found or RLS policy blocked the update.`);
            } else {
              console.log(`[IMPORT] ✓ Successfully updated has_transcript=true for video ${video.videoId} (DB ID: ${videoId})`);
              console.log(`[IMPORT] Updated row:`, updateData[0]);
            }

            transcriptCount++;
          }
        } else {
          console.log(`[IMPORT] No transcript found for ${video.videoId} - transcript was null or empty`);
        }

            processedCount++;
            console.log(`[TIMING] Total time for video ${video.videoId}: ${Date.now() - videoStartTime}ms`);
            console.log(`Processed ${processedCount}/${totalToProcess} videos`);
          } catch (error) {
            console.error(`Error processing video ${video.videoId}:`, error);
          }
        }

        // Process existing videos that need transcripts (transcript-only mode)
        for (const video of videosForTranscripts) {
          try {
            const videoStartTime = Date.now();
            console.log(`[TIMING] Starting transcript-only for video ${processedCount + 1}/${totalToProcess}: ${video.videoId}`);

            // Get the database video ID
            const { data: existingVideo } = await supabaseAdmin
              .from('videos')
              .select('id')
              .eq('youtube_video_id', video.videoId)
              .eq('channel_id', channelId)
              .single();

            if (!existingVideo) {
              console.error(`[IMPORT] Video ${video.videoId} not found in database`);
              continue;
            }

            const videoId = existingVideo.id;

            sendProgress({
              type: 'progress',
              current: processedCount + 1,
              total: totalToProcess,
              videoTitle: `${video.title} [TRANSCRIPT ONLY]`,
            });

            // Fetch and save transcript
            console.log(`[IMPORT] Fetching transcript for existing video ${video.videoId} (${video.title})...`);
            sendProgress({
              type: 'status',
              message: `Fetching transcript for: ${video.title} (this may take a minute)...`
            });

            const transcriptStart = Date.now();
            let transcript = await getVideoTranscript(video.videoId, false);
            console.log(`[TIMING] Transcript fetch took ${Date.now() - transcriptStart}ms`);

            if (!transcript || transcript.length === 0) {
              console.log(`[IMPORT] No transcript available for ${video.videoId} - skipping`);
              sendProgress({
                type: 'status',
                message: `⚠️ No transcript available for: ${video.title}`
              });
            } else {
              console.log(`[IMPORT] Saving ${transcript.length} transcript segments for ${video.videoId}...`);
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
                await supabaseAdmin
                  .from('videos')
                  .update({ has_transcript: true })
                  .eq('id', videoId);

                transcriptCount++;
                processedVideoIds.push(videoId); // Track for embeddings
              }
            }

            processedCount++;
            console.log(`[TIMING] Total time for transcript ${video.videoId}: ${Date.now() - videoStartTime}ms`);
            console.log(`Processed ${processedCount}/${totalToProcess} videos`);
          } catch (error) {
            console.error(`Error processing transcript for video ${video.videoId}:`, error);
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

        // Generate embeddings only for newly processed videos (not all videos in the channel)
        const videosForEmbeddings = processedVideoIds.length > 0
          ? processedVideoIds.map(id => ({ id }))
          : [];

        // Generate embeddings for all videos with transcripts (if OpenAI API key is available)
        if (process.env.OPENAI_API_KEY && videosForEmbeddings.length > 0) {
          const embeddingsStartTime = Date.now();
          sendProgress({ type: 'status', message: 'Generating AI embeddings for semantic search...' });
          console.log(`[EMBEDDINGS] Starting embedding generation for ${videosForEmbeddings.length} newly imported videos (out of ${channelVideos?.length || 0} total)`);
          console.log(`[TIMING] This will process ${videosForEmbeddings.length} videos sequentially`);

          let embeddingsGenerated = 0;
          for (const channelVideo of videosForEmbeddings) {
            try {
              const embeddingVideoStart = Date.now();
              console.log(`[TIMING] Starting embeddings for video ${channelVideo.id}...`);

              // Generate embeddings for this video
              const response = await fetch(new URL('/api/embeddings/generate', request.url), {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  videoId: channelVideo.id,
                  batchSize: 100,
                }),
              });

              console.log(`[TIMING] Embedding API call for video ${channelVideo.id} took ${Date.now() - embeddingVideoStart}ms`);

              if (response.ok) {
                const result = await response.json();
                if (result.processed > 0) {
                  embeddingsGenerated += result.processed;
                  console.log(`[EMBEDDINGS] Generated ${result.processed} embeddings for video ${channelVideo.id}`);
                  sendProgress({
                    type: 'status',
                    message: `Generated embeddings for ${embeddingsGenerated} transcript segments...`
                  });
                }
              }
            } catch (error) {
              console.error(`[EMBEDDINGS] Error generating embeddings for video ${channelVideo.id}:`, error);
              // Continue with other videos even if one fails
            }
          }

          console.log(`[EMBEDDINGS] Completed embedding generation: ${embeddingsGenerated} total embeddings`);
          console.log(`[TIMING] Total embeddings generation time: ${Date.now() - embeddingsStartTime}ms (${((Date.now() - embeddingsStartTime) / 1000 / 60).toFixed(2)} minutes)`);
          sendProgress({
            type: 'status',
            message: `✓ Generated ${embeddingsGenerated} AI embeddings for semantic search`
          });
        } else if (!process.env.OPENAI_API_KEY) {
          console.log('[EMBEDDINGS] Skipping embedding generation - OPENAI_API_KEY not configured');
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
