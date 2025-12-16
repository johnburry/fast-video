import { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ channelHandle: string }>
}): Promise<Metadata> {
  const { channelHandle } = await params

  try {
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
          icon: '/icon.svg',
        },
      }
    }

    const title = `🔍 ${channel.channel_name} - Fast Video Transcript Search`
    const description = channel.channel_description || `Search transcripts for ${channel.channel_name} videos`
    // Use banner image if available, otherwise fall back to thumbnail
    const image = channel.banner_url || channel.thumbnail_url || ''

    return {
      title,
      description,
      icons: {
        icon: '/icon.svg',
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
    return {
      title: 'Fast Video Transcript Search',
      icons: {
        icon: '/icon.svg',
      },
    }
  }
}

export default function ChannelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
