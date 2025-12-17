import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get the channel to find its YouTube channel ID
    const { data: channel, error: channelError } = await supabaseAdmin
      .from('channels')
      .select('youtube_channel_id')
      .eq('id', id)
      .single();

    if (channelError || !channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('thumbnail') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Read file as buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to R2
    const key = `fast-video-thumbnails/channels/${channel.youtube_channel_id}.jpg`;
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    });

    await s3Client.send(uploadCommand);

    // Construct R2 URL
    const PUBLIC_URL = process.env.R2_PUBLIC_URL || '';
    const baseUrl = PUBLIC_URL.endsWith('/') ? PUBLIC_URL.slice(0, -1) : PUBLIC_URL;
    const r2Url = `${baseUrl}/${key}`;

    // Update channel with new thumbnail URL and banner URL (use same image for both)
    const { error: updateError } = await supabaseAdmin
      .from('channels')
      .update({
        thumbnail_url: r2Url,
        banner_url: r2Url
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating channel thumbnail:', updateError);
      return NextResponse.json(
        { error: 'Failed to update channel' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, thumbnailUrl: r2Url });
  } catch (error) {
    console.error('Error in POST /api/admin/channels/[id]/thumbnail:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
