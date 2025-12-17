import { NextResponse } from 'next/server';

const iconSvg = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" rx="12" fill="#B2071D"/>
  <circle cx="27" cy="27" r="12" stroke="white" stroke-width="4" fill="none"/>
  <line x1="35" y1="35" x2="48" y2="48" stroke="white" stroke-width="4" stroke-linecap="round"/>
</svg>`;

export async function GET() {
  return new NextResponse(iconSvg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
