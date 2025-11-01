/**
 * Prompt templates for LLM interactions
 */

export const QUERY_GENERATION_PROMPT = (event: string, context?: string) => `
You are an expert researcher tasked with finding historical precedents and academic research.

Event: ${event}
${context ? `Additional Context: ${context}` : ''}

Generate EXACTLY 3-5 search queries (MAXIMUM 5, NO MORE) to find:
1. Historical precedents (similar policies, events, or decisions)
2. Academic research on outcomes and effects
3. Expert analysis and predictions
4. Case studies from other countries, cities, or contexts
5. Data-driven reports or statistical analyses

Make queries specific and diverse. Include both positive and negative case studies.

CRITICAL: You MUST return between 3 and 5 queries. NO MORE than 5 queries.

Output ONLY a JSON array of strings with 3-5 elements:
["query 1", "query 2", "query 3"]
`;

export const PROBABILITY_ANALYSIS_PROMPT = (
  parentEvent: string,
  depth: number,
  research: string,
  timeframe?: string,
  path?: string[],
  seedEvent?: string
) => `
${seedEvent ? `Initial Event: ${seedEvent}\n` : ''}${path && path.length > 1 ? `Path so far: ${path.join(' → ')}\n` : ''}Current Event: ${parentEvent}
Depth: ${depth}/3
Timeframe: ${timeframe || 'Next significant development'}

Research:
${research}

Predict 1-5 possible next events following from the current situation.

Requirements:
- Probabilities sum to 1.0
- Specific, measurable outcomes
- Base predictions on research evidence

Output JSON only:
[{"event": "...", "probability": 0.3}]
`;

export const TIMEFRAME_PROMPT = (event: string, depth: number) => `
Given this event: ${event}
At depth: ${depth}/3

What is a reasonable timeframe for the NEXT significant development?

Output ONLY ONE of:
- "1-2 weeks"
- "1-3 months"
- "3-6 months"
- "6-12 months"
- "1-2 years"

Consider:
- Political/policy events: weeks to months
- Economic shifts: months to years
- Social changes: months to years
- Technological adoption: months to years
`;

export const RESEARCH_SUMMARY_PROMPT = (results: string[]) => `
Synthesize these research findings into a concise summary (max 500 words):

${results.join('\n\n---\n\n')}

Focus on:
1. Key patterns across different cases
2. Success rates and failure modes
3. Timeframes for effects to manifest
4. Common second-order consequences
5. Factors that influenced outcomes

Be objective and balanced. Include both positive and negative findings.
`;
