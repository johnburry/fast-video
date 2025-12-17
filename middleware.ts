import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') || ''

  // Extract subdomain from hostname
  // Expected formats:
  // - channelhandle.fast.video
  // - channelhandle.localhost:3000 (for local development)
  const parts = hostname.split('.')

  // Check if we have a subdomain (not www, not the bare domain)
  let subdomain: string | null = null

  if (hostname.includes('localhost')) {
    // Local development: subdomain.localhost:3000
    if (parts.length >= 2 && parts[0] !== 'localhost') {
      subdomain = parts[0]
    }
  } else {
    // Production: subdomain.fast.video
    // We need at least 3 parts (subdomain.fast.video) and the first part shouldn't be 'www'
    if (parts.length >= 3 && parts[0] !== 'www') {
      subdomain = parts[0]
    }
  }

  // If no subdomain and we're on the root path (bare domain), redirect to reorbit.com
  if (!subdomain && url.pathname === '/' && !hostname.includes('localhost')) {
    return NextResponse.redirect('https://reorbit.com')
  }

  // If we have a subdomain, check if we're accessing a special path that should NOT be rewritten
  if (subdomain) {
    // Special case: 'all' subdomain routes to /all page
    if (subdomain === 'all') {
      if (url.pathname === '/') {
        url.pathname = '/all'
        return NextResponse.rewrite(url)
      }
      return NextResponse.next()
    }

    // Allow /admin, /api, and /record to pass through without subdomain prefix
    if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api') || url.pathname.startsWith('/record')) {
      return NextResponse.next()
    }

    // If we're on the root path, rewrite to /{subdomain}
    if (url.pathname === '/') {
      url.pathname = `/${subdomain}`
      return NextResponse.rewrite(url)
    }

    // If we're on any other path, prepend the subdomain to the path
    if (!url.pathname.startsWith(`/${subdomain}`)) {
      url.pathname = `/${subdomain}${url.pathname}`
      return NextResponse.rewrite(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon (favicon routes)
     * - icon.svg (favicon SVG)
     * - apple-icon (apple touch icons)
     * - icon (Next.js generated icons)
     */
    '/((?!api|_next/static|_next/image|favicon|icon.svg|apple-icon|icon).*)',
  ],
}
