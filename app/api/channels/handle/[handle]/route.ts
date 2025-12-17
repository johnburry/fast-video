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

    const { data: channel, error } = await supabase
      .from('channels')
      .select('id, name, handle')
      .eq('channel_handle', handle)
      .single();

    if (error || !channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: channel.id,
      name: channel.name,
      handle: channel.handle,
    });
  } catch (error) {
    console.error('Error in GET /api/channels/handle/[handle]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
