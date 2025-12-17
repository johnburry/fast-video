import { NextRequest, NextResponse } from 'next/server';
import Mux from '@mux/mux-node';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  try {
    const { uploadId } = await params;
    const muxTokenId = process.env.MUX_TOKEN_ID;
    const muxTokenSecret = process.env.MUX_TOKEN_SECRET;

    if (!muxTokenId || !muxTokenSecret) {
      return NextResponse.json(
        { error: 'Mux credentials not configured' },
        { status: 500 }
      );
    }

    const mux = new Mux({
      tokenId: muxTokenId,
      tokenSecret: muxTokenSecret,
    });

    const upload = await mux.video.uploads.retrieve(uploadId);

    if (!upload || !upload.asset_id) {
      return NextResponse.json({
        upload,
        asset: null,
        playbackUrl: null,
      });
    }

    // Get the asset details to retrieve playback ID
    const asset = await mux.video.assets.retrieve(upload.asset_id);

    const playbackId = asset.playback_ids?.[0]?.id;
    const playbackUrl = playbackId
      ? `https://stream.mux.com/${playbackId}.m3u8`
      : null;

    return NextResponse.json({
      upload,
      asset,
      playbackUrl,
    });
  } catch (error) {
    console.error('Error fetching Mux upload:', error);
    return NextResponse.json(
      { error: 'Failed to fetch upload' },
      { status: 500 }
    );
  }
}
