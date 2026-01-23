import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { headers } from 'next/headers';
import { getServerTenantConfig } from '@/lib/tenant-config';
import { TenantTitle } from '@/components/TenantTitle';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const hostname = headersList.get('host') || 'playsermons.com';
  const tenantConfig = await getServerTenantConfig(hostname);

  // Generate tenant-specific metadata
  if (tenantConfig.domain === 'fast.video') {
    // Use the tenant logo image URL if available, otherwise fall back to a default
    const ogImageUrl = tenantConfig.logo.imageUrl
      ? `https://fast.video${tenantConfig.logo.imageUrl}`
      : 'https://fast.video/playsermons-logo-2.png'; // Fallback to PlaySermons logo for now

    // Use tagline from tenant config for OG title, or tenant name if no tagline
    const ogTitle = tenantConfig.tagline || tenantConfig.name;
    const description = tenantConfig.tagline || "Search across video transcripts instantly. Find exactly what you're looking for in seconds with AI-powered semantic search.";

    return {
      title: tenantConfig.tagline || "Fast.Video: Lightning-Fast Video Search",
      description: description,
      icons: {
        icon: '/icon',
        shortcut: '/favicon.ico',
        apple: '/apple-icon',
      },
      openGraph: {
        title: ogTitle,
        description: description,
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: tenantConfig.name,
          },
        ],
        type: 'website',
        siteName: tenantConfig.name,
      },
      twitter: {
        card: 'summary_large_image',
        title: ogTitle,
        description: description,
        images: [ogImageUrl],
      },
    };
  }

  // Default to PlaySermons or any other tenant
  const ogImageUrl = tenantConfig.logo.imageUrl
    ? `https://${tenantConfig.domain}${tenantConfig.logo.imageUrl}`
    : 'https://playsermons.com/playsermons-logo.png';

  const ogTitle = tenantConfig.tagline || `${tenantConfig.name}: AI Search for Your Sermon Videos`;
  const description = tenantConfig.tagline || "Unlock your church's sermon library with AI-powered search. Make every sermon instantly searchable across your entire YouTube video library.";

  return {
    title: ogTitle,
    description: description,
    icons: {
      icon: '/icon',
      shortcut: '/favicon.ico',
      apple: '/apple-icon',
    },
    openGraph: {
      title: ogTitle,
      description: description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${tenantConfig.name} Logo`,
        },
      ],
      type: 'website',
      siteName: tenantConfig.name,
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: description,
      images: [ogImageUrl],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" href="/icon" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-icon" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TenantTitle />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
