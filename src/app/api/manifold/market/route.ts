import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json(
        { error: 'Market slug is required' },
        { status: 400 }
      );
    }

    // Fetch from Manifold API server-side (no CORS issues)
    const response = await fetch(`https://api.manifold.markets/v0/slug/${slug}`);

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Market not found' },
        { status: 404 }
      );
    }

    const market = await response.json();

    return NextResponse.json(market);
  } catch (error) {
    console.error('Error fetching market:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market' },
      { status: 500 }
    );
  }
}
