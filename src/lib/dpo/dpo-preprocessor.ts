/**
 * DPO (Direct Preference Optimization) Preprocessing Module
 *
 * Converts PsychoHistory tree data into training examples for RL fine-tuning.
 * Includes full tree history, path context, and preference pairs.
 */

import { EventNode, Source, ProbabilityOutput } from '@/types/tree';

/**
 * Input context including tree history
 *
 * WHY WE TRANSFORM REFERENCES:
 * - EventNode has circular refs (parent ↔ child) → can't serialize to JSON
 * - Model needs TEXT context, not object pointers
 * - We extract the MEANING of parent/children relationships
 */
export interface DPOInput {
  // Current node being processed
  parentEvent: string;
  depth: number;
  timeframe?: string;

  // PARENT CONTEXT: Path from root to current node (tree history)
  // This IS the parent chain, traversed and flattened
  pathFromRoot: PathNode[];

  // Cumulative probability (product of all probabilities in path)
  cumulativeProbability: number;

  // SIBLING CONTEXT: Other branches at same level
  // These are the current node's siblings (parent's other children)
  siblings: SiblingNode[];

  // CHILDREN CONTEXT: What has already been predicted below this node
  // Helps model understand what outcomes are already explored
  existingChildren?: ChildNode[];

  // Research findings for this node
  researchSummary: string;
  sources: Source[];
  queriesExecuted: string[];

  // Parent node context
  parentSentiment: number;
  parentJustification: string;
  categoryContext?: string;
}

/**
 * Node in the path from root
 */
export interface PathNode {
  event: string;
  probability: number;
  sentiment: number;
  depth: number;
  justification: string;
}

/**
 * Sibling node context
 */
export interface SiblingNode {
  event: string;
  probability: number;
  sentiment: number;
}

/**
 * Child node context (what's already been explored below)
 */
export interface ChildNode {
  event: string;
  probability: number;
  sentiment: number;
  depth: number;
  numDescendants: number; // How many nodes below this child
}

/**
 * Complete DPO training example
 */
export interface DPOExample {
  id: string;
  input: DPOInput;
  chosen: DPOOutput;
  rejected: DPOOutput;
  metadata: DPOMetadata;
}

/**
 * Model output (chosen or rejected)
 */
export interface DPOOutput {
  outcomes: ProbabilityOutput[];
  reasoning?: string; // R1 reasoning trace
  modelInfo: {
    model: string;
    temperature: number;
    timestamp: Date;
  };
}

/**
 * Metadata for filtering and analysis
 */
export interface DPOMetadata {
  timestamp: Date;
  treeId: string;
  nodeId: string;

  // Ground truth (if available later)
  actualOutcome?: {
    event: string;
    timeOccurred: Date;
  };

  // Human feedback
  humanRating?: number; // 1-5
  humanComments?: string;

  // Quality metrics
  metrics?: {
    probabilityCalibration?: number; // 0-1
    diversityScore?: number; // 0-1
    citationQuality?: number; // 0-1
  };
}

/**
 * Build tree history for a given node
 */
export function buildTreeHistory(
  node: EventNode,
  nodeMap: Map<string, EventNode>
): PathNode[] {
  const path: PathNode[] = [];
  let current: EventNode | undefined = node;

  // Traverse from current node to root
  while (current) {
    path.unshift({
      event: current.event,
      probability: current.probability,
      sentiment: current.sentiment,
      depth: current.depth,
      justification: current.justification,
    });

    // Move to parent
    current = current.parentId ? nodeMap.get(current.parentId) : undefined;
  }

  return path;
}

/**
 * Calculate cumulative probability along path
 */
export function calculateCumulativeProbability(path: PathNode[]): number {
  return path.reduce((acc, node) => acc * node.probability, 1.0);
}

/**
 * Extract sibling context
 * WHY: Shows model what OTHER branches exist at this level
 *      Helps ensure diversity (don't duplicate what siblings cover)
 */
export function extractSiblings(
  node: EventNode,
  nodeMap: Map<string, EventNode>
): SiblingNode[] {
  if (!node.parentId) return [];

  const parent = nodeMap.get(node.parentId);
  if (!parent) return [];

  return parent.children
    .filter(child => child.id !== node.id)
    .map(child => ({
      event: child.event,
      probability: child.probability,
      sentiment: child.sentiment,
    }));
}

/**
 * Extract children context (what's already been predicted below this node)
 * WHY: Shows model what outcomes are already explored
 *      Helps when regenerating or refining a subtree
 */
export function extractChildren(node: EventNode): ChildNode[] {
  if (!node.children || node.children.length === 0) return [];

  return node.children.map(child => ({
    event: child.event,
    probability: child.probability,
    sentiment: child.sentiment,
    depth: child.depth,
    numDescendants: countDescendants(child),
  }));
}

/**
 * Count total descendants of a node (children + grandchildren + ...)
 */
function countDescendants(node: EventNode): number {
  if (!node.children || node.children.length === 0) return 0;

  return node.children.reduce(
    (total, child) => total + 1 + countDescendants(child),
    0
  );
}

/**
 * Convert tree node to DPO input format
 *
 * TRANSFORMS OBJECT REFERENCES TO CONTEXT:
 * - node.parent → pathFromRoot (traversed upward)
 * - parent.children → siblings (lateral context)
 * - node.children → existingChildren (downward context)
 */
