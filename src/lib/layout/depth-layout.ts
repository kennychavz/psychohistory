/**
 * Depth-aware hierarchical layout algorithm for React Flow
 */

import { EventNode, NodePosition, LayoutConfig } from '@/types/tree';
import { Node, Edge } from 'reactflow';
import { getEdgeWidth, getEdgeColor } from '../d3/color-scales';
import { ProbablePath } from '../tree/path-finder';

export function calculateTreeLayout(
  root: EventNode,
  config: LayoutConfig = {
    depthSpacing: 300,
    childSpacing: 200,
    orientation: 'vertical',
  },
  mostProbablePath?: ProbablePath,
  cumulativeProbabilities?: Map<string, number>
): { nodes: Node[]; edges: Edge[] } {
  const positions: NodePosition[] = [];
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // First pass: calculate positions
  if (config.orientation === 'radial') {
    layoutRadial(root, config, positions);
  } else {
    layoutNode(root, 0, 0, config, positions);
  }

  // Second pass: create React Flow nodes and edges
  positions.forEach(pos => {
    const eventNode = findNodeById(root, pos.id);
    if (!eventNode) return;

    const isOnPath = mostProbablePath?.pathIds.has(pos.id) || false;

    // Use cumulative probability if provided, otherwise use conditional probability
    const displayProbability = cumulativeProbabilities?.get(pos.id) ?? eventNode.probability;

    nodes.push({
      id: pos.id,
      type: eventNode.depth === 0 ? 'seed' : 'event',
      position: { x: pos.x, y: pos.y },
      data: {
        event: eventNode.event,
        probability: displayProbability,
        sentiment: eventNode.sentiment,
        depth: eventNode.depth,
        justification: eventNode.justification,
        sources: eventNode.sources,
        processingStatus: eventNode.processingStatus,
        isOnMostProbablePath: isOnPath,
        iconUrl: eventNode.iconUrl,
      },
    });

    // Create edge to parent with D3-enhanced styling
    if (eventNode.parentId) {
      const edgeId = `${eventNode.parentId}-${pos.id}`;
      const isEdgeOnPath = mostProbablePath?.edgeIds.has(edgeId) || false;

      const edgeWidth = getEdgeWidth(eventNode.probability);
      const edgeColor = getEdgeColor(eventNode.probability, eventNode.sentiment);

      edges.push({
        id: edgeId,
        source: eventNode.parentId,
        target: pos.id,
        type: 'probability',
        data: {
          probability: eventNode.probability,
          sentiment: eventNode.sentiment,
          isOnMostProbablePath: isEdgeOnPath,
        },
        animated: isEdgeOnPath, // Animate edges on most probable path
        style: {
          strokeWidth: isEdgeOnPath ? edgeWidth * 1.5 : edgeWidth,
          stroke: edgeColor,
        },
      });
    }
  });

  return { nodes, edges };
}

function layoutNode(
  node: EventNode,
  depth: number,
  xOffset: number,
  config: LayoutConfig,
  positions: NodePosition[]
): number {
  const { depthSpacing, childSpacing, orientation } = config;

  if (orientation === 'vertical') {
    // Vertical layout: depth increases downward (Y-axis)
    const y = depth * depthSpacing;

    if (node.children.length === 0) {
      // Leaf node
      positions.push({ id: node.id, x: xOffset, y });
      return childSpacing;
    }

    // Calculate total width needed for children
    let totalWidth = 0;
    const childWidths: number[] = [];

    node.children.forEach(child => {
      const width = layoutNode(
        child,
        depth + 1,
        xOffset + totalWidth,
        config,
        positions
      );
      childWidths.push(width);
      totalWidth += width;
    });

    // Position parent at center of children
    const firstChildPos = positions.find(p => p.id === node.children[0].id);
    const lastChildPos = positions.find(
      p => p.id === node.children[node.children.length - 1].id
    );

    if (firstChildPos && lastChildPos) {
      const centerX = (firstChildPos.x + lastChildPos.x) / 2;
      positions.push({ id: node.id, x: centerX, y });
    } else {
      positions.push({ id: node.id, x: xOffset + totalWidth / 2, y });
    }

    return totalWidth;
  } else {
    // Horizontal layout: depth increases rightward (X-axis)
    const x = depth * depthSpacing;

    if (node.children.length === 0) {
      positions.push({ id: node.id, x, y: xOffset });
      return childSpacing;
    }

    let totalHeight = 0;
    node.children.forEach(child => {
      const height = layoutNode(
        child,
        depth + 1,
        xOffset + totalHeight,
        config,
        positions
      );
      totalHeight += height;
    });

    const firstChildPos = positions.find(p => p.id === node.children[0].id);
    const lastChildPos = positions.find(
      p => p.id === node.children[node.children.length - 1].id
    );

    if (firstChildPos && lastChildPos) {
      const centerY = (firstChildPos.y + lastChildPos.y) / 2;
      positions.push({ id: node.id, x, y: centerY });
    } else {
      positions.push({ id: node.id, x, y: xOffset + totalHeight / 2 });
    }

    return totalHeight;
  }
}

function layoutRadial(
  root: EventNode,
  config: LayoutConfig,
  positions: NodePosition[]
): void {
  const { depthSpacing } = config;

  interface NodeWithAngle {
    node: EventNode;
    depth: number;
    startAngle: number;
    endAngle: number;
  }

  const queue: NodeWithAngle[] = [{
    node: root,
    depth: 0,
    startAngle: 0,
    endAngle: 2 * Math.PI
  }];

  while (queue.length > 0) {
    const { node, depth, startAngle, endAngle } = queue.shift()!;

    const radius = depth * depthSpacing;
    const angle = (startAngle + endAngle) / 2;

    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);

    positions.push({ id: node.id, x, y });

    if (node.children.length > 0) {
      const angleRange = endAngle - startAngle;
      const anglePerChild = angleRange / node.children.length;

      node.children.forEach((child, i) => {
        const childStartAngle = startAngle + i * anglePerChild;
        const childEndAngle = childStartAngle + anglePerChild;

        queue.push({
          node: child,
          depth: depth + 1,
          startAngle: childStartAngle,
          endAngle: childEndAngle,
        });
      });
    }
  }
}

function findNodeById(root: EventNode, id: string): EventNode | null {
  if (root.id === id) return root;

  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }

  return null;
}

// Legacy color functions (kept for backwards compatibility)
function getProbabilityColor(probability: number): string {
  // Green for high probability, yellow for medium, red for low
  if (probability > 0.5) return '#22c55e'; // green-500
  if (probability > 0.2) return '#eab308'; // yellow-500
  return '#ef4444'; // red-500
}

// Note: getSentimentColor now imported from d3/color-scales.ts
// Keeping this export for backwards compatibility
export { getSentimentColor } from '../d3/color-scales';

// Find most probable path from root to leaf
export function findMostProbablePath(root: EventNode): EventNode[] {
  const path: EventNode[] = [root];
  let current = root;

  while (current.children.length > 0) {
    // Find child with highest probability
    const maxChild = current.children.reduce((max, child) =>
      child.probability > max.probability ? child : max
    );
    path.push(maxChild);
    current = maxChild;
  }

  return path;
}

// Calculate cumulative probability along a path
export function calculatePathProbability(path: EventNode[]): number {
  return path.reduce((acc, node) => acc * node.probability, 1.0);
}
