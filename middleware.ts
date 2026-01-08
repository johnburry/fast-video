import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') || ''

  console.log('===== MIDDLEWARE START =====')
  console.log('Middleware - full URL:', request.url)
  console.log('Middleware - pathname:', url.pathname)
  console.log('Middleware - pathname length:', url.pathname.length)
  console.log('Middleware - pathname === "/":', url.pathname === '/')
  console.log('Middleware - hostname:', hostname)
  console.log('Middleware - search:', url.search)

  // Check if this is a URL shortcut pattern FIRST (before subdomain check)
  // This handles URLs like fast.video/https://example.com
  // The pathname might be encoded, so check both encoded and decoded versions
  const rawPathname = url.pathname
  const decodedPathname = decodeURIComponent(url.pathname)

  console.log('Middleware - rawPathname:', rawPathname)
  console.log('Middleware - decodedPathname:', decodedPathname)
  console.log('Middleware - raw includes http:', rawPathname.toLowerCase().includes('http'))
  console.log('Middleware - decoded includes http:', decodedPathname.toLowerCase().includes('http'))

  // Check both raw and decoded pathnames for URL patterns
  // This catches: /https://example.com, /http://example.com, /https:/example.com, etc.
  const hasUrlPattern =
    rawPathname.toLowerCase().includes('http://') ||
    rawPathname.toLowerCase().includes('https://') ||
    rawPathname.toLowerCase().includes('http:/') ||
    rawPathname.toLowerCase().includes('https:/') ||
    decodedPathname.toLowerCase().includes('http://') ||
    decodedPathname.toLowerCase().includes('https://') ||
    decodedPathname.toLowerCase().includes('http:/') ||
    decodedPathname.toLowerCase().includes('https:/')

  console.log('Middleware - hasUrlPattern:', hasUrlPattern)

  if (hasUrlPattern) {
    console.log('Middleware - URL shortcut pattern detected, allowing through')
    return NextResponse.next()
  }

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
  // BUT: don't redirect if this is a URL shortcut (already checked above and would have returned)
  console.log('Middleware - Checking redirect condition:')
  console.log('  - subdomain:', subdomain)
  console.log('  - url.pathname:', url.pathname)
  console.log('  - hostname.includes(localhost):', hostname.includes('localhost'))
  console.log('  - Will redirect?:', !subdomain && url.pathname === '/' && !hostname.includes('localhost'))

  if (!subdomain && url.pathname === '/' && !hostname.includes('localhost')) {
    console.log('Middleware - bare domain root, redirecting to reorbit.com')
    console.log('Middleware - ABOUT TO REDIRECT - pathname was:', url.pathname)
    console.log('Middleware - ABOUT TO REDIRECT - full URL was:', request.url)

    // Add debugging: Instead of redirecting, temporarily show debug info
    // return NextResponse.redirect('https://reorbit.com')

    // Temporarily redirect to debug page to see what's happening
    const debugUrl = new URL('/debug-url', request.url)
    debugUrl.searchParams.set('original_url', request.url)
    debugUrl.searchParams.set('pathname', url.pathname)
    return NextResponse.redirect(debugUrl)
  }

  // If no subdomain, block access to /update (only accessible from subdomains)
  if (!subdomain && url.pathname.startsWith('/update')) {
    return NextResponse.redirect(new URL('https://reorbit.com', request.url))
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

    // Allow /admin, /api, /record, /update, and /v to pass through without subdomain prefix
    if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api') || url.pathname.startsWith('/record') || url.pathname.startsWith('/update') || url.pathname.startsWith('/v')) {
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
