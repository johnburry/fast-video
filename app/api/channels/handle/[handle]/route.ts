import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params;
    console.log('Looking up channel by handle:', handle);

    const { data: channel, error } = await supabase
      .from('channels')
      .select('id, channel_name, channel_handle, thumbnail_url')
      .eq('channel_handle', handle)
      .single();

    if (error) {
      console.error('Database error looking up channel:', {
        handle,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint
      });
      return NextResponse.json(
        {
          error: 'Database error',
          message: error.message,
          code: error.code
        },
        { status: 500 }
      );
    }

    if (!channel) {
      console.log('Channel not found for handle:', handle);
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    console.log('Channel found:', { id: channel.id, name: channel.channel_name, handle: channel.channel_handle });

    return NextResponse.json({
      id: channel.id,
      name: channel.channel_name,
      handle: channel.channel_handle,
      thumbnail: channel.thumbnail_url,
    });
  } catch (error) {
    console.error('Error in GET /api/channels/handle/[handle]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
