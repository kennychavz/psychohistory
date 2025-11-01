/**
 * Polymarket SFT Training Data Pipeline
 *
 * Pipeline:
 * 1. Fetch Polymarket events with known outcomes
 * 2. Generate probability tree for each event
 * 3. Extract terminal paths and classify
 * 4. Save SFT training data to JSON
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { EventNode, SeedInput } from '@/types/tree';
import { processNode } from '@/lib/tree/node-processor';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';

// ============================================================================
// Types
// ============================================================================

interface PolymarketEvent {
  id: string;
  question: string;
  outcome: 'YES' | 'NO';
  description?: string;
  category?: string;
}

interface TerminalPath {
  pathId: string;
  nodes: PathNode[];
  cumulativeProbability: number;
  classification: 'YES' | 'NO';
}

interface PathNode {
  event: string;
  probability: number;
  depth: number;
  justification: string;
}

interface SFTExample {
  prompt: string;
  completion: string;
  metadata: {
    eventId: string;
    pathId: string;
    cumulativeProbability: number;
    actualOutcome: string;
    isCorrect: boolean;
  };
}

// ============================================================================
// Step 1: Load Polymarket Events (Real Data)
// ============================================================================

interface EnrichedMarket {
  event: string;
  outcome: string;
  market_slug: string;
  completed_date: string;
  tags: string[];
  volume_total: number;
  winning_side_label: string;
}

async function loadPolymarketEvents(limit: number = 5): Promise<PolymarketEvent[]> {
  // Load real Polymarket data
  const dataPath = './src/data/enriched-market-outcomes.json';

  console.log(`Loading Polymarket events from ${dataPath}...`);

  try {
    const data = await fs.readFile(dataPath, 'utf-8');
    const markets: EnrichedMarket[] = JSON.parse(data);

    console.log(`✓ Loaded ${markets.length} total markets from file`);

    // Filter for binary YES/NO markets and map to our format
    const events: PolymarketEvent[] = markets
      .filter(market => {
        // Only binary outcomes
        const validOutcome = market.outcome === 'Yes' || market.outcome === 'No';
        // Must have the question
        const hasQuestion = market.event && market.event.length > 0;
        return validOutcome && hasQuestion;
      })
      .map(market => ({
        id: market.market_slug,
        question: market.event,
        outcome: market.outcome === 'Yes' ? 'YES' : 'NO',
        description: `Completed on ${market.completed_date}`,
        category: inferCategory(market.tags),
      }))
      .slice(0, limit);

    console.log(`✓ Filtered to ${events.length} binary YES/NO events`);

    return events;
  } catch (error) {
    console.error(`Error loading Polymarket data: ${error}`);
    throw error;
  }
}

function inferCategory(tags: string[]): string {
  const tagLower = tags.map(t => t.toLowerCase());

  if (tagLower.some(t => t.includes('politic') || t.includes('election'))) {
    return 'politics';
  }
  if (tagLower.some(t => t.includes('econom') || t.includes('finance') || t.includes('fed'))) {
    return 'economics';
  }
  if (tagLower.some(t => t.includes('crypto') || t.includes('bitcoin') || t.includes('eth'))) {
    return 'crypto';
  }
  if (tagLower.some(t => t.includes('tech') || t.includes('ai') || t.includes('software'))) {
    return 'technology';
  }
  if (tagLower.some(t => t.includes('geopolit') || t.includes('war') || t.includes('foreign'))) {
    return 'geopolitics';
  }

  return 'general';
}

// ============================================================================
// Step 2: Generate Tree for Event
// ============================================================================

async function generateTreeForEvent(event: PolymarketEvent): Promise<EventNode> {
  console.log(`\n🌲 Generating tree for: ${event.question.substring(0, 60)}...`);

  // Create root node
  const root: EventNode = {
    id: uuidv4(),
    event: event.question,
    probability: 1.0,
    justification: 'Root question from Polymarket',
    sentiment: 0,
    depth: 0,
    sources: [],
    children: [],
    parentId: null,
    createdAt: new Date(),
    processingStatus: 'pending',
    categoryContext: event.category,
  };

  const nodeMap = new Map<string, EventNode>();
  nodeMap.set(root.id, root);

  const seed: SeedInput = {
    event: event.question,
    context: event.description,
    maxDepth: 3,  // Generate 3 levels
    domain: event.category as any || 'general',
  };

  // Process tree breadth-first
  const queue: EventNode[] = [root];

  while (queue.length > 0) {
    const node = queue.shift()!;

    if (node.depth >= (seed.maxDepth || 3)) {
      continue;
    }

    console.log(`  Processing depth ${node.depth}: ${node.event.substring(0, 50)}...`);

    try {
      const children = await processNode(node, seed);
      node.children = children;

      children.forEach(child => {
        nodeMap.set(child.id, child);
        queue.push(child);
      });

      console.log(`  ✓ Generated ${children.length} children`);

      // Rate limiting
      await sleep(1000);
    } catch (error) {
      console.error(`  ✗ Error: ${error}`);
      break;
    }
  }

  return root;
}

// ============================================================================
// Step 3: Extract Terminal Paths
// ============================================================================

function extractTerminalPaths(root: EventNode): TerminalPath[] {
  const paths: TerminalPath[] = [];

  function traverse(node: EventNode, currentPath: PathNode[], cumProb: number) {
    const pathNode: PathNode = {
      event: node.event,
      probability: node.probability,
      depth: node.depth,
      justification: node.justification,
    };

    const newPath = [...currentPath, pathNode];
    const newCumProb = node.depth === 0 ? 1.0 : cumProb * node.probability;

    // Terminal node (leaf or max depth)
    if (!node.children || node.children.length === 0) {
      const classification = inferClassification(node);

      paths.push({
        pathId: `path_${paths.length}`,
        nodes: newPath,
        cumulativeProbability: newCumProb,
        classification,
      });
      return;
    }

    // Recurse on children
    for (const child of node.children) {
      traverse(child, newPath, newCumProb);
    }
  }

  traverse(root, [], 1.0);
  return paths;
}

// ============================================================================
// Step 4: Classify Terminal Nodes
// ============================================================================

function inferClassification(node: EventNode): 'YES' | 'NO' {
  // Simple heuristic based on sentiment and text analysis
  const text = node.event.toLowerCase();
  const justification = node.justification.toLowerCase();

  // Look for strong YES indicators
  if (text.includes('wins') || text.includes('succeeds') ||
      text.includes('passes') || text.includes('approved') ||
      text.includes('increases') && node.sentiment > 20) {
    return 'YES';
  }

  // Look for strong NO indicators
  if (text.includes('loses') || text.includes('fails') ||
      text.includes('rejected') || text.includes('defeated') ||
      text.includes('decreases') && node.sentiment < -20) {
    return 'NO';
  }

  // Check justification
  if (justification.includes('likely to succeed') ||
      justification.includes('favorable outcome')) {
    return 'YES';
  }

  if (justification.includes('unlikely') ||
      justification.includes('unfavorable')) {
    return 'NO';
  }

  // Use sentiment as tiebreaker
  return node.sentiment >= 0 ? 'YES' : 'NO';
}

// ============================================================================
// Step 5: Format as SFT Training Data
// ============================================================================

function formatPathAsSFT(
  path: TerminalPath,
  event: PolymarketEvent
): SFTExample {
  // Format path description
  const pathDescription = path.nodes
    .map((node, i) => {
      if (i === 0) {
        return `Question: ${node.event}`;
      }
      return `[Depth ${node.depth}] ${node.event} (probability: ${node.probability.toFixed(2)})`;
    })
    .join('\n');

  // Get the last node's justification as context
  const lastNode = path.nodes[path.nodes.length - 1];

  const prompt = `# Binary Event Classification

${pathDescription}

Cumulative Path Probability: ${path.cumulativeProbability.toFixed(4)}

Context: ${lastNode.justification}

Task: Based on this scenario path, classify whether the original question resolves to YES or NO.
Output only: YES or NO`;

  const isCorrect = path.classification === event.outcome;

  return {
    prompt,
    completion: path.classification,
    metadata: {
      eventId: event.id,
      pathId: path.pathId,
      cumulativeProbability: path.cumulativeProbability,
      actualOutcome: event.outcome,
      isCorrect,
    },
  };
}

// ============================================================================
// Step 6: Process All Events
// ============================================================================

async function processAllEvents(events: PolymarketEvent[]) {
  const allSFTExamples: SFTExample[] = [];
  const statistics = {
    totalPaths: 0,
    correctPaths: 0,
    incorrectPaths: 0,
    byOutcome: { YES: 0, NO: 0 },
  };

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[${i + 1}/${events.length}] Processing: ${event.question}`);
    console.log(`Actual outcome: ${event.outcome}`);
    console.log(`${'='.repeat(80)}`);

    try {
      // Generate tree
      const tree = await generateTreeForEvent(event);

      // Extract paths
      const paths = extractTerminalPaths(tree);
      console.log(`\n📊 Extracted ${paths.length} terminal paths`);

      // Calculate prediction
      const yesProb = paths
        .filter(p => p.classification === 'YES')
        .reduce((sum, p) => sum + p.cumulativeProbability, 0);
      const noProb = paths
        .filter(p => p.classification === 'NO')
        .reduce((sum, p) => sum + p.cumulativeProbability, 0);

      const prediction = yesProb > noProb ? 'YES' : 'NO';
      console.log(`\nAggregated Prediction:`);
      console.log(`  P(YES) = ${yesProb.toFixed(4)}`);
      console.log(`  P(NO) = ${noProb.toFixed(4)}`);
      console.log(`  Predicted: ${prediction} | Actual: ${event.outcome} ${prediction === event.outcome ? '✓' : '✗'}`);

      // Format as SFT
      const sftExamples = paths.map(path => formatPathAsSFT(path, event));

      // Filter for correct paths only
      const correctExamples = sftExamples.filter(ex => ex.metadata.isCorrect);

      console.log(`\n✓ Correct paths: ${correctExamples.length}/${paths.length} (${(correctExamples.length/paths.length*100).toFixed(1)}%)`);

      allSFTExamples.push(...correctExamples);

      // Update statistics
      statistics.totalPaths += paths.length;
      statistics.correctPaths += correctExamples.length;
      statistics.incorrectPaths += paths.length - correctExamples.length;

    } catch (error) {
      console.error(`\n✗ Error processing event: ${error}`);
    }

    // Rate limiting between events
    await sleep(2000);
  }

  return { examples: allSFTExamples, statistics };
}

// ============================================================================
// Step 7: Save Results
// ============================================================================

async function saveResults(examples: SFTExample[], statistics: any) {
  // Save full dataset as JSONL
  const jsonl = examples.map(ex => JSON.stringify(ex)).join('\n');
  await fs.writeFile('sft_classifier_training.jsonl', jsonl);
  console.log(`\n💾 Saved ${examples.length} examples to sft_classifier_training.jsonl`);

  // Save sample as pretty JSON for review
  const sample = examples.slice(0, 10);
  await fs.writeFile(
    'sft_classifier_training_sample.json',
    JSON.stringify(sample, null, 2)
  );
  console.log(`💾 Saved sample to sft_classifier_training_sample.json`);

  // Save statistics
  const stats = {
    timestamp: new Date().toISOString(),
    totalExamples: examples.length,
    ...statistics,
    accuracy: (statistics.correctPaths / statistics.totalPaths * 100).toFixed(2) + '%',
    byOutcome: examples.reduce((acc, ex) => {
      acc[ex.completion] = (acc[ex.completion] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  await fs.writeFile(
    'sft_classifier_statistics.json',
    JSON.stringify(stats, null, 2)
  );
  console.log(`💾 Saved statistics to sft_classifier_statistics.json`);

  return stats;
}

// ============================================================================
// Main Pipeline
// ============================================================================

async function main() {
  console.log('🚀 Polymarket SFT Training Data Pipeline');
  console.log('==========================================\n');

  // Step 1: Load events
  console.log('📥 Loading Polymarket events...');
  const events = await loadPolymarketEvents(5);
  console.log(`✓ Loaded ${events.length} events\n`);

  // Step 2-6: Process events
  const { examples, statistics } = await processAllEvents(events);

  // Step 7: Save results
  const finalStats = await saveResults(examples, statistics);

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total training examples: ${finalStats.totalExamples}`);
  console.log(`Total paths analyzed: ${finalStats.totalPaths}`);
  console.log(`Correct paths: ${finalStats.correctPaths} (${finalStats.accuracy})`);
  console.log(`\nBy outcome:`);
  Object.entries(finalStats.byOutcome).forEach(([outcome, count]) => {
    console.log(`  ${outcome}: ${count} (${(count as number/finalStats.totalExamples*100).toFixed(1)}%)`);
  });
  console.log('\n✅ Pipeline complete!');
}

// ============================================================================
// Utilities
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Pipeline failed:', error);
    process.exit(1);
  });
}

export { main, loadPolymarketEvents, generateTreeForEvent, extractTerminalPaths };
