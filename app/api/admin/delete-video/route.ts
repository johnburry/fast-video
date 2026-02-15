import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function DELETE(request: NextRequest) {
  try {
    const { youtubeVideoId } = await request.json();

    if (!youtubeVideoId) {
      return NextResponse.json(
        { error: 'YouTube video ID is required' },
        { status: 400 }
      );
    }

    // Find the video in the database
    const { data: video, error: findError } = await supabaseAdmin
      .from('videos')
      .select('id, title, channel_id')
      .eq('youtube_video_id', youtubeVideoId)
      .single();

    if (findError || !video) {
      return NextResponse.json(
        { error: `Video not found with YouTube ID: ${youtubeVideoId}` },
        { status: 404 }
      );
    }

    const videoId = video.id;
    const deletedItems: string[] = [];

    // Delete from transcript_search_context (search index)
    const { count: searchCount } = await supabaseAdmin
      .from('transcript_search_context')
      .delete({ count: 'exact' })
      .eq('video_id', videoId);
    if (searchCount) deletedItems.push(`${searchCount} search index rows`);

    // Delete transcripts
    const { count: transcriptCount } = await supabaseAdmin
      .from('transcripts')
      .delete({ count: 'exact' })
      .eq('video_id', videoId);
    if (transcriptCount) deletedItems.push(`${transcriptCount} transcript segments`);

    // Delete embeddings if table exists
    try {
      const { count: embeddingCount } = await supabaseAdmin
        .from('transcript_embeddings')
        .delete({ count: 'exact' })
        .eq('video_id', videoId);
      if (embeddingCount) deletedItems.push(`${embeddingCount} embeddings`);
    } catch {
      // embeddings table may not exist
    }

    // Delete import logs if table exists
    try {
      const { count: logCount } = await supabaseAdmin
        .from('channel_import_logs')
        .delete({ count: 'exact' })
        .eq('video_id', videoId);
      if (logCount) deletedItems.push(`${logCount} import log entries`);
    } catch {
      // import logs table may not exist
    }

    // Delete the video itself
    const { error: deleteError } = await supabaseAdmin
      .from('videos')
      .delete()
      .eq('id', videoId);

    if (deleteError) {
      return NextResponse.json(
        { error: `Failed to delete video: ${deleteError.message}` },
        { status: 500 }
      );
    }

    deletedItems.push('video record');

    return NextResponse.json({
      success: true,
      videoTitle: video.title,
      youtubeVideoId,
      deleted: deletedItems,
    });
  } catch (error) {
    console.error('Error deleting video:', error);
    return NextResponse.json(
      { error: 'Failed to delete video' },
      { status: 500 }
    );
  }
}
