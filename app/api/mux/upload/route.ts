import { NextRequest, NextResponse } from 'next/server';
import Mux from '@mux/mux-node';

export async function POST(request: NextRequest) {
  try {
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

    // Create a direct upload
    const upload = await mux.video.uploads.create({
      cors_origin: '*', // In production, set this to your domain
      new_asset_settings: {
        playback_policy: ['public'],
        encoding_tier: 'baseline',
      },
    });

    return NextResponse.json({
      id: upload.id,
      url: upload.url,
    });
  } catch (error) {
    console.error('Error creating Mux upload:', error);
    return NextResponse.json(
      { error: 'Failed to create upload' },
      { status: 500 }
    );
  }
}
