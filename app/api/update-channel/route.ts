import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { channelHandle, externalLink, externalLinkName } = body;

    if (!channelHandle) {
      return NextResponse.json(
        { error: 'channelHandle is required' },
        { status: 400 }
      );
    }

    // Update the channel's external_link fields
    const { data, error } = await supabase
      .from('channels')
      .update({
        external_link: externalLink || null,
        external_link_name: externalLinkName || null,
      })
      .eq('channel_handle', channelHandle)
      .select()
      .single();

    if (error) {
      console.error('Error updating channel:', error);
      return NextResponse.json(
        { error: 'Failed to update channel', details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      channel: {
        handle: data.channel_handle,
        externalLink: data.external_link,
        externalLinkName: data.external_link_name,
      }
    });
  } catch (error) {
    console.error('Error in PATCH /api/update-channel:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channelHandle = searchParams.get('handle');

    if (!channelHandle) {
      return NextResponse.json(
        { error: 'handle query parameter is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('channels')
      .select('channel_handle, channel_name, external_link, external_link_name')
      .eq('channel_handle', channelHandle)
      .single();

    if (error) {
      console.error('Error fetching channel:', error);
      return NextResponse.json(
        { error: 'Failed to fetch channel', details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      handle: data.channel_handle,
      name: data.channel_name,
      externalLink: data.external_link,
      externalLinkName: data.external_link_name,
    });
  } catch (error) {
    console.error('Error in GET /api/update-channel:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
