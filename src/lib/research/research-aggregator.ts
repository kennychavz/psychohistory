/**
 * Aggregate and summarize research findings
 */

import { ResearchResult, ResearchContext } from '@/types/tree';
import { fastLLM } from '../llm/llm-client';
import { RESEARCH_SUMMARY_PROMPT } from '../llm/prompt-templates';

export async function aggregateResearch(
  results: ResearchResult[]
): Promise<ResearchContext> {
  if (results.length === 0) {
    return {
      queries: [],
      results: [],
      timestamp: new Date(),
    };
  }

  // Summarize each result
  const summaries = results.map(result => {
    const sourceTexts = result.sources
      .map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet}`)
      .join('\n\n');
    return `Query: ${result.query}\n\nFindings:\n${sourceTexts}`;
  });

  // Get overall summary from LLM
  try {
    const prompt = RESEARCH_SUMMARY_PROMPT(summaries);
    const overallSummary = await fastLLM.complete(prompt);

    return {
      queries: results.map(r => r.query),
      results: results.map(r => ({
        ...r,
        summary: overallSummary,
      })),
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('Failed to aggregate research:', error);

    // Fallback: just concatenate sources
    return {
      queries: results.map(r => r.query),
      results,
      timestamp: new Date(),
    };
  }
}

export function formatResearchForPrompt(context: ResearchContext): string {
  if (context.results.length === 0) {
    return 'No research findings available.';
  }

  const formatted = context.results
    .map((result, i) => {
      const sources = result.sources
        .map((s, j) => `  [${j + 1}] ${s.title}\n      ${s.snippet}`)
        .join('\n\n');

      return `Research Query ${i + 1}: ${result.query}\n\nSources:\n${sources}`;
    })
    .join('\n\n---\n\n');

  return formatted;
}
