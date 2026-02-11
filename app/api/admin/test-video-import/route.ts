import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getVideoTranscript } from '@/lib/youtube/transcript';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json(
      { error: 'videoId parameter required' },
      { status: 400 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const logs: string[] = [];
  const log = (message: string) => {
    console.log(message);
    logs.push(message);
  };

  try {
    log(`\n=== Starting Single Video Import Test ===`);
    log(`Video ID: ${videoId}`);
    log(`Timestamp: ${new Date().toISOString()}\n`);

    // Step 1: Check if video exists in database
    log('Step 1: Checking if video exists in database...');
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (videoError) {
      log(`❌ Error fetching video: ${JSON.stringify(videoError)}`);
      return NextResponse.json({ error: 'Video not found', logs }, { status: 404 });
    }

    log(`✓ Video found: ${video.title}`);
    log(`  YouTube ID: ${video.youtube_video_id}`);
    log(`  Channel ID: ${video.channel_id}`);

    // Step 2: Check existing transcripts
    log('\nStep 2: Checking existing transcripts...');

    // Use count query for accurate total
    const { count: existingCount, error: existingCountError } = await supabase
      .from('transcripts')
      .select('*', { count: 'exact', head: true })
      .eq('video_id', videoId);

    if (existingCountError) {
      log(`❌ Error counting existing transcripts: ${JSON.stringify(existingCountError)}`);
    } else {
      log(`Found ${existingCount || 0} existing transcript segments`);

      if (existingCount && existingCount > 0) {
        // Fetch first and last for display
        const { data: firstExisting } = await supabase
          .from('transcripts')
          .select('start_time, text')
          .eq('video_id', videoId)
          .order('start_time', { ascending: true })
          .limit(1);

        const { data: lastExisting } = await supabase
          .from('transcripts')
          .select('start_time, text')
          .eq('video_id', videoId)
          .order('start_time', { ascending: false })
          .limit(1);

        if (firstExisting && firstExisting.length > 0) {
          log(`First: [${firstExisting[0].start_time}s] ${firstExisting[0].text.substring(0, 60)}...`);
        }
        if (lastExisting && lastExisting.length > 0) {
          log(`Last: [${lastExisting[0].start_time}s] ${lastExisting[0].text.substring(0, 60)}...`);
        }
      }
    }

    // Step 3: Fetch transcript from API
    log('\nStep 3: Fetching transcript from TranscriptAPI.com...');
    log(`YouTube ID: ${video.youtube_video_id}`);

    const startTime = Date.now();
    const transcript = await getVideoTranscript(video.youtube_video_id, false, videoId);
    const fetchDuration = Date.now() - startTime;

    if (!transcript || transcript.length === 0) {
      log('❌ Failed to fetch transcript from API');
      return NextResponse.json({ error: 'Failed to fetch transcript', logs }, { status: 500 });
    }

    log(`✓ Successfully fetched transcript in ${fetchDuration}ms`);
    log(`Total segments fetched: ${transcript.length}`);
    log('\nFirst 5 segments:');
    transcript.slice(0, 5).forEach((seg, i) => {
      log(`  ${i + 1}. [${seg.startTime.toFixed(2)}s] ${seg.text.substring(0, 60)}...`);
    });
    log('\nLast 5 segments:');
    transcript.slice(-5).forEach((seg, i) => {
      log(`  ${transcript.length - 5 + i + 1}. [${seg.startTime.toFixed(2)}s] ${seg.text.substring(0, 60)}...`);
    });

    // Step 4: Delete existing transcripts
    log('\nStep 4: Deleting existing transcripts...');
    const { error: deleteError } = await supabase
      .from('transcripts')
      .delete()
      .eq('video_id', videoId);

    if (deleteError) {
      log(`❌ Error deleting existing transcripts: ${JSON.stringify(deleteError)}`);
      return NextResponse.json({ error: 'Failed to delete existing transcripts', logs }, { status: 500 });
    }
    log('✓ Existing transcripts deleted');

    // Step 5: Insert transcripts in batches (same as channelImport.ts)
    log('\nStep 5: Inserting transcripts in batches...');

    const transcriptRecords = transcript.map((segment) => ({
      video_id: videoId,
      text: segment.text,
      start_time: segment.startTime,
      duration: segment.duration,
    }));

    log(`Preparing to insert ${transcriptRecords.length} transcript records`);

    const batchSize = 100;
    let totalInserted = 0;
    let transcriptError = null;

    for (let i = 0; i < transcriptRecords.length; i += batchSize) {
      const batch = transcriptRecords.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(transcriptRecords.length / batchSize);

      log(`  Inserting batch ${batchNum}/${totalBatches} (${batch.length} records, index ${i}-${i + batch.length - 1})...`);

      const batchStartTime = Date.now();
      const { data: insertedData, error } = await supabase
        .from('transcripts')
        .insert(batch)
        .select('id');

      const batchDuration = Date.now() - batchStartTime;

      if (error) {
        log(`  ❌ Error inserting batch ${batchNum}: ${JSON.stringify(error)}`);
        transcriptError = error;
        break;
      }

      totalInserted += insertedData?.length || batch.length;
      log(`  ✓ Batch ${batchNum} inserted successfully in ${batchDuration}ms (${insertedData?.length || batch.length} records)`);
    }

    if (transcriptError) {
      log(`\n❌ Failed to insert all transcripts. Inserted ${totalInserted}/${transcriptRecords.length}`);
      return NextResponse.json({
        error: 'Failed to insert all transcripts',
        inserted: totalInserted,
        total: transcriptRecords.length,
        logs
      }, { status: 500 });
    }

    log(`\n✓ All transcripts inserted successfully: ${totalInserted}/${transcriptRecords.length}`);

    // Step 6: Verify inserted transcripts
    log('\nStep 6: Verifying inserted transcripts...');

    // Use count query to get accurate total (not limited by Supabase's 1000 row default)
    const { count: transcriptCount, error: countError } = await supabase
      .from('transcripts')
      .select('*', { count: 'exact', head: true })
      .eq('video_id', videoId);

    if (countError) {
      log(`❌ Error counting transcripts: ${JSON.stringify(countError)}`);
      return NextResponse.json({ error: 'Failed to count transcripts', logs }, { status: 500 });
    }

    log(`✓ Verified ${transcriptCount || 0} transcripts in database (using COUNT query)`);

    // Fetch a sample of transcripts for display (first 3 and last 3)
    const { data: firstTranscripts, error: firstError } = await supabase
      .from('transcripts')
      .select('id, start_time, text')
      .eq('video_id', videoId)
      .order('start_time', { ascending: true })
      .limit(3);

    const { data: lastTranscripts, error: lastError } = await supabase
      .from('transcripts')
      .select('id, start_time, text')
      .eq('video_id', videoId)
      .order('start_time', { ascending: false })
      .limit(3);

    if (!firstError && firstTranscripts && firstTranscripts.length > 0) {
      log('\nFirst 3 in database:');
      firstTranscripts.forEach((t, i) => {
        log(`  ${i + 1}. [${t.start_time}s] ${t.text.substring(0, 60)}...`);
      });
    }

    if (!lastError && lastTranscripts && lastTranscripts.length > 0) {
      log('\nLast 3 in database:');
      lastTranscripts.reverse().forEach((t, i) => {
        log(`  ${(transcriptCount || 0) - 3 + i + 1}. [${t.start_time}s] ${t.text.substring(0, 60)}...`);
      });
    }

    // Create a mock verifyTranscripts object for compatibility with the rest of the code
    const verifyTranscripts = { length: transcriptCount || 0 };

    // Step 7: Refresh search index
    log('\nStep 7: Refreshing search index...');
    const { data: refreshData, error: refreshError } = await supabase
      .rpc('refresh_transcript_search_for_videos', {
        p_video_ids: [videoId]
      });

    if (refreshError) {
      log(`❌ Error refreshing search index: ${JSON.stringify(refreshError)}`);
    } else {
      log('✓ Search index refreshed');
    }

    // Step 8: Verify search index
    log('\nStep 8: Verifying search index...');
    const { data: searchContext, error: searchError } = await supabase
      .from('transcript_search_context')
      .select('*')
      .eq('video_id', videoId);

    if (searchError) {
      log(`❌ Error checking search index: ${JSON.stringify(searchError)}`);
    } else {
      log(`✓ Found ${searchContext?.length || 0} entries in search index`);
    }

    // Summary
    log('\n=== Import Test Summary ===');
    log(`Fetched from API: ${transcript.length} segments`);
    log(`Inserted to DB: ${totalInserted} segments`);
    log(`Verified in DB: ${verifyTranscripts?.length || 0} segments`);
    log(`Search index entries: ${searchContext?.length || 0}`);

    const apiVsDb = transcript.length - (verifyTranscripts?.length || 0);
    if (apiVsDb !== 0) {
      log(`\n⚠️  MISMATCH: ${Math.abs(apiVsDb)} segments ${apiVsDb > 0 ? 'missing' : 'extra'} in database`);
    } else {
      log('\n✓ API and database segment counts match!');
    }

    log('\n=== Test Complete ===\n');

    return NextResponse.json({
      success: true,
      summary: {
        fetchedFromAPI: transcript.length,
        insertedToDB: totalInserted,
        verifiedInDB: verifyTranscripts?.length || 0,
        searchIndexEntries: searchContext?.length || 0,
        mismatch: apiVsDb !== 0 ? {
          count: Math.abs(apiVsDb),
          type: apiVsDb > 0 ? 'missing' : 'extra'
        } : null
      },
      logs
    });

  } catch (error: any) {
    log(`\n❌ Test failed with error: ${error.message}`);
    console.error('Test error:', error);
    return NextResponse.json({
      error: error.message,
      logs
    }, { status: 500 });
  }
}
