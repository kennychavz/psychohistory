/**
 * Process individual nodes: research → probability generation
 * Uses DeepSeek V3.1 for agentic research, DeepSeek R1 for synthesis
 */

import { v4 as uuidv4 } from 'uuid';
import { EventNode, SeedInput } from '@/types/tree';
import { analyzeProbabilities } from '../llm/probability-analyzer';
import { conductAgenticResearch } from '../research/agentic-researcher';
import { nodeDebugLogger } from '../logging/node-debug-logger';

export async function processNode(
  node: EventNode,
  seed: SeedInput,
  nodeMap?: Map<string, EventNode>
): Promise<EventNode[]> {
  // Start debug logging if enabled
  if (nodeDebugLogger.isEnabled()) {
    nodeDebugLogger.startNode(node.id, node.event, node.depth);
  } else {
    console.log(`Processing node: ${node.event.substring(0, 60)}...`);
  }

  node.processingStatus = 'processing';

  try {
    // Phase 1: Agentic Research (DeepSeek V3.1 with tool calling)
    const phase1Start = Date.now();

    if (nodeDebugLogger.isEnabled()) {
      nodeDebugLogger.startPhase1('deepseek/deepseek-chat', node.event);
    } else {
      console.log('[Phase 1] Starting agentic research with V3.1...');
    }

    const path = buildPath(node, nodeMap);

    const researchResult = await conductAgenticResearch(
      node.event,
      seed.context,
      node.depth,
      path,
      seed.event
    );

    if (nodeDebugLogger.isEnabled()) {
      nodeDebugLogger.endPhase1(
        researchResult.sources.length,
        researchResult.summary,
        researchResult.confidence,
        Date.now() - phase1Start
      );
    } else {
      console.log(
        `[Phase 1] Research complete: ${researchResult.sources.length} sources, ` +
        `${researchResult.iterations} iterations, confidence: ${researchResult.confidence}`
      );
    }

    if (researchResult.sources.length === 0) {
      console.warn('[Phase 1] No research results found, generating fallback outcomes');
      return generateFallbackChildren(node);
    }

    // Format research for R1 analysis
    const researchText = formatResearchForR1(researchResult);

    // Phase 2: Probability Synthesis (DeepSeek R1 reasoning)
    const phase2Start = Date.now();

    if (nodeDebugLogger.isEnabled()) {
      nodeDebugLogger.startPhase2('deepseek/deepseek-r1');
    } else {
      console.log('[Phase 2] Synthesizing probabilities with R1...');
    }

    const probabilities = await analyzeProbabilities(
      node.event,
      node.depth,
      researchText,
      seed.timeframe,
      path,
      seed.event
    );

    if (nodeDebugLogger.isEnabled()) {
      nodeDebugLogger.endPhase2(
        researchText,
        probabilities, // Full response
        probabilities,
        Date.now() - phase2Start
      );
    } else {
      console.log(`[Phase 2] Generated ${probabilities.length} probability outcomes`);
    }

    // Create child nodes
    const children: EventNode[] = probabilities.map(prob => ({
      id: uuidv4(),
      event: prob.event,
      probability: prob.probability,
      justification: 'Based on historical research and analysis', // Default
      sentiment: 0, // Default neutral
      depth: node.depth + 1,
      sources: researchResult.sources.slice(0, 5), // Top 5 sources
      children: [],
      parentId: node.id,
      createdAt: new Date(),
      processingStatus: 'pending',
    }));

    console.log(`Generated ${children.length} children for node at depth ${node.depth}`);

    // End debug logging
    if (nodeDebugLogger.isEnabled()) {
      await nodeDebugLogger.endNode(children.length);
    }

    return children;
  } catch (error) {
    console.error('Node processing failed:', error);

    // End debug logging on error
    if (nodeDebugLogger.isEnabled()) {
      await nodeDebugLogger.endNode(0);
    }

    return generateFallbackChildren(node);
  }
}

/**
 * Format agentic research results for DeepSeek R1 synthesis
 */
function formatResearchForR1(research: {
  sources: any[];
  summary: string;
  confidence: string;
  queries: string[];
}): string {
  if (research.sources.length === 0) {
    return 'No research findings available.';
  }

  const sourcesText = research.sources
    .map((source, i) => {
      return `Source ${i + 1}: ${source.title}\nURL: ${source.url}\n${source.snippet}`;
    })
    .join('\n\n---\n\n');

  return `Research Summary (${research.confidence} confidence):
${research.summary}

Queries Executed:
${research.queries.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Sources:
${sourcesText}`;
}

/**
 * Build path from root to this node
 */
function buildPath(node: EventNode, nodeMap?: Map<string, EventNode>): string[] {
  if (!nodeMap) {
    return [node.event];
  }

  const path: string[] = [];
  let current: EventNode | undefined = node;

  while (current) {
    path.unshift(current.event);
    current = current.parentId ? nodeMap.get(current.parentId) : undefined;
  }

  return path;
}

function generateFallbackChildren(node: EventNode): EventNode[] {
  // Fallback when research/LLM fails
  return [
    {
      id: uuidv4(),
      event: `Status quo continues from: ${node.event.substring(0, 50)}`,
      probability: 0.5,
      justification: 'No significant change detected',
      sentiment: 0,
      depth: node.depth + 1,
      sources: [],
      children: [],
      parentId: node.id,
      createdAt: new Date(),
      processingStatus: 'pending',
    },
    {
      id: uuidv4(),
      event: `Unexpected development from: ${node.event.substring(0, 50)}`,
      probability: 0.5,
      justification: 'Insufficient data for detailed prediction',
      sentiment: -10,
      depth: node.depth + 1,
      sources: [],
      children: [],
      parentId: node.id,
      createdAt: new Date(),
      processingStatus: 'pending',
    },
  ];
}
