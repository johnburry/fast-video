import { useState, useEffect } from 'react';

export interface TenantConfig {
  id?: string;
  name: string;
  domain: string;
  logo: {
    type: 'text' | 'image';
    text?: string;
    imageUrl?: string;
    altText: string;
  };
  tagline?: string;
  searchPlaceholder: string;
  searchResultsHeading: string;
  features?: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  colors?: {
    primary: string;
    secondary: string;
  };
}

const tenantConfigs: Record<string, TenantConfig> = {
  'playsermons.com': {
    name: 'Play Sermons',
    domain: 'playsermons.com',
    logo: {
      type: 'image',
      imageUrl: '/logo.svg',
      altText: 'Play Sermons',
    },
    tagline: 'Search and discover sermons from churches worldwide',
    searchPlaceholder: 'Search all churches',
    searchResultsHeading: 'Searching across all church sermons',
    features: [
      {
        icon: '🎯',
        title: 'Precise Search',
        description: 'Find exact moments in sermons with AI-powered search',
      },
      {
        icon: '⚡',
        title: 'Instant Results',
        description: 'Get results in milliseconds, not minutes',
      },
      {
        icon: '📱',
        title: 'Watch & Share',
        description: 'Start videos at the exact moment you searched for',
      },
    ],
  },
  'fast.video': {
    name: 'Fast.Video',
    domain: 'fast.video',
    logo: {
      type: 'text',
      text: 'Fast.Video',
      altText: 'Fast.Video',
    },
    searchPlaceholder: 'Search all videos',
    searchResultsHeading: 'Searching videos across all channels',
  },
};

export function getTenantConfig(hostname?: string): TenantConfig {
  if (!hostname) {
    if (typeof window !== 'undefined') {
      hostname = window.location.hostname;
    } else {
      // Default to playsermons.com for SSR
      return tenantConfigs['playsermons.com'];
    }
  }

  // Remove port if present (e.g., localhost:3000)
  const domain = hostname.split(':')[0];

  // Check for exact match
  if (tenantConfigs[domain]) {
    return tenantConfigs[domain];
  }

  // Check for subdomain matches (e.g., www.playsermons.com)
  for (const [configDomain, config] of Object.entries(tenantConfigs)) {
    if (domain.endsWith(configDomain)) {
      return config;
    }
  }

  // Default to playsermons.com
  return tenantConfigs['playsermons.com'];
}

// Transform database tenant to TenantConfig
function transformDbTenant(dbTenant: any): TenantConfig {
  return {
    id: dbTenant.id,
    name: dbTenant.name,
    domain: dbTenant.domain,
    logo: {
      type: dbTenant.logo_type,
      text: dbTenant.logo_text,
      imageUrl: dbTenant.logo_image_url,
      altText: dbTenant.logo_alt_text,
    },
    tagline: dbTenant.tagline,
    searchPlaceholder: dbTenant.search_placeholder,
    searchResultsHeading: dbTenant.search_results_heading,
    features: dbTenant.features,
    colors: dbTenant.colors,
  };
}

// Cache for tenant configs to avoid repeated API calls
const tenantCache: Map<string, { config: TenantConfig; timestamp: number }> = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Fetch tenant config from API
async function fetchTenantConfig(hostname: string): Promise<TenantConfig> {
  const cleanDomain = hostname.split(':')[0];

  // Check cache first
  const cached = tenantCache.get(cleanDomain);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.config;
  }

  try {
    const response = await fetch(`/api/tenants/by-domain?domain=${encodeURIComponent(cleanDomain)}`);
    if (response.ok) {
      const data = await response.json();
      const config = transformDbTenant(data.tenant);

      // Update cache
      tenantCache.set(cleanDomain, { config, timestamp: Date.now() });

      return config;
    }
  } catch (error) {
    console.error('Error fetching tenant config:', error);
  }

  // Fall back to hardcoded config
  return getTenantConfig(hostname);
}

// Hook for client-side usage with database fetching
export function useTenantConfig(): TenantConfig {
  const [config, setConfig] = useState<TenantConfig>(() => {
    // Initial fallback
    if (typeof window === 'undefined') {
      return tenantConfigs['playsermons.com'];
    }
    return getTenantConfig(window.location.hostname);
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetchTenantConfig(window.location.hostname).then(setConfig);
    }
  }, []);

  return config;
}

// Server-side function to get tenant config from database
export async function getServerTenantConfig(hostname: string): Promise<TenantConfig> {
  const cleanDomain = hostname.split(':')[0];

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try exact match first
    let { data: tenant, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('domain', cleanDomain)
      .eq('is_active', true)
      .single();

    // If no exact match, try to find a tenant where the domain is a subdomain
    if (error || !tenant) {
      const { data: allTenants, error: allError } = await supabase
        .from('tenants')
        .select('*')
        .eq('is_active', true);

      if (!allError && allTenants) {
        tenant = allTenants.find((t: any) => cleanDomain.endsWith(t.domain)) || null;
      }
    }

    if (tenant) {
      return transformDbTenant(tenant);
    }
  } catch (error) {
    console.error('Error fetching server tenant config:', error);
  }

  // Fall back to hardcoded config
  return getTenantConfig(hostname);
}
