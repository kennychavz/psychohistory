import { NextRequest, NextResponse } from 'next/server';
import { TreeBuilder } from '@/lib/tree/tree-builder';
import { SeedInput } from '@/types/tree';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const seed: SeedInput = body;

    // Validate input
    if (!seed.event || seed.event.trim().length === 0) {
      return NextResponse.json(
        { error: 'Event is required' },
        { status: 400 }
      );
    }

    // Generate tree
    const builder = new TreeBuilder(seed.maxDepth || 3, 20);
    const tree = await builder.buildTree(seed);

    return NextResponse.json({ tree });
  } catch (error) {
    console.error('Tree generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
