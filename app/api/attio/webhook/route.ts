import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Attio API configuration
const ATTIO_API_TOKEN = '2fae068af1d007a686d73a0d35e3732c400be0d9466e398c48f41aa1e4ffabdc';
const ATTIO_API_BASE = 'https://api.attio.com/v2';
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

    // Prepare channel data for insertion
    // Use attio_list_entry_id for channel_handle if not provided to ensure uniqueness
    const channelData: any = {
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

    // Insert channel into Supabase
    console.log('Inserting channel into Supabase:', channelData);
    const { data: channel, error: insertError } = await supabase
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

    console.log('Channel created successfully:', channel);

    // Update Attio with the Supabase channel ID
    const supabaseChannelId = channel.id;
    console.log('Updating Attio list entry:', attioListEntryId, 'with Supabase channel ID:', supabaseChannelId);

    try {
      const attioResponse = await fetch(
        `${ATTIO_API_BASE}/lists/fast-video-people/entries/${attioListEntryId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${ATTIO_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: {
              values: {
                supabase_channel_id: [
                  {
                    target_object: 'uuid',
                    target_record_id: supabaseChannelId,
                  }
                ]
              }
            }
          }),
        }
      );

      if (!attioResponse.ok) {
        const errorText = await attioResponse.text();
        console.error('Failed to update Attio:', attioResponse.status, errorText);
        // Don't fail the entire request if Attio update fails
        return NextResponse.json({
          success: true,
          channelId: supabaseChannelId,
          warning: 'Channel created but failed to update Attio',
          attioError: errorText,
        });
      }

      const attioData = await attioResponse.json();
      console.log('Attio updated successfully:', attioData);

      return NextResponse.json({
        success: true,
        channelId: supabaseChannelId,
        attioUpdated: true,
      });
    } catch (attioError) {
      console.error('Error updating Attio:', attioError);
      // Don't fail the entire request if Attio update fails
      return NextResponse.json({
        success: true,
        channelId: supabaseChannelId,
        warning: 'Channel created but failed to update Attio',
        attioError: attioError instanceof Error ? attioError.message : 'Unknown error',
      });
    }
  } catch (error) {
    console.error('Error in POST /api/attio/webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
