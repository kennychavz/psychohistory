/**
 * Calculate cumulative (global) probabilities for all nodes in tree
 */

import { EventNode } from '@/types/tree';

/**
 * Calculate cumulative probability for each node
 * Cumulative probability = probability of reaching this node from root
 *
 * Formula: cumulativeProb(node) = cumulativeProb(parent) * conditionalProb(node)
 *
 * All leaf nodes' cumulative probabilities should sum to 1.0 (100%)
 */
export function calculateCumulativeProbabilities(root: EventNode): Map<string, number> {
  const cumulativeProbs = new Map<string, number>();

  function traverse(node: EventNode, parentCumulativeProb: number) {
    // Calculate this node's cumulative probability
    const cumulativeProb = parentCumulativeProb * node.probability;
    cumulativeProbs.set(node.id, cumulativeProb);

    // Recursively calculate for children
    node.children.forEach(child => {
      traverse(child, cumulativeProb);
    });
  }

  // Root node has cumulative probability of 1.0
  traverse(root, 1.0);

  return cumulativeProbs;
}

/**
 * Get all leaf nodes with their cumulative probabilities
 */
export function getLeafProbabilities(root: EventNode): { node: EventNode; cumulativeProb: number }[] {
  const cumulativeProbs = calculateCumulativeProbabilities(root);
  const leaves: { node: EventNode; cumulativeProb: number }[] = [];

  function findLeaves(node: EventNode) {
    if (node.children.length === 0) {
      // Leaf node
      leaves.push({
        node,
        cumulativeProb: cumulativeProbs.get(node.id) || 0,
      });
    } else {
      node.children.forEach(child => findLeaves(child));
    }
  }

  findLeaves(root);
  return leaves;
}

/**
 * Verify that all leaf probabilities sum to 1.0 (with tolerance for floating point errors)
 */
export function verifyProbabilitySum(root: EventNode): { sum: number; isValid: boolean } {
  const leaves = getLeafProbabilities(root);
  const sum = leaves.reduce((acc, leaf) => acc + leaf.cumulativeProb, 0);
  const isValid = Math.abs(sum - 1.0) < 0.001; // Tolerance of 0.1%

  return { sum, isValid };
}
