import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { getServerTenantConfig } from '@/lib/tenant-config';

export async function GET(request: NextRequest) {
  try {
    // Get tenant from hostname
    const hostname = request.headers.get('host') || '';
    const tenantConfig = await getServerTenantConfig(hostname);

    // Get tenant_id from database
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('id')
      .eq('domain', tenantConfig.domain)
      .single();

    const tenantId = tenantData?.id;

    if (!tenantId) {
      return NextResponse.json({ defaultChannel: null });
    }

    // Check if we're already on a subdomain (not the root domain)
    const parts = hostname.split('.');
    const isSubdomain = parts.length > 2 && parts[0] !== 'www';

    // If we're on a subdomain, don't redirect (we're already on a channel page)
    if (isSubdomain) {
      return NextResponse.json({ defaultChannel: null });
    }

    // Get all active channels for this tenant
    const { data: channels, error } = await supabase
      .from('channels')
      .select('id, channel_handle, channel_name')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (error || !channels || channels.length === 0) {
      return NextResponse.json({ defaultChannel: null });
    }

    // If there's exactly one channel, it's the default
    if (channels.length === 1) {
      return NextResponse.json({
        defaultChannel: {
          id: channels[0].id,
          handle: channels[0].channel_handle,
          name: channels[0].channel_name,
        },
      });
    }

    // If there are multiple channels, no default
    return NextResponse.json({ defaultChannel: null });
  } catch (error) {
    console.error('Error checking default channel:', error);
    return NextResponse.json({ defaultChannel: null });
  }
}
