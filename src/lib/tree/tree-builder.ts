/**
 * Core tree generation engine with streaming support
 */

import { v4 as uuidv4 } from 'uuid';
import { EventNode, SeedInput, TreeState, TreeStreamEvent } from '@/types/tree';
import { processNode } from './node-processor';

export class TreeBuilder {
  private state: TreeState;
  private maxConcurrent: number;
  private maxDepth: number;
  private onEvent?: (event: TreeStreamEvent) => void;
  private startTime: number = 0;

  constructor(maxDepth = 3, maxConcurrent = 20) {
    this.maxDepth = maxDepth;
    this.maxConcurrent = maxConcurrent;
    this.state = {
      root: null,
      nodeMap: new Map(),
      processingQueue: [],
      completedNodes: new Set(),
      totalNodes: 0,
      maxDepth,
      maxConcurrent,
      isGenerating: false,
    };
  }

  async buildTree(seed: SeedInput, onEvent?: (event: TreeStreamEvent) => void): Promise<EventNode> {
    this.onEvent = onEvent;
    this.startTime = Date.now();
    // Create root node
    const root: EventNode = {
      id: uuidv4(),
      event: seed.event,
      probability: 1.0,
      justification: 'Seed event',
      sentiment: 0,
      depth: 0,
      sources: [],
      children: [],
      parentId: null,
      createdAt: new Date(),
      processingStatus: 'pending',
    };

    this.state.root = root;
    this.state.nodeMap.set(root.id, root);
    this.state.processingQueue.push(root.id);
    this.state.totalNodes = 1;
    this.state.isGenerating = true;

    // Emit tree started event
    this.emit({ type: 'tree_started', data: { seed: root } });

    // Expand tree level by level
    try {
      await this.expandTree(seed);

      // Emit tree completed event
      const duration = Date.now() - this.startTime;
      this.emit({
        type: 'tree_completed',
        data: { totalNodes: this.state.totalNodes, duration }
      });
    } catch (error) {
      this.emit({
        type: 'error',
        data: { message: error instanceof Error ? error.message : 'Unknown error' }
      });
      throw error;
    }

    this.state.isGenerating = false;
    return root;
  }

  private emit(event: TreeStreamEvent): void {
    if (this.onEvent) {
      this.onEvent(event);
    }
  }

  private async expandTree(seed: SeedInput): Promise<void> {
    let currentDepth = 0;

    while (currentDepth < this.maxDepth && this.state.processingQueue.length > 0) {
      // Get all nodes at current depth
      const nodesAtDepth = this.state.processingQueue.filter(nodeId => {
        const node = this.state.nodeMap.get(nodeId);
        return node && node.depth === currentDepth;
      });

      if (nodesAtDepth.length === 0) {
        currentDepth++;
        continue;
      }

      console.log(
        `Processing depth ${currentDepth} with ${nodesAtDepth.length} nodes`
      );

      // Process nodes in batches of maxConcurrent
      for (let i = 0; i < nodesAtDepth.length; i += this.maxConcurrent) {
        const batch = nodesAtDepth.slice(i, i + this.maxConcurrent);

        await Promise.all(
          batch.map(async nodeId => {
            const node = this.state.nodeMap.get(nodeId);
            if (!node) return;

            try {
              // Emit node processing event
              this.emit({
                type: 'node_processing',
                data: { nodeId: node.id, depth: node.depth, event: node.event }
              });

              // Process node to generate children (pass nodeMap for path context)
              const children = await processNode(node, seed, this.state.nodeMap);

              // Add children to tree
              node.children = children;
              node.processingStatus = 'completed';

              children.forEach(child => {
                this.state.nodeMap.set(child.id, child);
                if (child.depth < this.maxDepth) {
                  this.state.processingQueue.push(child.id);
                }
                this.state.totalNodes++;
              });

              // Remove from queue
              this.state.processingQueue = this.state.processingQueue.filter(
                id => id !== nodeId
              );
              this.state.completedNodes.add(nodeId);

              // Emit node completed event with children
              this.emit({
                type: 'node_completed',
                data: { node, children }
              });

              console.log(
                `Completed node at depth ${node.depth}: ${node.event.substring(0, 50)}...`
              );
            } catch (error) {
              console.error(`Failed to process node ${nodeId}:`, error);
              node.processingStatus = 'failed';

              // Emit error event
              this.emit({
                type: 'error',
                data: {
                  message: error instanceof Error ? error.message : 'Node processing failed',
                  nodeId: node.id
                }
              });
            }
          })
        );
      }

      // Emit depth completed event
      this.emit({
        type: 'depth_completed',
        data: { depth: currentDepth, nodesProcessed: nodesAtDepth.length }
      });

      currentDepth++;
    }

    console.log(
      `Tree generation complete. Total nodes: ${this.state.totalNodes}`
    );
  }

  getState(): TreeState {
    return { ...this.state };
  }

  getNode(id: string): EventNode | undefined {
    return this.state.nodeMap.get(id);
  }
}
