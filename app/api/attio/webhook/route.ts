import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Bearer token for webhook authentication
const EXPECTED_BEARER_TOKEN = 'sdj48slks84jh9zk3kgj';

export async function POST(request: NextRequest) {
  try {
    // Verify authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${EXPECTED_BEARER_TOKEN}`) {
      console.error('Unauthorized: Invalid or missing authorization header');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse the request body
    const body = await request.json();
    console.log('Received Attio webhook:', JSON.stringify(body, null, 2));

    // Extract attio_list_entry_id from the body
    const attioListEntryId = body.attio_list_entry_id;
    if (!attioListEntryId) {
      console.error('Missing attio_list_entry_id in request body');
      return NextResponse.json(
        { error: 'Missing attio_list_entry_id field' },
        { status: 400 }
      );
    }

    // Check if channel already exists by attio_list_entry_id
    const { data: existingChannel } = await supabase
      .from('channels')
      .select('id')
      .eq('attio_list_entry_id', attioListEntryId)
      .single();

    // Prepare channel data for upsert
    // Use attio_list_entry_id for channel_handle if not provided to ensure uniqueness
    const channelData: any = {
      attio_list_entry_id: attioListEntryId,
      youtube_channel_id: body.youtube_channel_id || '',
      channel_handle: body.channel_handle || attioListEntryId,
      channel_name: body.channel_name || '',
    };

    // Add optional fields if they exist
    if (body.channel_description) channelData.channel_description = body.channel_description;
    if (body.short_name) channelData.short_name = body.short_name;
    if (body.thumbnail_url) channelData.thumbnail_url = body.thumbnail_url;
    if (body.banner_url) channelData.banner_url = body.banner_url;
    if (body.subscriber_count !== undefined) channelData.subscriber_count = body.subscriber_count;
    if (body.video_count !== undefined) channelData.video_count = body.video_count;
    if (body.external_link) channelData.external_link = body.external_link;
    if (body.external_link_name) channelData.external_link_name = body.external_link_name;
    if (body.hello_video_url) channelData.hello_video_url = body.hello_video_url;
    if (body.subscription_type) channelData.subscription_type = body.subscription_type;
    if (body.subscription_start_date) channelData.subscription_start_date = body.subscription_start_date;
    if (body.channel_history) channelData.channel_history = body.channel_history;
    if (body.is_active !== undefined) channelData.is_active = body.is_active;
    if (body.last_synced_at) channelData.last_synced_at = body.last_synced_at;

    let channel;
    let isUpdate = false;

    if (existingChannel) {
      // Update existing channel
      console.log('Updating existing channel in Supabase:', existingChannel.id, channelData);
      const { data: updatedChannel, error: updateError } = await supabase
        .from('channels')
        .update(channelData)
        .eq('id', existingChannel.id)
        .select('id')
        .single();

      if (updateError) {
        console.error('Error updating channel in Supabase:', updateError);
        return NextResponse.json(
          { error: 'Failed to update channel', details: updateError.message },
          { status: 500 }
        );
      }

      channel = updatedChannel;
      isUpdate = true;
      console.log('Channel updated successfully:', channel);
    } else {
      // Insert new channel
      console.log('Inserting new channel into Supabase:', channelData);
      const { data: newChannel, error: insertError } = await supabase
        .from('channels')
        .insert(channelData)
        .select('id')
        .single();

      if (insertError) {
        console.error('Error inserting channel into Supabase:', insertError);
        return NextResponse.json(
          { error: 'Failed to create channel', details: insertError.message },
          { status: 500 }
        );
      }

      channel = newChannel;
      console.log('Channel created successfully:', channel);
    }

    // Return the channel ID for Attio to read
    const supabaseChannelId = channel.id;
    console.log('Channel operation completed:', { channelId: supabaseChannelId, isUpdate });

    return NextResponse.json({
      success: true,
      channelId: supabaseChannelId,
      isUpdate,
    });
  } catch (error) {
    console.error('Error in POST /api/attio/webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
