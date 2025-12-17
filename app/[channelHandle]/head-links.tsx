'use client';

import { useEffect } from 'react';

export default function HeadLinks() {
  useEffect(() => {
    // Force favicon refresh with cache-busting
    const timestamp = Date.now();

    // Remove Vercel's default favicon and any SVG favicons
    const vercelFavicon = document.querySelector('link[href*="vercel"]');
    if (vercelFavicon) {
      vercelFavicon.remove();
    }

    const svgFavicons = document.querySelectorAll('link[href*=".svg"]');
    svgFavicons.forEach(icon => icon.remove());

    // Add PNG favicon links with cache-busting
    if (!document.querySelector('link[href*="/icon"]')) {
      const iconLink = document.createElement('link');
      iconLink.rel = 'icon';
      iconLink.type = 'image/png';
      iconLink.href = `/icon?v=${timestamp}`;
      document.head.appendChild(iconLink);
    }

    if (!document.querySelector('link[href="/favicon.ico"]')) {
      const faviconLink = document.createElement('link');
      faviconLink.rel = 'shortcut icon';
      faviconLink.href = `/favicon.ico?v=${timestamp}`;
      document.head.appendChild(faviconLink);
    }

    if (!document.querySelector('link[href*="/apple-icon"]')) {
      const appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      appleLink.href = `/apple-icon?v=${timestamp}`;
      document.head.appendChild(appleLink);
    }
  }, []);

  return null;
}
