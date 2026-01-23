'use client';

import { useEffect } from 'react';
import { useTenantConfig } from '@/lib/hooks/useTenantConfig';

export function TenantTitle() {
  const tenantConfig = useTenantConfig();

  useEffect(() => {
    if (!tenantConfig.isLoading) {
      // Update document title based on tenant
      if (tenantConfig.domain === 'fast.video') {
        document.title = 'Fast.Video: Lightning-Fast Video Search';
      } else {
        document.title = 'PlaySermons: AI Search for Your Sermon Videos';
      }
    }
  }, [tenantConfig.isLoading, tenantConfig.domain]);

  return null;
}
