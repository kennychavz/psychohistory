/**
 * Search engine integration (Exa, Perplexity, or fallback)
 */

import { Source, ResearchResult } from '@/types/tree';

export interface SearchConfig {
  provider: 'exa' | 'tavily' | 'mock';
  apiKey?: string;
  maxResults?: number;
  rateLimitPerMinute?: number;
}

// Queue-based rate limiter with proper request queuing
class RateLimiter {
  private timestamps: number[] = [];
  private limit: number;
  private windowMs: number;
  private pendingQueue: Array<() => void> = [];
  private processing = false;

  constructor(limit: number, windowMs: number = 60000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  async acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.pendingQueue.push(resolve);
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.pendingQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.pendingQueue.length > 0) {
      const now = Date.now();

      // Remove timestamps outside the time window
      this.timestamps = this.timestamps.filter(
        timestamp => now - timestamp < this.windowMs
      );

      // If we've hit the limit, wait until the oldest request expires
      if (this.timestamps.length >= this.limit) {
        const oldestRequest = this.timestamps[0];
        const waitTime = this.windowMs - (now - oldestRequest) + 10; // Small buffer
        console.log(`Rate limit: ${this.timestamps.length}/${this.limit} requests in window. Waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      // We have capacity, process the next request
      const resolve = this.pendingQueue.shift()!;
      this.timestamps.push(now);
      resolve();
    }

    this.processing = false;
  }
}

export class SearchEngine {
  private config: SearchConfig;
  private rateLimiter: RateLimiter;

  constructor(config: SearchConfig) {
    this.config = config;
    // Exa allows 5 queries per second
    // Use 5 per second with 1-second window for accurate rate limiting
    if (config.provider === 'exa') {
      this.rateLimiter = new RateLimiter(5, 1000); // 5 requests per second
    } else {
      const rateLimitPerMinute = config.rateLimitPerMinute || 60;
      this.rateLimiter = new RateLimiter(rateLimitPerMinute);
    }
  }

  async search(query: string): Promise<Source[]> {
    const { provider, maxResults = 5 } = this.config;

    try {
      // Apply rate limiting for external API calls
      if (provider === 'exa' || provider === 'tavily') {
        await this.rateLimiter.acquire();
      }

      if (provider === 'exa') {
        return await this.searchExa(query, maxResults);
      } else if (provider === 'tavily') {
        return await this.searchTavily(query, maxResults);
      } else {
        return this.mockSearch(query, maxResults);
      }
    } catch (error) {
      console.error(`Search failed for query: ${query}`, error);
      return [];
    }
  }

  private async searchExa(query: string, maxResults: number, retryCount = 0): Promise<Source[]> {
    const maxRetries = 5;
    const baseDelay = 1000; // 1 second base delay

    try {
      // Exa API integration
      const response = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey || '',
        },
        body: JSON.stringify({
          query,
          num_results: maxResults,
          use_autoprompt: true,
          type: 'auto',
        }),
      });

      // Handle rate limiting with retry
      if (response.status === 429) {
        if (retryCount >= maxRetries) {
          throw new Error(`Exa API rate limit exceeded after ${maxRetries} retries`);
        }

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        const delay = baseDelay * Math.pow(2, retryCount);
        console.log(`Rate limited by Exa API. Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return this.searchExa(query, maxResults, retryCount + 1);
      }

      if (!response.ok) {
        throw new Error(`Exa API error: ${response.statusText}`);
      }

      const data = await response.json();

      return data.results.map((result: any) => ({
        url: result.url,
        title: result.title,
        snippet: result.text || result.snippet || '',
        relevanceScore: result.score,
      }));
    } catch (error) {
      // If it's a network error or other non-429 error during retry, rethrow
      if (error instanceof Error && error.message.includes('rate limit exceeded')) {
        throw error;
      }
      // For other errors, check if we should retry
      if (retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount);
        console.log(`Exa API error, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.searchExa(query, maxResults, retryCount + 1);
      }
      throw error;
    }
  }

  private async searchTavily(query: string, maxResults: number): Promise<Source[]> {
    // Tavily API integration
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: this.config.apiKey,
        query,
        search_depth: 'advanced',
        max_results: maxResults,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.statusText}`);
    }

    const data = await response.json();

    return data.results.map((result: any) => ({
      url: result.url,
      title: result.title,
      snippet: result.content,
      relevanceScore: result.score,
    }));
  }

  private mockSearch(query: string, maxResults: number): Source[] {
    // Mock data for testing
    console.log(`Mock search for: ${query}`);

    return Array.from({ length: Math.min(maxResults, 3) }, (_, i) => ({
      url: `https://example.com/research/${i + 1}`,
      title: `Research on ${query} - Study ${i + 1}`,
      snippet: `This study examines ${query} and found significant correlations with historical precedents. Key findings include...`,
      relevanceScore: 0.9 - i * 0.1,
    }));
  }
}

// Default instance
export const defaultSearchEngine = new SearchEngine({
  provider: (process.env.SEARCH_PROVIDER as any) || 'mock',
  apiKey: process.env.EXA_API_KEY || process.env.TAVILY_API_KEY,
  maxResults: 5,
  // Rate limiting is handled per-provider in the constructor
});

export async function performBatchSearch(queries: string[]): Promise<ResearchResult[]> {
  const results = await Promise.all(
    queries.map(async query => ({
      query,
      sources: await defaultSearchEngine.search(query),
      summary: '',
    }))
  );

  return results.filter(r => r.sources.length > 0);
}
