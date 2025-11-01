/**
 * Mock data generator for testing without API calls
 *
 * To enable: Set USE_MOCK_DATA=true in .env
 * To disable for production: Set USE_MOCK_DATA=false in .env
 */

import { ProbabilityOutput } from '@/types/tree';
import { Source } from '@/types/tree';

export const isMockEnabled = (): boolean => {
  return process.env.USE_MOCK_DATA === 'true';
};

// Mock research sources
const mockSources: Source[] = [
  {
    url: 'https://example.com/article-1',
    title: 'Analysis of Current Economic Trends',
    snippet: 'Recent data suggests significant shifts in market dynamics with implications for future policy decisions.',
  },
  {
    url: 'https://example.com/article-2',
    title: 'Geopolitical Impact Study',
    snippet: 'International relations experts weigh in on potential consequences and strategic considerations.',
  },
  {
    url: 'https://example.com/article-3',
    title: 'Technology and Innovation Report',
    snippet: 'Latest developments in technology sectors show accelerating adoption and transformation patterns.',
  },
  {
    url: 'https://example.com/article-4',
    title: 'Social and Cultural Effects Research',
    snippet: 'Survey data reveals changing attitudes and behavioral patterns across demographic groups.',
  },
  {
    url: 'https://example.com/article-5',
    title: 'Environmental Sustainability Review',
    snippet: 'Climate experts assess potential environmental impacts and sustainability outcomes.',
  },
];

// Mock event templates based on parent event
const eventTemplates = [
  { suffix: 'accelerates rapidly', sentiment: 60, probability: 0.35 },
  { suffix: 'proceeds gradually', sentiment: 20, probability: 0.30 },
  { suffix: 'faces significant obstacles', sentiment: -40, probability: 0.20 },
  { suffix: 'triggers unexpected consequences', sentiment: -20, probability: 0.10 },
  { suffix: 'leads to policy reforms', sentiment: 40, probability: 0.05 },
];

/**
 * Generate mock research results
 */
export function generateMockResearch(eventName: string, depth: number) {
  const numSources = Math.min(3 + depth, 5);

  return {
    sources: mockSources.slice(0, numSources),
    summary: `Mock research summary for "${eventName}": Based on simulated analysis, multiple factors suggest various potential outcomes. Historical patterns and current trends indicate a range of possibilities with varying degrees of likelihood. Key considerations include economic impacts, social dynamics, and systemic effects.`,
    confidence: depth === 1 ? 'high' : depth === 2 ? 'medium' : 'moderate',
    queries: [
      `${eventName} analysis`,
      `${eventName} implications`,
      `${eventName} outcomes`,
    ],
    iterations: 2,
  };
}

/**
 * Generate mock probability outcomes
 */
export function generateMockProbabilities(
  parentEvent: string,
  depth: number,
  categoryContext?: string
): ProbabilityOutput[] {
  const numOutcomes = depth <= 2 ? 4 : 3;
  const templates = eventTemplates.slice(0, numOutcomes);

  // Normalize probabilities
  const totalProb = templates.reduce((sum, t) => sum + t.probability, 0);

  return templates.map((template, idx) => {
    const normalizedProb = template.probability / totalProb;

    // Create contextual event names
    let eventName: string;
    if (categoryContext) {
      // For category nodes, create specific scenarios
      eventName = `${parentEvent}: ${template.suffix}`;
    } else {
      // For deeper nodes, create more specific outcomes
      eventName = `${parentEvent.substring(0, 40)} ${template.suffix}`;
    }

    return {
      event: eventName,
      probability: normalizedProb,
      justification: `Mock analysis suggests this outcome has ${(normalizedProb * 100).toFixed(1)}% probability based on historical patterns and current indicators. Key factors include market dynamics, stakeholder responses, and systemic constraints.`,
      sentiment: template.sentiment + (Math.random() * 20 - 10), // Add some variance
    };
  });
}

/**
 * Simulate processing delay to mimic API calls
 */
export async function simulateProcessingDelay(depth: number): Promise<void> {
  // Faster delays for testing
  const baseDelay = 500; // 500ms base
  const depthDelay = depth * 200; // +200ms per depth level
  const delay = baseDelay + depthDelay + Math.random() * 300;

  await new Promise(resolve => setTimeout(resolve, delay));
}

console.log(`🧪 Mock Data Mode: ${isMockEnabled() ? 'ENABLED' : 'DISABLED'}`);
