'use client';

import { useEffect } from 'react';

export default function HeadLinks() {
  useEffect(() => {
    // Force favicon refresh with cache-busting
    const timestamp = Date.now();

    // Remove Vercel's default favicon if present
    const vercelFavicon = document.querySelector('link[href*="vercel"]');
    if (vercelFavicon) {
      vercelFavicon.remove();
    }

    // Add our favicon links if they don't exist
    if (!document.querySelector('link[href="/icon.svg"]')) {
      const link1 = document.createElement('link');
      link1.rel = 'icon';
      link1.type = 'image/svg+xml';
      link1.href = `/icon.svg?v=${timestamp}`;
      document.head.appendChild(link1);
    }

    if (!document.querySelector('link[href*="/icon.png"]') && !document.querySelector('link[href="/icon"]')) {
      const link2 = document.createElement('link');
      link2.rel = 'alternate icon';
      link2.type = 'image/png';
      link2.href = `/icon?v=${timestamp}`;
      document.head.appendChild(link2);
    }
  }, []);

  return null;
}
