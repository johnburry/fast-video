import { Metadata } from 'next'
import { headers } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getServerTenantConfig } from '@/lib/tenant-config'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ channelHandle: string }>
}): Promise<Metadata> {
  const { channelHandle } = await params

  try {
    // Get tenant from hostname
    const headersList = await headers()
    const hostname = headersList.get('host') || 'playsermons.com'
    const tenantConfig = await getServerTenantConfig(hostname)

    // Fetch channel data from database
    const { data: channel } = await supabaseAdmin
      .from('channels')
      .select('channel_name, channel_handle, channel_description, banner_url, thumbnail_url')
      .eq('channel_handle', channelHandle)
      .single()

    if (!channel) {
      return {
        title: 'Channel Not Found',
        icons: {
          icon: '/icon',
          shortcut: '/favicon.ico',
          apple: '/apple-icon',
        },
      }
    }

    const title = `🔍 ${channel.channel_name} - ${tenantConfig.name}`
    const description = channel.channel_description || `Search transcripts for ${channel.channel_name} videos`
    // Use banner image if available, otherwise fall back to thumbnail
    const image = channel.banner_url || channel.thumbnail_url || ''

    return {
      title,
      description,
      icons: {
        icon: '/icon',
        shortcut: '/favicon.ico',
        apple: '/apple-icon',
      },
      openGraph: {
        title,
        description,
        images: image ? [{ url: image }] : [],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: image ? [image] : [],
      },
    }
  } catch (error) {
    console.error('Error generating metadata:', error)

    // Try to get tenant for fallback title
    try {
      const headersList = await headers()
      const hostname = headersList.get('host') || 'playsermons.com'
      const tenantConfig = await getServerTenantConfig(hostname)

      return {
        title: tenantConfig.name,
        icons: {
          icon: '/icon',
          shortcut: '/favicon.ico',
          apple: '/apple-icon',
        },
      }
    } catch {
      return {
        title: 'Channel Not Found',
        icons: {
          icon: '/icon',
          shortcut: '/favicon.ico',
          apple: '/apple-icon',
        },
      }
    }
  }
}

import HeadLinks from './head-links'

export default function ChannelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <HeadLinks />
      {children}
    </>
  )
}
