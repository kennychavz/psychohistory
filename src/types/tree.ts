/**
 * Core data structures for the PsychoHistory probability tree
 */

export interface EventNode {
  id: string;
  event: string;
  probability: number; // 0-1, must sum to 1.0 with siblings
  justification: string;
  sentiment: number; // -100 to 100
  depth: number; // 0-3
  sources: Source[];
  children: EventNode[];
  parentId: string | null;
  createdAt: Date;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  iconUrl?: string;
}

export interface Source {
  url: string;
  title: string;
  snippet: string;
  relevanceScore?: number;
}

export interface ResearchContext {
  queries: string[];
  results: ResearchResult[];
  timestamp: Date;
}

export interface ResearchResult {
  query: string;
  sources: Source[];
  summary: string;
}

export interface ProbabilityOutput {
  event: string;
  probability: number;
  justification: string;
  sentiment: number;
}

export interface TreeState {
  root: EventNode | null;
  nodeMap: Map<string, EventNode>; // Fast lookup by ID
  processingQueue: string[]; // Node IDs to process
  completedNodes: Set<string>;
  totalNodes: number;
  maxDepth: number;
  maxConcurrent: number;
  isGenerating: boolean;
}

export interface SeedInput {
  event: string;
  context?: string;
  timeframe?: string; // e.g., "next 6 months"
  maxDepth?: number;
  domain?: 'policy' | 'geopolitics' | 'economics' | 'technology' | 'general';
  // Market analysis fields
  marketUrl?: string;
  shouldTrade?: boolean;
  betAmount?: number;
  confidenceThreshold?: number;
}

export interface NodePosition {
  id: string;
  x: number;
  y: number;
}

export interface LayoutConfig {
  depthSpacing: number;
  childSpacing: number;
  orientation: 'vertical' | 'horizontal' | 'radial';
}

export interface TreeMetrics {
  totalPaths: number;
  mostProbablePath: EventNode[];
  averageSentiment: number;
  sentimentByDepth: number[];
  entropy: number; // Measure of uncertainty
}

// Server-Sent Events types for streaming
export type TreeStreamEvent =
  | { type: 'tree_started'; data: { seed: EventNode } }
  | { type: 'node_processing'; data: { nodeId: string; depth: number; event: string } }
  | { type: 'node_completed'; data: { node: EventNode; children: EventNode[] } }
  | { type: 'depth_completed'; data: { depth: number; nodesProcessed: number } }
  | { type: 'tree_completed'; data: { totalNodes: number; duration: number } }
  | { type: 'error'; data: { message: string; nodeId?: string } };

export interface StreamingTreeBuilder {
  buildTree: (seed: SeedInput, onEvent: (event: TreeStreamEvent) => void) => Promise<EventNode>;
}
