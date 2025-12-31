import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Trim and validate URL
    const trimmedUrl = url.trim();

    // Check if URL is valid
    try {
      new URL(trimmedUrl);
    } catch (e) {
      console.error('Invalid URL provided:', trimmedUrl);
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Ensure URL starts with http:// or https://
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      console.error('URL must start with http:// or https://:', trimmedUrl);
      return NextResponse.json(
        { error: 'URL must start with http:// or https://' },
        { status: 400 }
      );
    }

    // Fetch the HTML from the URL
    const response = await fetch(trimmedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FastVideoBot/1.0; +https://fast.video)',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch URL:', trimmedUrl, 'Status:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch URL', status: response.status },
        { status: 500 }
      );
    }

    const html = await response.text();

    // Extract OpenGraph tags
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    const ogDescriptionMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                               html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);

    // Fallback to regular meta tags if OpenGraph tags not found
    const titleMatch = ogTitleMatch || html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descriptionMatch = ogDescriptionMatch || html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);

    const ogImage = ogImageMatch ? ogImageMatch[1] : null;
    const ogTitle = titleMatch ? titleMatch[1] : null;
    const ogDescription = descriptionMatch ? descriptionMatch[1] : null;

    return NextResponse.json({
      image: ogImage,
      title: ogTitle,
      description: ogDescription,
      url: trimmedUrl,
    });
  } catch (error) {
    console.error('Error fetching OpenGraph data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
