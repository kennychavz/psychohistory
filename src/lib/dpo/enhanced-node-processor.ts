/**
 * Enhanced Node Processor for DPO Data Collection
 *
 * Extension of the standard node processor that returns research data
 * alongside generated children. This is needed for DPO preprocessing.
 */

import { EventNode, SeedInput } from '@/types/tree';
import { conductAgenticResearch } from '../research/agentic-researcher';
import { analyzeProbabilities } from '../llm/probability-analyzer';
import { v4 as uuidv4 } from 'uuid';

/**
 * Extended result including research data
 */
export interface EnhancedProcessResult {
  children: EventNode[];
  researchData: {
    summary: string;
    queries: string[];
    sources: any[];
    confidence: string;
    iterations: number;
  };
  probabilityData: {
    model: string;
    temperature: number;
    timestamp: Date;
  };
}

/**
 * Process node and return research data for DPO collection
 */
export async function processNodeWithResearch(
  node: EventNode,
  seed: SeedInput
): Promise<EnhancedProcessResult> {
  console.log(`Processing node for DPO: ${node.event.substring(0, 60)}...`);

  node.processingStatus = 'processing';

  // PHASE 1: Agentic Research
  const researchResult = await conductAgenticResearch(
    node.event,
    seed.context,
    node.depth
  );

  console.log(
    `[Phase 1] Research complete: ${researchResult.sources.length} sources, ` +
    `${researchResult.iterations} iterations, confidence: ${researchResult.confidence}`
  );

  // PHASE 2: Probability Synthesis
  const researchText = formatResearchForR1(researchResult);

  const probabilities = await analyzeProbabilities(
    node.event,
    node.depth,
    researchText,
    seed.timeframe,
    node.depth // Parent depth
  );

  console.log(`[Phase 2] Generated ${probabilities.length} probability outcomes`);

  // Create child nodes
  const children: EventNode[] = probabilities.map(prob => ({
    id: uuidv4(),
    event: prob.event,
    probability: prob.probability,
    justification: prob.justification,
    sentiment: prob.sentiment,
    depth: node.depth + 1,
    sources: researchResult.sources.slice(0, 5),
    children: [],
    parentId: node.id,
    createdAt: new Date(),
    processingStatus: 'pending',
    iconUrl: prob.iconUrl,
  }));

  // Return enhanced result with research data
  return {
    children,
    researchData: {
      summary: researchResult.summary,
      queries: researchResult.queries,
      sources: researchResult.sources,
      confidence: researchResult.confidence,
      iterations: researchResult.iterations,
    },
    probabilityData: {
      model: 'deepseek/deepseek-r1',
      temperature: 0.6,
      timestamp: new Date(),
    },
  };
}

/**
 * Batch process nodes with research data collection
 */
export async function batchProcessWithResearch(
  nodes: EventNode[],
  seed: SeedInput,
  maxConcurrent: number = 5
): Promise<Map<string, EnhancedProcessResult>> {
  const results = new Map<string, EnhancedProcessResult>();

  // Process in batches
  for (let i = 0; i < nodes.length; i += maxConcurrent) {
    const batch = nodes.slice(i, i + maxConcurrent);

    console.log(
      `Processing batch ${Math.floor(i / maxConcurrent) + 1}/${Math.ceil(nodes.length / maxConcurrent)}`
    );

    const batchResults = await Promise.all(
      batch.map(async node => {
        try {
          const result = await processNodeWithResearch(node, seed);
          return { nodeId: node.id, result };
        } catch (error) {
          console.error(`Error processing node ${node.id}:`, error);
          return null;
        }
      })
    );

    // Add to results map
    batchResults.forEach(item => {
      if (item) {
        results.set(item.nodeId, item.result);
      }
    });

    // Rate limiting between batches
    if (i + maxConcurrent < nodes.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return results;
}

/**
 * Format research for R1 synthesis (copied from node-processor)
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
 * Convert enhanced result to DPO-ready format
 */
export function toDPOFormat(
  node: EventNode,
  result: EnhancedProcessResult,
  nodeMap: Map<string, EventNode>,
  timeframe?: string
) {
  // Import here to avoid circular dependency
  const { nodeToDPOInput } = require('./dpo-preprocessor');

  return nodeToDPOInput(
    node,
    nodeMap,
    {
      summary: result.researchData.summary,
      queries: result.researchData.queries,
    },
    timeframe
  );
}
