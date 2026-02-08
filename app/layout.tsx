import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Fathom from "@/components/Fathom";
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

  // Determine Open Graph image based on tenant logo type
  let ogImageUrl: string;

  if (tenantConfig.logo.type === 'image' && tenantConfig.logo.imageUrl) {
    // Use the tenant's image logo
    const isAbsoluteUrl = tenantConfig.logo.imageUrl.startsWith('http://') || tenantConfig.logo.imageUrl.startsWith('https://');
    ogImageUrl = isAbsoluteUrl
      ? tenantConfig.logo.imageUrl
      : `https://${tenantConfig.domain}${tenantConfig.logo.imageUrl}`;
  } else {
    // For text logos or missing images, use a generic placeholder or nothing
    // Don't default to PlaySermons logo for other tenants
    ogImageUrl = `https://${tenantConfig.domain}/og-image.png`;
  }

  // Use tenant name as the OG title (not PlaySermons)
  const ogTitle = tenantConfig.tagline || tenantConfig.name;

  // Use tenant-specific description
  const description = tenantConfig.tagline ||
    `Search and discover content from ${tenantConfig.name}`;

  // Page title - only prepend domain for PlaySermons.com
  const pageTitle = tenantConfig.domain === 'playsermons.com'
    ? `PlaySermons.com - ${ogTitle}`
    : tenantConfig.name;

  return {
    title: pageTitle,
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
        <Fathom />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
