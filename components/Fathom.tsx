'use client';

import { load, trackPageview } from 'fathom-client';
import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function TrackPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Load Fathom script on mount
  useEffect(() => {
    const siteId = process.env.NEXT_PUBLIC_FATHOM_SITE_ID;

    if (!siteId) {
      console.warn('Fathom Analytics: NEXT_PUBLIC_FATHOM_SITE_ID not found');
      return;
    }

    load(siteId, {
      auto: false, // Disable automatic tracking
      spa: 'auto', // Enable SPA mode
    });
  }, []);

  // Track page views on route change
  useEffect(() => {
    if (!pathname) return;

    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');

    trackPageview({
      url,
      referrer: document.referrer,
    });
  }, [pathname, searchParams]);

  return null;
}

export default function Fathom() {
  return (
    <Suspense fallback={null}>
      <TrackPageView />
    </Suspense>
  );
}
