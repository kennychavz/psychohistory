/**
 * Zustand store for incremental tree state management
 * Handles real-time updates as nodes are generated
 */

import { create } from 'zustand';
import { EventNode } from '@/types/tree';

interface TreeStore {
  // Tree state
  root: EventNode | null;
  nodeMap: Map<string, EventNode>;

  // Generation state
  isGenerating: boolean;
  currentDepth: number;
  totalNodes: number;
  completedNodes: number;

  // Error state
  error: string | null;

  // Actions
  reset: () => void;
  startGeneration: (seed: EventNode) => void;
  addNode: (node: EventNode, parentId: string | null) => void;
  updateNodeStatus: (nodeId: string, status: EventNode['processingStatus']) => void;
  completeGeneration: () => void;
  setError: (error: string) => void;
}

export const useTreeStore = create<TreeStore>((set, get) => ({
  // Initial state
  root: null,
  nodeMap: new Map(),
  isGenerating: false,
  currentDepth: 0,
  totalNodes: 0,
  completedNodes: 0,
  error: null,

  // Reset everything
  reset: () => set({
    root: null,
    nodeMap: new Map(),
    isGenerating: false,
    currentDepth: 0,
    totalNodes: 0,
    completedNodes: 0,
    error: null,
  }),

  // Start generation with seed node
  startGeneration: (seed: EventNode) => {
    set({
      root: seed,
      nodeMap: new Map([[seed.id, seed]]),
      isGenerating: true,
      currentDepth: 0,
      totalNodes: 1,
      completedNodes: 0,
      error: null,
    });
  },

  // Add a new node to the tree
  addNode: (node: EventNode, parentId: string | null) => {
    const { nodeMap, root } = get();
    const newMap = new Map(nodeMap);
    newMap.set(node.id, node);

    // If has parent, add to parent's children
    let updatedRoot = root;
    if (parentId && root) {
      updatedRoot = addChildToNode(root, parentId, node);
    }

    set({
      root: updatedRoot,
      nodeMap: newMap,
      totalNodes: newMap.size,
      currentDepth: Math.max(get().currentDepth, node.depth),
    });
  },

  // Update node processing status
  updateNodeStatus: (nodeId: string, status: EventNode['processingStatus']) => {
    const { nodeMap, root } = get();
    const node = nodeMap.get(nodeId);

    if (!node) return;

    const updatedNode = { ...node, processingStatus: status };
    const newMap = new Map(nodeMap);
    newMap.set(nodeId, updatedNode);

    const updatedRoot = updateNodeInTree(root, nodeId, updatedNode);

    set({
      nodeMap: newMap,
      root: updatedRoot,
      completedNodes: status === 'completed' ? get().completedNodes + 1 : get().completedNodes,
    });
  },

  // Complete generation
  completeGeneration: () => set({ isGenerating: false }),

  // Set error
  setError: (error: string) => set({ error, isGenerating: false }),
}));

// Helper: Add child to node in tree
function addChildToNode(node: EventNode, parentId: string, child: EventNode): EventNode {
  if (node.id === parentId) {
    return {
      ...node,
      children: [...node.children, child],
    };
  }

  return {
    ...node,
    children: node.children.map(c => addChildToNode(c, parentId, child)),
  };
}

// Helper: Update node in tree
function updateNodeInTree(
  node: EventNode | null,
  nodeId: string,
  updatedNode: EventNode
): EventNode | null {
  if (!node) return null;

  if (node.id === nodeId) {
    return updatedNode;
  }

  return {
    ...node,
    children: node.children.map(c => updateNodeInTree(c, nodeId, updatedNode)!).filter(Boolean),
  };
}
