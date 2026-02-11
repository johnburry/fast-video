/**
 * Test script to import a single video and trace the full process
 * Usage: npx tsx test-single-video-import.ts <videoId>
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getVideoTranscript } from './lib/youtube/transcript';

// Load environment variables from .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testVideoImport(videoId: string) {
  console.log('\n=== Starting Single Video Import Test ===');
  console.log(`Video ID: ${videoId}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  // Step 1: Check if video exists in database
  console.log('Step 1: Checking if video exists in database...');
  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('*')
    .eq('id', videoId)
    .single();

  if (videoError) {
    console.error('❌ Error fetching video:', videoError);
    process.exit(1);
  }

  if (!video) {
    console.error('❌ Video not found in database');
    process.exit(1);
  }

  console.log('✓ Video found:', {
    id: video.id,
    title: video.title,
    youtubeId: video.youtube_id,
    channelId: video.channel_id,
  });

  // Step 2: Check existing transcripts
  console.log('\nStep 2: Checking existing transcripts...');
  const { data: existingTranscripts, error: existingError } = await supabase
    .from('transcripts')
    .select('*')
    .eq('video_id', videoId)
    .order('start_time', { ascending: true });

  if (existingError) {
    console.error('❌ Error fetching existing transcripts:', existingError);
  } else {
    console.log(`Found ${existingTranscripts?.length || 0} existing transcript segments`);
    if (existingTranscripts && existingTranscripts.length > 0) {
      console.log('First segment:', existingTranscripts[0]);
      console.log('Last segment:', existingTranscripts[existingTranscripts.length - 1]);
    }
  }

  // Step 3: Fetch transcript from API
  console.log('\nStep 3: Fetching transcript from TranscriptAPI.com...');
  console.log(`YouTube ID: ${video.youtube_id}`);

  const startTime = Date.now();
  const transcript = await getVideoTranscript(video.youtube_id, false, videoId);
  const fetchDuration = Date.now() - startTime;

  if (!transcript || transcript.length === 0) {
    console.error('❌ Failed to fetch transcript from API');
    process.exit(1);
  }

  console.log(`✓ Successfully fetched transcript in ${fetchDuration}ms`);
  console.log(`Total segments fetched: ${transcript.length}`);
  console.log('\nFirst 5 segments:');
  transcript.slice(0, 5).forEach((seg, i) => {
    console.log(`  ${i + 1}. [${seg.startTime.toFixed(2)}s] ${seg.text.substring(0, 60)}...`);
  });
  console.log('\nLast 5 segments:');
  transcript.slice(-5).forEach((seg, i) => {
    console.log(`  ${transcript.length - 5 + i + 1}. [${seg.startTime.toFixed(2)}s] ${seg.text.substring(0, 60)}...`);
  });

  // Step 4: Delete existing transcripts
  console.log('\nStep 4: Deleting existing transcripts...');
  const { error: deleteError } = await supabase
    .from('transcripts')
    .delete()
    .eq('video_id', videoId);

  if (deleteError) {
    console.error('❌ Error deleting existing transcripts:', deleteError);
    process.exit(1);
  }
  console.log('✓ Existing transcripts deleted');

  // Step 5: Insert transcripts in batches (same as channelImport.ts)
  console.log('\nStep 5: Inserting transcripts in batches...');

  const transcriptRecords = transcript.map((segment) => ({
    video_id: videoId,
    text: segment.text,
    start_time: segment.startTime,
    duration: segment.duration,
  }));

  console.log(`Preparing to insert ${transcriptRecords.length} transcript records`);

  const batchSize = 100;
  let totalInserted = 0;
  let transcriptError = null;

  for (let i = 0; i < transcriptRecords.length; i += batchSize) {
    const batch = transcriptRecords.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(transcriptRecords.length / batchSize);

    console.log(`  Inserting batch ${batchNum}/${totalBatches} (${batch.length} records, index ${i}-${i + batch.length - 1})...`);

    const batchStartTime = Date.now();
    const { data: insertedData, error } = await supabase
      .from('transcripts')
      .insert(batch)
      .select('id');

    const batchDuration = Date.now() - batchStartTime;

    if (error) {
      console.error(`  ❌ Error inserting batch ${batchNum}:`, error);
      console.error(`  Error details:`, JSON.stringify(error, null, 2));
      transcriptError = error;
      break;
    }

    totalInserted += insertedData?.length || batch.length;
    console.log(`  ✓ Batch ${batchNum} inserted successfully in ${batchDuration}ms (${insertedData?.length || batch.length} records)`);
  }

  if (transcriptError) {
    console.error(`\n❌ Failed to insert all transcripts. Inserted ${totalInserted}/${transcriptRecords.length}`);
    process.exit(1);
  }

  console.log(`\n✓ All transcripts inserted successfully: ${totalInserted}/${transcriptRecords.length}`);

  // Step 6: Verify inserted transcripts
  console.log('\nStep 6: Verifying inserted transcripts...');
  const { data: verifyTranscripts, error: verifyError } = await supabase
    .from('transcripts')
    .select('id, start_time, text')
    .eq('video_id', videoId)
    .order('start_time', { ascending: true });

  if (verifyError) {
    console.error('❌ Error verifying transcripts:', verifyError);
    process.exit(1);
  }

  console.log(`✓ Verified ${verifyTranscripts?.length || 0} transcripts in database`);

  if (verifyTranscripts && verifyTranscripts.length > 0) {
    console.log('\nFirst 3 in database:');
    verifyTranscripts.slice(0, 3).forEach((t, i) => {
      console.log(`  ${i + 1}. [${t.start_time}s] ${t.text.substring(0, 60)}...`);
    });
    console.log('\nLast 3 in database:');
    verifyTranscripts.slice(-3).forEach((t, i) => {
      console.log(`  ${verifyTranscripts.length - 3 + i + 1}. [${t.start_time}s] ${t.text.substring(0, 60)}...`);
    });
  }

  // Step 7: Refresh search index
  console.log('\nStep 7: Refreshing search index...');
  const { data: refreshData, error: refreshError } = await supabase
    .rpc('refresh_transcript_search_for_videos', {
      p_video_ids: [videoId]
    });

  if (refreshError) {
    console.error('❌ Error refreshing search index:', refreshError);
  } else {
    console.log('✓ Search index refreshed');
  }

  // Step 8: Verify search index
  console.log('\nStep 8: Verifying search index...');
  const { data: searchContext, error: searchError } = await supabase
    .from('transcript_search_context')
    .select('*')
    .eq('video_id', videoId);

  if (searchError) {
    console.error('❌ Error checking search index:', searchError);
  } else {
    console.log(`✓ Found ${searchContext?.length || 0} entries in search index`);
  }

  // Summary
  console.log('\n=== Import Test Summary ===');
  console.log(`Fetched from API: ${transcript.length} segments`);
  console.log(`Inserted to DB: ${totalInserted} segments`);
  console.log(`Verified in DB: ${verifyTranscripts?.length || 0} segments`);
  console.log(`Search index entries: ${searchContext?.length || 0}`);

  const apiVsDb = transcript.length - (verifyTranscripts?.length || 0);
  if (apiVsDb !== 0) {
    console.log(`\n⚠️  MISMATCH: ${Math.abs(apiVsDb)} segments ${apiVsDb > 0 ? 'missing' : 'extra'} in database`);
  } else {
    console.log('\n✓ API and database segment counts match!');
  }

  console.log('\n=== Test Complete ===\n');
}

// Get video ID from command line
const videoId = process.argv[2];
if (!videoId) {
  console.error('Usage: npx tsx test-single-video-import.ts <videoId>');
  process.exit(1);
}

testVideoImport(videoId).catch(error => {
  console.error('\n❌ Test failed with error:', error);
  process.exit(1);
});
