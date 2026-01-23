'use client';

import { useEffect } from 'react';
import { useTenantConfig } from '@/lib/hooks/useTenantConfig';

export function TenantTitle() {
  const tenantConfig = useTenantConfig();

  useEffect(() => {
    if (!tenantConfig.isLoading) {
      // Update document title based on tenant tagline or name
      const title = tenantConfig.tagline || tenantConfig.name;
      document.title = title;
    }
  }, [tenantConfig.isLoading, tenantConfig.tagline, tenantConfig.name]);

  return null;
}
