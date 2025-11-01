/**
 * Hook for streaming tree generation with real-time updates
 */

import { useCallback, useRef } from 'react';
import { SeedInput, TreeStreamEvent } from '@/types/tree';
import { useTreeStore } from '@/stores/tree-store';

export function useTreeGeneration() {
  const store = useTreeStore();
  const eventSourceRef = useRef<EventSource | null>(null);

  const generateTree = useCallback(async (seed: SeedInput) => {
    // Reset store
    store.reset();

    try {
      // Close any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Create POST request body
      const response = await fetch('/api/generate-tree/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(seed),
      });

      if (!response.ok) {
        throw new Error('Failed to start tree generation');
      }

      // Read the stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      // Process stream
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode chunk
        const chunk = decoder.decode(value, { stream: true });

        // Parse SSE messages (can be multiple in one chunk)
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            try {
              const event: TreeStreamEvent = JSON.parse(data);
              handleEvent(event, store);
            } catch (error) {
              console.error('Failed to parse event:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Tree generation error:', error);
      store.setError(error instanceof Error ? error.message : 'Unknown error');
    }
  }, [store]);

  const cancelGeneration = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    store.completeGeneration();
  }, [store]);

  return {
    generateTree,
    cancelGeneration,
    isGenerating: store.isGenerating,
    root: store.root,
    currentDepth: store.currentDepth,
    totalNodes: store.totalNodes,
    completedNodes: store.completedNodes,
    error: store.error,
  };
}

// Handle stream events and update store
function handleEvent(event: TreeStreamEvent, store: ReturnType<typeof useTreeStore.getState>) {
  console.log('Received event:', event.type, event.data);

  switch (event.type) {
    case 'tree_started':
      store.startGeneration(event.data.seed);
      break;

    case 'node_processing':
      store.updateNodeStatus(event.data.nodeId, 'processing');
      break;

    case 'node_completed': {
      const { node, children } = event.data;

      // Update parent node status
      store.updateNodeStatus(node.id, 'completed');

      // Add children to tree
      children.forEach(child => {
        store.addNode(child, node.id);
      });
      break;
    }

    case 'depth_completed':
      console.log(`Depth ${event.data.depth} completed with ${event.data.nodesProcessed} nodes`);
      break;

    case 'tree_completed':
      console.log(`Tree generation completed: ${event.data.totalNodes} nodes in ${event.data.duration}ms`);
      store.completeGeneration();
      break;

    case 'error':
      console.error('Tree generation error:', event.data.message);
      store.setError(event.data.message);
      break;
  }
}
