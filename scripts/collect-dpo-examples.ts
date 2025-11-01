/**
 * DPO Data Collection Script
 *
 * Integrates with existing tree generation to collect preference pairs.
 * Run with: npx tsx scripts/collect-dpo-examples.ts
 */

import { EventNode, SeedInput } from '@/types/tree';
import {
  nodeToDPOInput,
  exportToJSONL,
  DPOExample,
} from '@/lib/dpo/dpo-preprocessor';
import {
  collectByModelComparison,
  collectByTemperatureSweep,
} from '@/lib/dpo/preference-collector';
import { processNode } from '@/lib/tree/node-processor';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';

/**
 * Example seed events for data collection
 */
const EXAMPLE_SEEDS: SeedInput[] = [
  {
    event: 'Federal Reserve raises interest rates to 6%',
    context: 'Inflation at 4%, unemployment at 3.5%',
    timeframe: '6-12 months',
    maxDepth: 3,
    domain: 'economics',
  },
  {
    event: 'Major breakthrough in fusion energy announced',
    context: 'Commercial viability projected in 5 years',
    timeframe: '1-2 years',
    maxDepth: 3,
    domain: 'technology',
  },
  {
    event: 'Universal basic income pilot program in California',
    context: '$1000/month to 10,000 residents',
    timeframe: '1-2 years',
    maxDepth: 3,
    domain: 'policy',
  },
];

/**
 * Main collection function
 */
async function collectDPOData(
  seedInputs: SeedInput[],
  strategy: 'model_comparison' | 'temperature_sweep' = 'model_comparison',
  outputFile: string = 'dpo_training_data.jsonl'
) {
  console.log('🚀 Starting DPO data collection...');
  console.log(`Strategy: ${strategy}`);
  console.log(`Seeds: ${seedInputs.length}`);

  const allExamples: DPOExample[] = [];

  for (const seed of seedInputs) {
    console.log(`\n📊 Processing seed: ${seed.event.substring(0, 60)}...`);

    try {
      // Build a mini tree for this seed
      const treeExamples = await collectFromSeed(seed, strategy);
      allExamples.push(...treeExamples);

      console.log(
        `✅ Collected ${treeExamples.length} examples from this seed`
      );
    } catch (error) {
      console.error(`❌ Error processing seed:`, error);
    }

    // Rate limiting: wait between seeds
    await sleep(2000);
  }

  // Export to JSONL
  console.log(`\n💾 Saving ${allExamples.length} examples to ${outputFile}...`);
  const jsonl = exportToJSONL(allExamples);
  await fs.writeFile(outputFile, jsonl);

  // Also save as pretty JSON for review
  const prettyFile = outputFile.replace('.jsonl', '_pretty.json');
  await fs.writeFile(
    prettyFile,
    JSON.stringify(allExamples.slice(0, 5), null, 2)
  ); // First 5 for review

  console.log('✅ Done!');
  console.log(`Training data: ${outputFile}`);
  console.log(`Review file: ${prettyFile}`);

  // Print statistics
  printStatistics(allExamples);
}

/**
 * Collect DPO examples from a single seed
 */
async function collectFromSeed(
  seed: SeedInput,
  strategy: 'model_comparison' | 'temperature_sweep'
): Promise<DPOExample[]> {
  const examples: DPOExample[] = [];
  const treeId = uuidv4();

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
    categoryContext: seed.domain,
  };

  const nodeMap = new Map<string, EventNode>();
  nodeMap.set(root.id, root);

  // Process nodes breadth-first up to maxDepth
  const queue: EventNode[] = [root];

  while (queue.length > 0) {
    const node = queue.shift()!;

    // Stop at max depth
    if (node.depth >= (seed.maxDepth || 2)) {
      continue;
    }

    console.log(
      `  Processing depth ${node.depth}: ${node.event.substring(0, 50)}...`
    );

    try {
      // Run PHASE 1 + PHASE 2 (research + probability generation)
      // This happens inside processNode
      const children = await processNode(node, seed);
      node.children = children;

      // Add children to node map
      children.forEach(child => {
        nodeMap.set(child.id, child);
        queue.push(child);
      });

      // Now collect DPO examples for this node
      // We need to re-generate outputs with different settings

      // Build DPO input
      const dpoInput = nodeToDPOInput(
        node,
        nodeMap,
        {
          summary: 'Research conducted during processNode', // TODO: Pass actual research
          queries: [],
        },
        seed.timeframe
      );

      // Collect preference pairs based on strategy
      if (strategy === 'model_comparison') {
        const example = await collectByModelComparison(
          dpoInput,
          treeId,
          node.id
        );
        examples.push(example);
      } else if (strategy === 'temperature_sweep') {
        const tempExamples = await collectByTemperatureSweep(
          dpoInput,
          treeId,
          node.id
        );
        examples.push(...tempExamples);
      }

      // Rate limiting
      await sleep(1000);
    } catch (error) {
      console.error(`  ❌ Error processing node:`, error);
    }
  }

  return examples;
}

/**
 * Print collection statistics
 */
function printStatistics(examples: DPOExample[]) {
  console.log('\n📈 Statistics:');
  console.log(`Total examples: ${examples.length}`);

  // Average quality scores
  const avgChosen =
    examples.reduce(
      (sum, ex) =>
        sum +
        (ex.metadata.metrics?.probabilityCalibration || 0),
      0
    ) / examples.length;

  console.log(`Average chosen quality: ${avgChosen.toFixed(3)}`);

  // Depth distribution
  const depthCounts = new Map<number, number>();
  examples.forEach(ex => {
    const depth = ex.input.depth;
    depthCounts.set(depth, (depthCounts.get(depth) || 0) + 1);
  });

  console.log('\nExamples by depth:');
  depthCounts.forEach((count, depth) => {
    console.log(`  Depth ${depth}: ${count}`);
  });

  // Domain distribution
  const domainCounts = new Map<string, number>();
  examples.forEach(ex => {
    const domain = ex.input.categoryContext || 'general';
    domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
  });

  console.log('\nExamples by domain:');
  domainCounts.forEach((count, domain) => {
    console.log(`  ${domain}: ${count}`);
  });
}

/**
 * Helper: Sleep for ms
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// CLI Interface
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let strategy: 'model_comparison' | 'temperature_sweep' = 'model_comparison';
  let outputFile = 'dpo_training_data.jsonl';
  let numSeeds = 3;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--strategy' && args[i + 1]) {
      strategy = args[i + 1] as any;
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      outputFile = args[i + 1];
      i++;
    } else if (args[i] === '--seeds' && args[i + 1]) {
      numSeeds = parseInt(args[i + 1]);
      i++;
    }
  }

  console.log('DPO Data Collection Script');
  console.log('==========================\n');
  console.log(`Strategy: ${strategy}`);
  console.log(`Output: ${outputFile}`);
  console.log(`Seeds: ${numSeeds}\n`);

  // Use subset of example seeds
  const seeds = EXAMPLE_SEEDS.slice(0, numSeeds);

  await collectDPOData(seeds, strategy, outputFile);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { collectDPOData, collectFromSeed };
