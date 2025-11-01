/**
 * Analyze research and generate probability-weighted outcomes
 */

import { z } from 'zod';
import { reasoningLLM } from './llm-client';
import { PROBABILITY_ANALYSIS_PROMPT } from './prompt-templates';
import { ProbabilityOutput } from '@/types/tree';

const ProbabilityOutputSchema = z.object({
  event: z.string().min(10),
  probability: z.number().min(0).max(1),
  justification: z.string().min(20),
  sentiment: z.number().min(-100).max(100),
});

const ProbabilityArraySchema = z.array(ProbabilityOutputSchema).min(1).max(5);

export async function analyzeProbabilities(
  parentEvent: string,
  depth: number,
  researchSummary: string,
  timeframe?: string,
  path?: string[],
  seedEvent?: string
): Promise<ProbabilityOutput[]> {
  const prompt = PROBABILITY_ANALYSIS_PROMPT(
    parentEvent,
    depth,
    researchSummary,
    timeframe,
    path,
    seedEvent
  );

  try {
    console.log('[R1 Synthesis] Starting probability analysis...');
    const startTime = Date.now();

    let outputs = await reasoningLLM.completeJSON(prompt, ProbabilityArraySchema);

    const elapsed = Date.now() - startTime;
    console.log(`[R1 Synthesis] Completed in ${elapsed}ms`);

    // Normalize probabilities to sum to exactly 1.0
    outputs = normalizeProbabilities(outputs);

    // Validate sum
    const sum = outputs.reduce((acc, o) => acc + o.probability, 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      console.warn(`Probabilities sum to ${sum}, renormalizing...`);
      outputs = normalizeProbabilities(outputs);
    }

    console.log(
      `Generated ${outputs.length} outcomes with probabilities:`,
      outputs.map(o => o.probability)
    );

    return outputs;
  } catch (error) {
    console.error('[R1 Synthesis] Failed to analyze probabilities:', error);
    if (error instanceof Error) {
      console.error('[R1 Synthesis] Error details:', error.message);
      console.error('[R1 Synthesis] Stack trace:', error.stack);
    }
    throw error;
  }
}

function normalizeProbabilities(
  outputs: ProbabilityOutput[]
): ProbabilityOutput[] {
  const sum = outputs.reduce((acc, o) => acc + o.probability, 0);

  if (sum === 0) {
    // Equal distribution if all zero
    const equalProb = 1.0 / outputs.length;
    return outputs.map(o => ({ ...o, probability: equalProb }));
  }

  return outputs.map(o => ({
    ...o,
    probability: o.probability / sum,
  }));
}

export { normalizeProbabilities };
