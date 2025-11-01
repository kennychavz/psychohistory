/**
 * Find most probable path through the tree
 */

import { EventNode } from '@/types/tree';

export interface ProbablePath {
  nodes: EventNode[];
  cumulativeProbability: number;
  pathIds: Set<string>;
  edgeIds: Set<string>;
}

/**
 * Find the most probable path from root to deepest leaf
 * Greedy algorithm: at each level, choose child with highest probability
 */
export function findMostProbablePath(root: EventNode): ProbablePath {
  const path: EventNode[] = [root];
  let cumulativeProbability = 1.0;
  let current = root;

  // Follow highest probability child at each level
  while (current.children.length > 0) {
    // Find child with maximum probability
    const maxChild = current.children.reduce((max, child) =>
      child.probability > max.probability ? child : max
    );

    path.push(maxChild);
    cumulativeProbability *= maxChild.probability;
    current = maxChild;
  }

  // Create sets for quick lookup
  const pathIds = new Set(path.map(n => n.id));
  const edgeIds = new Set<string>();

  // Build edge IDs
  for (let i = 0; i < path.length - 1; i++) {
    edgeIds.add(`${path[i].id}-${path[i + 1].id}`);
  }

  return {
    nodes: path,
    cumulativeProbability,
    pathIds,
    edgeIds,
  };
}

/**
 * Find all paths from root to leaves
 */
export function findAllPaths(root: EventNode): ProbablePath[] {
  const paths: ProbablePath[] = [];

  function traverse(node: EventNode, currentPath: EventNode[], cumProb: number) {
    const newPath = [...currentPath, node];
    const newProb = cumProb * node.probability;

    if (node.children.length === 0) {
      // Leaf node - complete path
      const pathIds = new Set(newPath.map(n => n.id));
      const edgeIds = new Set<string>();

      for (let i = 0; i < newPath.length - 1; i++) {
        edgeIds.add(`${newPath[i].id}-${newPath[i + 1].id}`);
      }

      paths.push({
        nodes: newPath,
        cumulativeProbability: newProb,
        pathIds,
        edgeIds,
      });
    } else {
      // Continue to children
      node.children.forEach(child => {
        traverse(child, newPath, newProb);
      });
    }
  }

  traverse(root, [], 1.0);
  return paths;
}

/**
 * Find top N most probable paths
 */
export function findTopNPaths(root: EventNode, n: number): ProbablePath[] {
  const allPaths = findAllPaths(root);
  return allPaths
    .sort((a, b) => b.cumulativeProbability - a.cumulativeProbability)
    .slice(0, n);
}

/**
 * Check if a node is on the most probable path
 */
export function isOnMostProbablePath(nodeId: string, mostProbablePath: ProbablePath): boolean {
  return mostProbablePath.pathIds.has(nodeId);
}

/**
 * Check if an edge is on the most probable path
 */
export function isEdgeOnMostProbablePath(edgeId: string, mostProbablePath: ProbablePath): boolean {
  return mostProbablePath.edgeIds.has(edgeId);
}
