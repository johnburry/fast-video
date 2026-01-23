'use client';

import { useState, useEffect } from 'react';
import { getTenantConfig, transformDbTenant, type TenantConfig } from '@/lib/tenant-config';

// Cache for tenant configs to avoid repeated API calls
const tenantCache: Map<string, { config: TenantConfig; timestamp: number }> = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Fetch tenant config from API
async function fetchTenantConfig(hostname: string, skipCache = false): Promise<TenantConfig> {
  const cleanDomain = hostname.split(':')[0];

  // Check cache first (unless skipCache is true)
  if (!skipCache) {
    const cached = tenantCache.get(cleanDomain);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.config;
    }
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
export function useTenantConfig(): TenantConfig & { isLoading?: boolean } {
  const [config, setConfig] = useState<TenantConfig & { isLoading?: boolean }>(() => {
    // Initial fallback based on actual hostname to prevent flash
    if (typeof window === 'undefined') {
      return { ...getTenantConfig('playsermons.com'), isLoading: true };
    }
    // Use hostname-specific fallback to minimize flash
    return { ...getTenantConfig(window.location.hostname), isLoading: true };
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check if ?refresh_tenant=1 is in URL to bypass cache
      const urlParams = new URLSearchParams(window.location.search);
      const skipCache = urlParams.get('refresh_tenant') === '1';

      fetchTenantConfig(window.location.hostname, skipCache).then((fetchedConfig) => {
        setConfig({ ...fetchedConfig, isLoading: false });
      });
    }
  }, []);

  return config;
}
