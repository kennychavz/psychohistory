/**
 * Generate search queries from event context using LLM
 */

import { z } from 'zod';
import { defaultLLM } from './llm-client';
import { QUERY_GENERATION_PROMPT } from './prompt-templates';

const QueryArraySchema = z.array(z.string()).min(1).max(5);

export async function generateSearchQueries(
  event: string,
  context?: string
): Promise<string[]> {
  const prompt = QUERY_GENERATION_PROMPT(event, context);

  try {
    const queries = await defaultLLM.completeJSON(prompt, QueryArraySchema);
    console.log(`Generated ${queries.length} search queries for: ${event}`);
    return queries;
  } catch (error) {
    console.error('Failed to generate search queries:', error);
    // Fallback to simple queries
    return [
      `${event} historical precedents`,
      `${event} case studies`,
      `${event} research analysis`,
    ];
  }
}
