import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { getServerTenantConfig } from '@/lib/tenant-config';

export async function GET(request: NextRequest) {
  try {
    // Get tenant from hostname
    const hostname = request.headers.get('host') || '';
    console.log('[Default Channel API] hostname:', hostname);
    const tenantConfig = await getServerTenantConfig(hostname);
    console.log('[Default Channel API] tenantConfig.domain:', tenantConfig.domain);

    // Get tenant_id from database
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('id')
      .eq('domain', tenantConfig.domain)
      .single();

    const tenantId = tenantData?.id;
    console.log('[Default Channel API] tenantId:', tenantId);

    if (!tenantId) {
      console.log('[Default Channel API] No tenant found, returning null');
      return NextResponse.json({ defaultChannel: null });
    }

    // Check if we're already on a subdomain (not the root domain)
    const parts = hostname.split('.');
    const isSubdomain = parts.length > 2 && parts[0] !== 'www';
    console.log('[Default Channel API] parts:', parts, 'isSubdomain:', isSubdomain);

    // If we're on a subdomain, don't redirect (we're already on a channel page)
    if (isSubdomain) {
      console.log('[Default Channel API] On subdomain, returning null');
      return NextResponse.json({ defaultChannel: null });
    }

    // Get all active channels for this tenant
    const { data: channels, error } = await supabase
      .from('channels')
      .select('id, channel_handle, channel_name')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    console.log('[Default Channel API] Found channels:', channels?.length, 'error:', error);

    if (error || !channels || channels.length === 0) {
      console.log('[Default Channel API] No channels found, returning null');
      return NextResponse.json({ defaultChannel: null });
    }

    // If there's exactly one channel, it's the default
    if (channels.length === 1) {
      console.log('[Default Channel API] Returning default channel:', channels[0]);
      return NextResponse.json({
        defaultChannel: {
          id: channels[0].id,
          handle: channels[0].channel_handle,
          name: channels[0].channel_name,
        },
      });
    }

    // If there are multiple channels, no default
    console.log('[Default Channel API] Multiple channels, returning null');
    return NextResponse.json({ defaultChannel: null });
  } catch (error) {
    console.error('Error checking default channel:', error);
    return NextResponse.json({ defaultChannel: null });
  }
}
