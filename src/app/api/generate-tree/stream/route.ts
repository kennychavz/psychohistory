import { NextRequest } from 'next/server';
import { TreeBuilder } from '@/lib/tree/tree-builder';
import { SeedInput, TreeStreamEvent } from '@/types/tree';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const seed: SeedInput = body;

    // Validate input
    if (!seed.event || seed.event.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Event is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Helper to send SSE event
        const sendEvent = (event: TreeStreamEvent) => {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        };

        try {
          // Create tree builder with event callback
          const builder = new TreeBuilder(seed.maxDepth || 3, 20);

          // Generate tree with streaming events
          await builder.buildTree(seed, (event) => {
            sendEvent(event);
          });

          // Close the stream
          controller.close();
        } catch (error) {
          // Send error event
          sendEvent({
            type: 'error',
            data: {
              message: error instanceof Error ? error.message : 'Unknown error'
            }
          });

          controller.close();
        }
      },
    });

    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Stream setup error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
