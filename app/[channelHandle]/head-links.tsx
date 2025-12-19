'use client';

import { useEffect } from 'react';

interface HeadLinksProps {
  title?: string;
  description?: string;
  image?: string;
}

export default function HeadLinks({ title, description, image }: HeadLinksProps = {}) {
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

    // Set document title if provided
    if (title) {
      document.title = title;
    }

    // Set OpenGraph meta tags if provided
    if (title || description || image) {
      // Remove existing OG tags to avoid duplicates
      const existingOgTags = document.querySelectorAll('meta[property^="og:"]');
      existingOgTags.forEach(tag => tag.remove());

      if (title) {
        const ogTitle = document.createElement('meta');
        ogTitle.setAttribute('property', 'og:title');
        ogTitle.setAttribute('content', title);
        document.head.appendChild(ogTitle);

        const twitterTitle = document.createElement('meta');
        twitterTitle.setAttribute('name', 'twitter:title');
        twitterTitle.setAttribute('content', title);
        document.head.appendChild(twitterTitle);
      }

      if (description) {
        const ogDescription = document.createElement('meta');
        ogDescription.setAttribute('property', 'og:description');
        ogDescription.setAttribute('content', description);
        document.head.appendChild(ogDescription);

        const twitterDescription = document.createElement('meta');
        twitterDescription.setAttribute('name', 'twitter:description');
        twitterDescription.setAttribute('content', description);
        document.head.appendChild(twitterDescription);
      }

      if (image) {
        const ogImage = document.createElement('meta');
        ogImage.setAttribute('property', 'og:image');
        ogImage.setAttribute('content', image);
        document.head.appendChild(ogImage);

        const twitterImage = document.createElement('meta');
        twitterImage.setAttribute('name', 'twitter:image');
        twitterImage.setAttribute('content', image);
        document.head.appendChild(twitterImage);

        const twitterCard = document.createElement('meta');
        twitterCard.setAttribute('name', 'twitter:card');
        twitterCard.setAttribute('content', 'summary_large_image');
        document.head.appendChild(twitterCard);
      }
    }
  }, [title, description, image]);

  return null;
}
