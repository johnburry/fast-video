import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isQualityTranscript } from '@/lib/transcriptQuality';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await request.json();
    const { videoId, channelId } = body;

    if (!videoId && !channelId) {
      return NextResponse.json(
        { error: 'videoId or channelId parameter required' },
        { status: 400 }
      );
    }

    const logs: string[] = [];
    const log = (message: string) => {
      console.log(message);
      logs.push(message);
    };

    log('\n=== Re-checking Transcript Quality ===\n');

    // Get videos to process
    let videosQuery = supabase
      .from('videos')
      .select('id, title, youtube_video_id, has_transcript')
      .eq('has_transcript', true);

    if (videoId) {
      videosQuery = videosQuery.eq('id', videoId);
    } else if (channelId) {
      videosQuery = videosQuery.eq('channel_id', channelId);
    }

    const { data: videos, error: videosError } = await videosQuery;

    if (videosError) {
      log(`❌ Error fetching videos: ${JSON.stringify(videosError)}`);
      return NextResponse.json({ error: 'Failed to fetch videos', logs }, { status: 500 });
    }

    if (!videos || videos.length === 0) {
      log('No videos found with transcripts');
      return NextResponse.json({ success: true, processed: 0, logs });
    }

    log(`Found ${videos.length} videos to process\n`);

    let updated = 0;
    let unchanged = 0;
    let errors = 0;

    for (const video of videos) {
      try {
        log(`Processing: ${video.title}`);

        // Fetch transcripts for this video
        const { data: transcripts, error: transcriptsError } = await supabase
          .from('transcripts')
          .select('text, start_time, duration')
          .eq('video_id', video.id)
          .order('start_time', { ascending: true });

        if (transcriptsError || !transcripts || transcripts.length === 0) {
          log(`  ⚠️  No transcripts found`);
          errors++;
          continue;
        }

        // Check quality
        const hasQualityTranscript = isQualityTranscript(transcripts);

        // Update video
        const { error: updateError } = await supabase
          .from('videos')
          .update({ has_quality_transcript: hasQualityTranscript })
          .eq('id', video.id);

        if (updateError) {
          log(`  ❌ Error updating: ${updateError.message}`);
          errors++;
        } else {
          log(`  ✓ Updated: has_quality_transcript = ${hasQualityTranscript}`);
          updated++;
        }
      } catch (error: any) {
        log(`  ❌ Error: ${error.message}`);
        errors++;
      }
    }

    log('\n=== Summary ===');
    log(`Total videos: ${videos.length}`);
    log(`Updated: ${updated}`);
    log(`Unchanged: ${unchanged}`);
    log(`Errors: ${errors}`);

    return NextResponse.json({
      success: true,
      summary: {
        total: videos.length,
        updated,
        unchanged,
        errors
      },
      logs
    });

  } catch (error: any) {
    console.error('Re-check quality error:', error);
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}
