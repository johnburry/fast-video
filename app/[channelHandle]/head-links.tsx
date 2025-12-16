'use client';

import { useEffect } from 'react';

export default function HeadLinks() {
  useEffect(() => {
    // Ensure favicon link elements exist and are correct
    const ensureFavicon = () => {
      // Remove any existing favicons
      const existingIcons = document.querySelectorAll('link[rel*="icon"]');
      existingIcons.forEach(icon => icon.remove());

      // Add new favicon links
      const link1 = document.createElement('link');
      link1.rel = 'icon';
      link1.type = 'image/svg+xml';
      link1.href = '/icon.svg';
      document.head.appendChild(link1);

      const link2 = document.createElement('link');
      link2.rel = 'shortcut icon';
      link2.href = '/icon.svg';
      document.head.appendChild(link2);

      const link3 = document.createElement('link');
      link3.rel = 'apple-touch-icon';
      link3.href = '/icon.svg';
      document.head.appendChild(link3);
    };

    ensureFavicon();
  }, []);

  return null;
}