export function nodeToDPOInput(
  node: EventNode,
  nodeMap: Map<string, EventNode>,
  researchData: {
    summary: string;
    queries: string[];
  },
  timeframe?: string,
  includeChildren: boolean = true // Option to include/exclude children
): DPOInput {
  const pathFromRoot = buildTreeHistory(node, nodeMap);
  const cumulativeProbability = calculateCumulativeProbability(pathFromRoot);
  const siblings = extractSiblings(node, nodeMap);
  const existingChildren = includeChildren ? extractChildren(node) : undefined;

  return {
    parentEvent: node.event,
    depth: node.depth,
    timeframe,
    pathFromRoot,
    cumulativeProbability,
    siblings,
    existingChildren, // ← NOW INCLUDING CHILDREN!
    researchSummary: researchData.summary,
    sources: node.sources,
    queriesExecuted: researchData.queries,
    parentSentiment: node.sentiment,
    parentJustification: node.justification,
    categoryContext: node.categoryContext,
  };
}

/**
 * Create a DPO example from two model outputs
 *
 * @param input - The input context
 * @param chosenOutput - The preferred output (better quality)
 * @param rejectedOutput - The less preferred output
 * @param metadata - Additional metadata
 */
export function createDPOExample(
  input: DPOInput,
  chosenOutput: DPOOutput,
  rejectedOutput: DPOOutput,
  metadata: Omit<DPOMetadata, 'timestamp'>
): DPOExample {
  return {
    id: `${metadata.treeId}_${metadata.nodeId}_${Date.now()}`,
    input,
    chosen: chosenOutput,
    rejected: rejectedOutput,
    metadata: {
      ...metadata,
      timestamp: new Date(),
    },
  };
}

/**
 * Format DPO input as a prompt string for the model
 */
export function formatDPOPrompt(input: DPOInput): string {
  const pathSummary = input.pathFromRoot
    .map((node, i) => {
      const indent = '  '.repeat(i);
      return `${indent}[Depth ${node.depth}] ${node.event} (p=${node.probability.toFixed(2)}, sentiment=${node.sentiment})`;
    })
    .join('\n');

  const siblingsSummary = input.siblings.length > 0
    ? input.siblings
        .map(s => `  - ${s.event} (p=${s.probability.toFixed(2)}, sentiment=${s.sentiment})`)
        .join('\n')
    : '  (No siblings - this is a root node)';

  const childrenSummary = input.existingChildren && input.existingChildren.length > 0
    ? input.existingChildren
        .map(c => `  - ${c.event} (p=${c.probability.toFixed(2)}, sentiment=${c.sentiment}, ${c.numDescendants} descendants)`)
        .join('\n')
    : '  (No children yet - this is a leaf node)';

  return `# Probability Tree Analysis Task

## Tree Path History (Root to Current Node)
${pathSummary}

Cumulative Probability of This Path: ${input.cumulativeProbability.toFixed(4)}

## Sibling Branches at Current Level
${siblingsSummary}

## Existing Children (Already Explored Below This Node)
${childrenSummary}

## Current Node Details
Event: ${input.parentEvent}
Depth: ${input.depth}/5
Timeframe: ${input.timeframe || 'Next significant development'}
Sentiment: ${input.parentSentiment}
Category: ${input.categoryContext || 'General'}

## Research Context
Queries Executed:
${input.queriesExecuted.map((q, i) => `  ${i + 1}. ${q}`).join('\n')}

Research Summary:
${input.researchSummary}

Sources (${input.sources.length} total):
${input.sources.slice(0, 5).map((s, i) => `  ${i + 1}. ${s.title}\n     ${s.snippet}`).join('\n\n')}

## Task
Based on the tree history, research findings, sibling context, and existing children above, predict 1-5 possible next events.

Requirements:
- Probabilities must sum to 1.0
- Justify each prediction using research evidence
- Assign sentiment from -100 to 100
- Make events specific and measurable
- Consider the cumulative path context and how it constrains future outcomes
- Avoid duplicating what siblings already cover
- If regenerating, consider improving on existing children

Output format:
[
  {
    "event": "Specific, measurable outcome",
    "probability": 0.35,
    "justification": "Evidence from research...",
    "sentiment": 25
  }
]
`;
}

/**
 * Export DPO examples to JSONL format (standard for training)
 */
export function exportToJSONL(examples: DPOExample[]): string {
  return examples
    .map(example => {
      // Convert to standard DPO format
      const standardFormat = {
        prompt: formatDPOPrompt(example.input),
        chosen: JSON.stringify(example.chosen.outcomes),
        rejected: JSON.stringify(example.rejected.outcomes),
        metadata: example.metadata,
      };
      return JSON.stringify(standardFormat);
    })
    .join('\n');
}

/**
 * Quality metrics for ranking outputs
 */
export function calculateOutputQuality(
  output: ProbabilityOutput[],
  input: DPOInput
): number {
  let score = 0;

  // 1. Probability calibration (sum to 1.0)
  const probSum = output.reduce((acc, o) => acc + o.probability, 0);
  const calibrationScore = 1 - Math.abs(probSum - 1.0);
  score += calibrationScore * 0.3;

  // 2. Diversity (different events)
  const uniqueEvents = new Set(output.map(o => o.event)).size;
  const diversityScore = uniqueEvents / output.length;
  score += diversityScore * 0.2;

  // 3. Justification quality (length and research citations)
  const avgJustificationLength = output.reduce(
    (acc, o) => acc + o.justification.length,
    0
  ) / output.length;
  const justificationScore = Math.min(avgJustificationLength / 200, 1.0);
  score += justificationScore * 0.25;

  // 4. Specificity (avoid vague predictions)
  const specificityScore = output.reduce((acc, o) => {
    const hasNumbers = /\d+/.test(o.event);
    const hasSpecificTerms = /\b(will|by|within|reaches|increases|decreases)\b/i.test(o.event);
    return acc + (hasNumbers || hasSpecificTerms ? 1 : 0);
  }, 0) / output.length;
  score += specificityScore * 0.25;

  return score;
}
