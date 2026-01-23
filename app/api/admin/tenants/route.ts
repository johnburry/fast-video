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

export async function GET() {
  try {
    const { data: tenants, error } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tenants:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tenants });
  } catch (error) {
    console.error('Error in GET /api/admin/tenants:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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
      features,
      colors,
      is_active
    } = body;

    // Validate required fields
    if (!domain || !name || !logo_type || !logo_alt_text || !search_placeholder || !search_results_heading) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (logo_type !== 'text' && logo_type !== 'image') {
      return NextResponse.json(
        { error: 'logo_type must be either "text" or "image"' },
        { status: 400 }
      );
    }

    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .insert({
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
        features,
        colors,
        is_active: is_active ?? true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating tenant:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tenant }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/admin/tenants:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
