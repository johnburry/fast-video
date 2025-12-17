import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { name, description, externalLink, externalLinkName, isActive } = body;

    const { data, error } = await supabaseAdmin
      .from('channels')
      .update({
        channel_name: name,
        channel_description: description,
        external_link: externalLink,
        external_link_name: externalLinkName,
        is_active: isActive,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating channel:', error);
      return NextResponse.json(
        { error: 'Failed to update channel' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, channel: data });
  } catch (error) {
    console.error('Error in PATCH /api/admin/channels/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete channel (cascade will handle videos and transcripts due to foreign key constraints)
    const { error } = await supabaseAdmin
      .from('channels')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting channel:', error);
      return NextResponse.json(
        { error: 'Failed to delete channel' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/admin/channels/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
