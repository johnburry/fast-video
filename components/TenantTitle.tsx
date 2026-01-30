'use client';

import { useEffect } from 'react';
import { useTenantConfig } from '@/lib/hooks/useTenantConfig';

export function TenantTitle() {
  const tenantConfig = useTenantConfig();

  useEffect(() => {
    if (!tenantConfig.isLoading) {
      // Update document title based on tenant tagline or name
      const title = tenantConfig.tagline || tenantConfig.name;

      // For PlaySermons.com, prepend domain to title
      const pageTitle = tenantConfig.domain === 'playsermons.com'
        ? `PlaySermons.com - ${title}`
        : title;

      document.title = pageTitle;
    }
  }, [tenantConfig.isLoading, tenantConfig.tagline, tenantConfig.name, tenantConfig.domain]);

  return null;
}
