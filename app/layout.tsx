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
    return {
      title: "Fast.Video: Lightning-Fast Video Search",
      description: "Search across video transcripts instantly. Find exactly what you're looking for in seconds with AI-powered semantic search.",
      icons: {
        icon: '/icon',
        shortcut: '/favicon.ico',
        apple: '/apple-icon',
      },
      openGraph: {
        title: "Fast.Video: Lightning-Fast Video Search",
        description: "Search across video transcripts instantly. Find exactly what you're looking for in seconds with AI-powered semantic search.",
        images: [
          {
            url: `https://fast.video${tenantConfig.logo.imageUrl || '/fast-video-og.png'}`,
            width: 1200,
            height: 630,
            alt: 'Fast.Video',
          },
        ],
        type: 'website',
        siteName: 'Fast.Video',
      },
      twitter: {
        card: 'summary_large_image',
        title: "Fast.Video: Lightning-Fast Video Search",
        description: "Search across video transcripts instantly. Find exactly what you're looking for in seconds with AI-powered semantic search.",
        images: [`https://fast.video${tenantConfig.logo.imageUrl || '/fast-video-og.png'}`],
      },
    };
  }

  // Default to PlaySermons
  return {
    title: "PlaySermons: AI Search for Your Sermon Videos",
    description: "Unlock your church's sermon library with AI-powered search. Make every sermon instantly searchable across your entire YouTube video library.",
    icons: {
      icon: '/icon',
      shortcut: '/favicon.ico',
      apple: '/apple-icon',
    },
    openGraph: {
      title: "PlaySermons: AI Search for Your Sermon Videos",
      description: "Unlock your church's sermon library with AI-powered search. Make every sermon instantly searchable across your entire YouTube video library.",
      images: [
        {
          url: 'https://playsermons.com/playsermons-logo.png',
          width: 1200,
          height: 630,
          alt: 'PlaySermons Logo',
        },
      ],
      type: 'website',
      siteName: 'PlaySermons',
    },
    twitter: {
      card: 'summary_large_image',
      title: "PlaySermons: AI Search for Your Sermon Videos",
      description: "Unlock your church's sermon library with AI-powered search. Make every sermon instantly searchable across your entire YouTube video library.",
      images: ['https://playsermons.com/playsermons-logo.png'],
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
