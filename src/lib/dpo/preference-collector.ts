/**
 * Preference Pair Collection for DPO Training
 *
 * Methods to generate "chosen" vs "rejected" outputs:
 * 1. Model comparison (different models/temperatures)
 * 2. Human feedback
 * 3. Automated quality ranking
 * 4. Temporal validation (compare predictions to actual outcomes)
 */

import {
  DPOInput,
  DPOOutput,
  DPOExample,
  DPOMetadata,
  createDPOExample,
  calculateOutputQuality,
} from './dpo-preprocessor';
import { ProbabilityOutput } from '@/types/tree';
import { analyzeProbabilities } from '../llm/probability-analyzer';
import { v4 as uuidv4 } from 'uuid';

/**
 * Strategy 1: Model Comparison
 *
 * Generate two outputs from different models or settings,
 * automatically rank them by quality metrics.
 */
export async function collectByModelComparison(
  input: DPOInput,
  treeId: string,
  nodeId: string
): Promise<DPOExample> {
  console.log('[DPO Collection] Generating model comparison pair...');

  // Generate output A: Higher temperature (more creative)
  const outputA = await generateOutput(
    input,
    { temperature: 0.8, model: 'deepseek/deepseek-r1' }
  );

  // Generate output B: Lower temperature (more conservative)
  const outputB = await generateOutput(
    input,
    { temperature: 0.4, model: 'deepseek/deepseek-r1' }
  );

  // Rank by quality
  const qualityA = calculateOutputQuality(outputA.outcomes, input);
  const qualityB = calculateOutputQuality(outputB.outcomes, input);

  const [chosen, rejected] = qualityA > qualityB
    ? [outputA, outputB]
    : [outputB, outputA];

  console.log(
    `[DPO Collection] Quality scores - A: ${qualityA.toFixed(3)}, B: ${qualityB.toFixed(3)}`
  );

  return createDPOExample(
    input,
    chosen,
    rejected,
    {
      treeId,
      nodeId,
      metrics: {
        probabilityCalibration: Math.max(qualityA, qualityB),
        diversityScore: calculateDiversity(chosen.outcomes),
      },
    }
  );
}

/**
 * Strategy 2: Temperature Sweep
 *
 * Generate outputs at different temperatures, use the best as "chosen"
 * and a random worse one as "rejected".
 */
export async function collectByTemperatureSweep(
  input: DPOInput,
  treeId: string,
  nodeId: string,
  temperatures: number[] = [0.3, 0.5, 0.7, 0.9]
): Promise<DPOExample[]> {
  console.log('[DPO Collection] Running temperature sweep...');

  const outputs = await Promise.all(
    temperatures.map(async temp => {
      const output = await generateOutput(input, {
        temperature: temp,
        model: 'deepseek/deepseek-r1',
      });
      const quality = calculateOutputQuality(output.outcomes, input);
      return { output, quality, temperature: temp };
    })
  );

  // Sort by quality
  outputs.sort((a, b) => b.quality - a.quality);

  // Create multiple training examples
  const examples: DPOExample[] = [];

  // Best vs worst
  examples.push(
    createDPOExample(
      input,
      outputs[0].output,
      outputs[outputs.length - 1].output,
      {
        treeId,
        nodeId,
        metrics: {
          probabilityCalibration: outputs[0].quality,
        },
      }
    )
  );

  // Best vs median
  if (outputs.length >= 3) {
    const medianIdx = Math.floor(outputs.length / 2);
    examples.push(
      createDPOExample(
        input,
        outputs[0].output,
        outputs[medianIdx].output,
        {
          treeId,
          nodeId,
          metrics: {
            probabilityCalibration: outputs[0].quality,
          },
        }
      )
    );
  }

  console.log(
    `[DPO Collection] Generated ${examples.length} pairs from temperature sweep`
  );

  return examples;
}

/**
 * Strategy 3: Human Feedback Collection
 *
 * Present outputs to humans for preference selection.
 */
export interface HumanFeedback {
  chosenOutputId: string;
  rating: number; // 1-5
  comments?: string;
}

export async function collectByHumanFeedback(
  input: DPOInput,
  outputs: DPOOutput[],
  feedback: HumanFeedback,
  treeId: string,
  nodeId: string
): Promise<DPOExample> {
  const chosenIdx = outputs.findIndex(
    o => o.modelInfo.timestamp.toISOString() === feedback.chosenOutputId
  );

  if (chosenIdx === -1) {
    throw new Error('Chosen output not found');
  }

  // Use the chosen output and pick a random other as rejected
  const rejectedIdx = outputs.findIndex((_, i) => i !== chosenIdx);
  const chosen = outputs[chosenIdx];
  const rejected = outputs[rejectedIdx];

  return createDPOExample(
    input,
    chosen,
    rejected,
    {
      treeId,
      nodeId,
      humanRating: feedback.rating,
      humanComments: feedback.comments,
    }
  );
}

/**
 * Strategy 4: Temporal Validation
 *
 * After time passes, compare predictions to actual outcomes.
 * The output closer to reality is "chosen".
 */
