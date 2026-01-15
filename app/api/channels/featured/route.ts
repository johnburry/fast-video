import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

const FEATURED_CHANNEL_IDS = [
  'a5c701d0-fd07-44ff-b547-44dc61ac9cc9',
  '5213fa50-0dc8-4bb1-8b2b-0d393bdd51ab',
  '51066ca5-daa2-4056-a88d-210140957793'
];

export async function GET() {
  try {
    const { data: channels, error } = await supabaseAdmin
      .from('channels')
      .select('id, channel_handle, channel_name, thumbnail_url, channel_description')
      .in('id', FEATURED_CHANNEL_IDS);

    if (error) {
      console.error('Error fetching featured channels:', error);
      return NextResponse.json({ channels: [] });
    }

    return NextResponse.json({ channels: channels || [] });
  } catch (error) {
    console.error('Error in featured channels API:', error);
    return NextResponse.json({ channels: [] });
  }
}
