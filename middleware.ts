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

  // If we have a subdomain and we're on the root path, rewrite to /{subdomain}
  if (subdomain && url.pathname === '/') {
    url.pathname = `/${subdomain}`
    return NextResponse.rewrite(url)
  }

  // If we have a subdomain and we're on any other path, prepend the subdomain to the path
  if (subdomain && !url.pathname.startsWith(`/${subdomain}`)) {
    url.pathname = `/${subdomain}${url.pathname}`
    return NextResponse.rewrite(url)
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
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
