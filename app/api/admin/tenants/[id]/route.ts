import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching tenant:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error('Error in GET /api/admin/tenants/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      domain,
      name,
      logo_type,
      logo_text,
      logo_image_url,
      logo_alt_text,
      tagline,
      search_placeholder,
      search_results_heading,
      redirect_url,
      channels_gallery,
      features,
      colors,
      is_active
    } = body;

    const updateData: any = {};
    if (domain !== undefined) updateData.domain = domain;
    if (name !== undefined) updateData.name = name;
    if (logo_type !== undefined) {
      if (logo_type !== 'text' && logo_type !== 'image') {
        return NextResponse.json(
          { error: 'logo_type must be either "text" or "image"' },
          { status: 400 }
        );
      }
      updateData.logo_type = logo_type;
    }
    if (logo_text !== undefined) updateData.logo_text = logo_text;
    if (logo_image_url !== undefined) updateData.logo_image_url = logo_image_url;
    if (logo_alt_text !== undefined) updateData.logo_alt_text = logo_alt_text;
    if (tagline !== undefined) updateData.tagline = tagline;
    if (search_placeholder !== undefined) updateData.search_placeholder = search_placeholder || 'Search all videos';
    if (search_results_heading !== undefined) updateData.search_results_heading = search_results_heading || 'Search';
    if (redirect_url !== undefined) updateData.redirect_url = redirect_url;
    if (channels_gallery !== undefined) updateData.channels_gallery = channels_gallery;
    if (features !== undefined) updateData.features = features;
    if (colors !== undefined) updateData.colors = colors;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating tenant:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error('Error in PUT /api/admin/tenants/[id]:', error);
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
    // First check if any channels are using this tenant
    const { data: channels, error: channelsError } = await supabaseAdmin
      .from('channels')
      .select('id')
      .eq('tenant_id', id)
      .limit(1);

    if (channelsError) {
      console.error('Error checking channels:', channelsError);
      return NextResponse.json(
        { error: channelsError.message },
        { status: 500 }
      );
    }

    if (channels && channels.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete tenant with associated channels. Please reassign or delete channels first.' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('tenants')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting tenant:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/admin/tenants/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
