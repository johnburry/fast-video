import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getVideoTranscript } from '@/lib/youtube/transcript';
import { uploadThumbnailToR2 } from '@/lib/r2';

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
    const { channelId, video, fetchTranscript } = await request.json();

    if (!channelId || !video) {
      return NextResponse.json(
        { error: 'Channel ID and video data are required' },
        { status: 400 }
      );
    }

    // Upload thumbnail to R2
    const r2ThumbnailUrl = await uploadThumbnailToR2(
      video.videoId,
      video.thumbnailUrl
    );

    // Create new video
    const publishedAt = parseRelativeTime(video.publishedAt);
    const { data: newVideo, error: videoError } = await supabaseAdmin
      .from('videos')
      .insert({
        channel_id: channelId,
        youtube_video_id: video.videoId,
        title: video.title,
        description: video.description || '',
        thumbnail_url: r2ThumbnailUrl,
        duration_seconds: video.durationSeconds || 0,
        published_at: publishedAt,
        view_count: video.viewCount || 0,
        like_count: video.likeCount || 0,
        comment_count: video.commentCount || 0,
        has_transcript: false,
      })
      .select('id')
      .single();

    if (videoError || !newVideo) {
      console.error(`Error creating video ${video.videoId}:`, videoError);
      return NextResponse.json(
        { error: 'Failed to create video' },
        { status: 500 }
      );
    }

    const videoId = newVideo.id;

    // Fetch transcript if requested
    if (fetchTranscript) {
      const transcript = await getVideoTranscript(video.videoId, false);

      if (transcript && transcript.length > 0) {
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
          console.error(`Error saving transcript for video ${video.videoId}:`, transcriptError);
          return NextResponse.json({
            success: true,
            videoId,
            transcriptFetched: false,
            message: 'Video imported but transcript fetch failed',
          });
        }

        // Update video to mark transcript as available
        await supabaseAdmin
          .from('videos')
          .update({ has_transcript: true })
          .eq('id', videoId);

        // Generate embeddings
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
              console.error('Failed to generate embeddings');
            }
          } catch (error) {
            console.error('Error generating embeddings:', error);
          }
        }

        return NextResponse.json({
          success: true,
          videoId,
          transcriptFetched: true,
          message: 'Video imported and transcript fetched successfully',
        });
      } else {
        return NextResponse.json({
          success: true,
          videoId,
          transcriptFetched: false,
          message: 'Video imported but no transcript available',
        });
      }
    }

    return NextResponse.json({
      success: true,
      videoId,
      transcriptFetched: false,
      message: 'Video imported successfully',
    });
  } catch (error) {
    console.error('Error importing video:', error);
    return NextResponse.json(
      { error: 'Failed to import video' },
      { status: 500 }
    );
  }
}
