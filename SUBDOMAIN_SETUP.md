# Subdomain Setup Guide

This application supports subdomain routing, allowing channels to be accessed via `channelhandle.playsermons.com` instead of `playsermons.com/channelhandle`.

## How It Works

The middleware in `middleware.ts` automatically detects subdomains and rewrites the URL to the appropriate channel page:
- `channelhandle.playsermons.com` → internally routes to `/channelhandle`
- All existing functionality (`playsermons.com/channelhandle`) continues to work

## DNS Configuration Required

To enable wildcard subdomains, you need to configure DNS settings:

### Option 1: Using Cloudflare (Recommended)

1. Go to your Cloudflare DNS settings for `playsermons.com`
2. Add a CNAME record:
   - **Type**: CNAME
   - **Name**: `*` (wildcard)
   - **Target**: `cname.vercel-dns.com` (or your Vercel project's CNAME)
   - **Proxy status**: Proxied (orange cloud)

### Option 2: Using Vercel DNS

1. Go to your Vercel project settings
2. Navigate to **Domains**
3. Add domain: `*.playsermons.com`
4. Follow Vercel's instructions to verify ownership

### Option 3: Other DNS Providers

Add a wildcard CNAME record:
```
Type: CNAME
Name: *
Value: cname.vercel-dns.com (or your Vercel CNAME)
TTL: Auto or 3600
```

## Vercel Configuration

In your Vercel project settings:

1. Go to **Settings** → **Domains**
2. Add the wildcard domain: `*.playsermons.com`
3. Vercel will guide you through verification

**Note**: Wildcard domains are available on Vercel Pro plans and above.

## Testing Locally

For local testing, you can use:
```bash
# Edit your /etc/hosts file (macOS/Linux)
127.0.0.1 testchannel.localhost

# Then access in browser:
http://testchannel.localhost:3000
```

Or use tools like `ngrok` for testing with real subdomains.

## How the Middleware Works

The `middleware.ts` file:
1. Extracts the subdomain from the hostname
2. Ignores `www` subdomain
3. Rewrites the request to `/{subdomain}` path
4. Preserves all query parameters and paths
5. Works with both production (`playsermons.com`) and localhost

## Examples

- `somehandle.playsermons.com` → shows channel page for `@somehandle`
- `somehandle.playsermons.com/admin` → rewrites to `/somehandle/admin`
- `www.playsermons.com` → shows homepage (no rewrite)
- `playsermons.com` → shows homepage (no rewrite)
- `playsermons.com/somehandle` → continues to work as before
