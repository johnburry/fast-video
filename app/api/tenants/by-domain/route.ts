import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');

    if (!domain) {
      return NextResponse.json(
        { error: 'Domain parameter is required' },
        { status: 400 }
      );
    }

    // Remove port if present (e.g., localhost:3000) and convert to lowercase
    const cleanDomain = domain.split(':')[0].toLowerCase();

    // Try exact match first (case insensitive)
    let { data: tenant, error } = await supabase
      .from('tenants')
      .select('*')
      .ilike('domain', cleanDomain)
      .eq('is_active', true)
      .single();

    // If no exact match, try to find a tenant where the domain is a subdomain
    if (error || !tenant) {
      const { data: allTenants, error: allError } = await supabase
        .from('tenants')
        .select('*')
        .eq('is_active', true);

      if (!allError && allTenants) {
        // Find a tenant whose domain matches as a parent domain (case insensitive)
        tenant = allTenants.find((t) => cleanDomain.endsWith(t.domain.toLowerCase())) || null;
      }
    }

    if (!tenant) {
      // Return default tenant (playsermons.com) if no match found
      const { data: defaultTenant, error: defaultError } = await supabase
        .from('tenants')
        .select('*')
        .eq('domain', 'playsermons.com')
        .eq('is_active', true)
        .single();

      if (defaultError || !defaultTenant) {
        return NextResponse.json(
          { error: 'No tenant found' },
          { status: 404 }
        );
      }

      tenant = defaultTenant;
    }

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error('Error in GET /api/tenants/by-domain:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