export function collectByActualOutcome(
  input: DPOInput,
  outputs: DPOOutput[],
  actualOutcome: {
    event: string;
    timeOccurred: Date;
  },
  treeId: string,
  nodeId: string
): DPOExample {
  console.log('[DPO Collection] Validating against actual outcome...');

  // Rank outputs by similarity to actual outcome
  const rankedOutputs = outputs.map(output => {
    const score = scoreOutcomeMatch(output.outcomes, actualOutcome.event);
    return { output, score };
  });

  rankedOutputs.sort((a, b) => b.score - a.score);

  const chosen = rankedOutputs[0].output;
  const rejected = rankedOutputs[rankedOutputs.length - 1].output;

  console.log(
    `[DPO Collection] Best match score: ${rankedOutputs[0].score.toFixed(3)}`
  );

  return createDPOExample(
    input,
    chosen,
    rejected,
    {
      treeId,
      nodeId,
      actualOutcome,
    }
  );
}

/**
 * Strategy 5: Ensemble Disagreement
 *
 * Generate outputs from multiple models, use the one with highest
 * consensus as "chosen" and the outlier as "rejected".
 */
export async function collectByEnsemble(
  input: DPOInput,
  models: string[],
  treeId: string,
  nodeId: string
): Promise<DPOExample> {
  console.log('[DPO Collection] Running ensemble comparison...');

  const outputs = await Promise.all(
    models.map(async model =>
      generateOutput(input, { temperature: 0.6, model })
    )
  );

  // Calculate consensus score for each output
  const consensusScores = outputs.map((output, i) => {
    const score = outputs.reduce((acc, other, j) => {
      if (i === j) return acc;
      return acc + calculateSimilarity(output.outcomes, other.outcomes);
    }, 0) / (outputs.length - 1);

    return { output, score };
  });

  consensusScores.sort((a, b) => b.score - a.score);

  const chosen = consensusScores[0].output; // Highest consensus
  const rejected = consensusScores[consensusScores.length - 1].output; // Outlier

  console.log(
    `[DPO Collection] Consensus scores: ${consensusScores.map(c => c.score.toFixed(3)).join(', ')}`
  );

  return createDPOExample(
    input,
    chosen,
    rejected,
    {
      treeId,
      nodeId,
      metrics: {
        diversityScore: consensusScores[0].score,
      },
    }
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate output using the probability analyzer
 */
async function generateOutput(
  input: DPOInput,
  config: { temperature: number; model: string }
): Promise<DPOOutput> {
  const outcomes = await analyzeProbabilities(
    input.parentEvent,
    input.depth,
    input.researchSummary,
    input.timeframe,
    input.depth - 1 // Parent depth
  );

  return {
    outcomes,
    modelInfo: {
      model: config.model,
      temperature: config.temperature,
      timestamp: new Date(),
    },
  };
}

/**
 * Calculate diversity score (how different the events are)
 */
function calculateDiversity(outcomes: ProbabilityOutput[]): number {
  // Simple diversity: count unique words across all events
  const allWords = outcomes.flatMap(o =>
    o.event.toLowerCase().split(/\s+/)
  );
  const uniqueWords = new Set(allWords);
  return uniqueWords.size / allWords.length;
}

/**
 * Score how well predictions match actual outcome
 */
function scoreOutcomeMatch(
  predictions: ProbabilityOutput[],
  actualEvent: string
): number {
  // Simple word overlap scoring
  const actualWords = new Set(
    actualEvent.toLowerCase().split(/\s+/)
  );

  const scores = predictions.map(pred => {
    const predWords = pred.event.toLowerCase().split(/\s+/);
    const overlap = predWords.filter(w => actualWords.has(w)).length;
    return (overlap / Math.max(predWords.length, actualWords.size)) * pred.probability;
  });

  return Math.max(...scores);
}

/**
 * Calculate similarity between two output sets
 */
function calculateSimilarity(
  outputA: ProbabilityOutput[],
  outputB: ProbabilityOutput[]
): number {
  // Compare events using word overlap
  let totalSimilarity = 0;

  for (const a of outputA) {
    const aWords = new Set(a.event.toLowerCase().split(/\s+/));

    const maxOverlap = Math.max(
      ...outputB.map(b => {
        const bWords = b.event.toLowerCase().split(/\s+/);
        const overlap = bWords.filter(w => aWords.has(w)).length;
        return overlap / Math.max(bWords.length, aWords.size);
      })
    );

    totalSimilarity += maxOverlap;
  }

  return totalSimilarity / outputA.length;
}

/**
 * Batch collection: Process an entire tree and collect DPO examples
 */
export async function collectFromTree(
  root: any, // EventNode root
  nodeMap: Map<string, any>,
  strategy: 'model_comparison' | 'temperature_sweep' | 'ensemble' = 'model_comparison'
): Promise<DPOExample[]> {
  console.log('[DPO Collection] Starting tree-wide collection...');

  const examples: DPOExample[] = [];
  const treeId = uuidv4();

  // Would need to traverse tree and collect examples
  // This is a placeholder showing the structure

  console.log(`[DPO Collection] Collected ${examples.length} examples`);

  return examples;
}
