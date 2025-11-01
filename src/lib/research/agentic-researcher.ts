/**
 * Agentic research orchestrator using DeepSeek V3.1 with tool calling
 */

import { Source } from '@/types/tree';
import { agenticLLM } from '../llm/llm-client';
import { defaultSearchEngine } from './search-engine';
import { nodeDebugLogger } from '../logging/node-debug-logger';

// Tool definitions for OpenRouter/OpenAI format
const RESEARCH_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search',
      description: 'Search the web for information about an event, policy, or topic. Returns relevant sources with snippets.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'A specific, well-formed search query',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finish_research',
      description: 'Call this when you have gathered sufficient high-quality sources to answer the research question. Do not call this until you have diverse, credible sources.',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'A brief summary of key findings from the research',
          },
          confidence: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Your confidence level in the research findings',
          },
        },
        required: ['summary', 'confidence'],
      },
    },
  },
];

interface ResearchResult {
  sources: Source[];
  summary: string;
  confidence: 'low' | 'medium' | 'high';
  iterations: number;
  queries: string[];
}

const MAX_ITERATIONS = 5;
const SEARCH_TIMEOUT_MS = 60000; // 60 seconds total
const MIN_SOURCES = 3;

export async function conductAgenticResearch(
  event: string,
  context?: string,
  depth?: number,
  path?: string[],
  seedEvent?: string
): Promise<ResearchResult> {
  console.log(`[Agentic Research] Starting for: ${event.substring(0, 60)}...`);

  const startTime = Date.now();
  let iteration = 0;
  const allSources: Source[] = [];
  const executedQueries: string[] = [];
  const seenDomains = new Set<string>();

  // Initial prompt (zero-shot, simple, clear)
  const messages: any[] = [
    {
      role: 'user',
      content: `Research this event: ${event}
${seedEvent ? `Initial event: ${seedEvent}` : ''}
${path && path.length > 1 ? `Path so far: ${path.join(' → ')}` : ''}
${context ? `Context: ${context}` : ''}
${depth ? `Analysis depth: ${depth}/3` : ''}

Find 3-5 diverse, credible sources covering:
1. Historical precedents with actual outcomes and data
2. Causal mechanisms with quantified effects or magnitudes
3. Expert predictions or analysis
4. Counter-evidence or alternative perspectives

Quality over quantity. Use the search tool iteratively to gather information.
When you have sufficient high-quality sources, call finish_research().`,
    },
  ];

  try {
    while (iteration < MAX_ITERATIONS) {
      // Timeout check
      if (Date.now() - startTime > SEARCH_TIMEOUT_MS) {
        console.warn('[Agentic Research] Timeout reached');
        break;
      }

      iteration++;
      const iterationStartTime = Date.now();

      if (!nodeDebugLogger.isEnabled()) {
        console.log(`[Agentic Research] Iteration ${iteration}/${MAX_ITERATIONS}`);
      }

      // Call LLM with tools
      const response = await agenticLLM.completeWithTools(messages, RESEARCH_TOOLS, 'auto');

      const assistantMessage = response.choices[0]?.message;
      if (!assistantMessage) {
        console.error('[Agentic Research] No response from LLM');
        break;
      }

      // Add assistant message to history
      messages.push(assistantMessage);

      // Check if LLM finished without tool calls
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        console.log('[Agentic Research] No tool calls, research complete');
        break;
      }

      // Track tool executions for debug logging
      const toolExecutions: any[] = [];

      // Execute tool calls
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        const toolStartTime = Date.now();

        if (!nodeDebugLogger.isEnabled()) {
          console.log(`[Agentic Research] Tool: ${toolName}`, toolArgs);
        }

        if (toolName === 'finish_research') {
          // Explicit termination
          console.log('[Agentic Research] Finish called, terminating');
          return {
            sources: allSources,
            summary: toolArgs.summary || 'Research completed',
            confidence: toolArgs.confidence || 'medium',
            iterations: iteration,
            queries: executedQueries,
          };
        }

        if (toolName === 'search') {
          const query = toolArgs.query;

          // Prevent duplicate queries
          if (executedQueries.includes(query)) {
            console.warn('[Agentic Research] Duplicate query, skipping');
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: 'Duplicate query' }),
            });
            continue;
          }

          executedQueries.push(query);

          // Execute search
          const sources = await defaultSearchEngine.search(query);

          // Filter out duplicate domains for diversity
          const newSources = sources.filter(source => {
            try {
              const domain = new URL(source.url).hostname;
              if (seenDomains.has(domain)) return false;
              seenDomains.add(domain);
              return true;
            } catch {
              return true; // Keep if URL parsing fails
            }
          });

          allSources.push(...newSources);

          // Return results to LLM
          const toolResult = {
            query,
            sources: newSources.map(s => ({
              title: s.title,
              snippet: s.snippet,
              url: s.url,
            })),
            total_sources_gathered: allSources.length,
          };

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          });

          // Track for debug logging
          toolExecutions.push({
            tool_name: 'search',
            arguments: toolArgs,
            result: toolResult,
            duration_ms: Date.now() - toolStartTime,
          });
        }
      }

      // Log iteration details
      if (nodeDebugLogger.isEnabled()) {
        nodeDebugLogger.logIteration({
          iteration,
          timestamp: new Date().toISOString(),
          llm_response: {
            tool_calls: assistantMessage.tool_calls,
            content: assistantMessage.content,
          },
          tool_executions: toolExecutions,
          duration_ms: Date.now() - iterationStartTime,
        });
      }

      // Safety: If we have enough sources and iterations, break
      if (allSources.length >= MIN_SOURCES && iteration >= 2) {
        console.log('[Agentic Research] Sufficient sources gathered, checking if stuck');

        // Check if last iteration added new sources
        const lastIterationAdded = assistantMessage.tool_calls?.some(
          tc => tc.function.name === 'search'
        );

        if (!lastIterationAdded) {
          console.log('[Agentic Research] No progress, terminating');
          break;
        }
      }
    }

    // Max iterations reached or natural termination
    return {
      sources: allSources,
      summary: 'Research completed through iterative search',
      confidence: allSources.length >= MIN_SOURCES ? 'medium' : 'low',
      iterations: iteration,
      queries: executedQueries,
    };
  } catch (error) {
    console.error('[Agentic Research] Error:', error);

    // Return what we have so far
    return {
      sources: allSources,
      summary: 'Research interrupted by error',
      confidence: 'low',
      iterations: iteration,
      queries: executedQueries,
    };
  }
}
