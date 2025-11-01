/**
 * Unified LLM client supporting multiple providers
 */

import OpenAI from 'openai';
import { z } from 'zod';

export type LLMProvider = 'openai' | 'openrouter' | 'anthropic';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export class LLMClient {
  private openai?: OpenAI;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;

    if (config.provider === 'openai') {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } else if (config.provider === 'openrouter') {
      this.openai = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
        timeout: 60000, // 60 second timeout to prevent hanging
        maxRetries: 2,   // Retry failed requests twice
        defaultHeaders: {
          'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
          'X-Title': 'PsychoHistory',
        },
      });
    }
  }

  async complete(prompt: string): Promise<string> {
    const { provider, model, temperature = 0.7, maxTokens = 4000 } = this.config;

    try {
      if ((provider === 'openai' || provider === 'openrouter') && this.openai) {
        const response = await this.openai.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: maxTokens,
        });

        return response.choices[0]?.message?.content || '';
      }

      throw new Error(`Provider ${provider} not implemented`);
    } catch (error) {
      console.error('LLM completion error:', error);
      throw error;
    }
  }

  async completeJSON<T>(prompt: string, schema: z.ZodSchema<T>): Promise<T> {
    const response = await this.complete(prompt);

    try {
      // Try to extract JSON from markdown code blocks if present
      let jsonStr = response.trim();
      const jsonMatch = jsonStr.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      } else if (jsonStr.startsWith('```') && jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(3, -3).trim();
      }

      // For R1 reasoning model: Extract JSON from before any reasoning text
      // Look for array pattern and extract up to the closing bracket
      if (jsonStr.includes('[') && !jsonMatch) {
        const arrayStart = jsonStr.indexOf('[');
        let depth = 0;
        let arrayEnd = -1;

        for (let i = arrayStart; i < jsonStr.length; i++) {
          if (jsonStr[i] === '[' || jsonStr[i] === '{') depth++;
          if (jsonStr[i] === ']' || jsonStr[i] === '}') depth--;
          if (depth === 0 && jsonStr[i] === ']') {
            arrayEnd = i + 1;
            break;
          }
        }

        if (arrayEnd > 0) {
          jsonStr = jsonStr.substring(arrayStart, arrayEnd);
        }
      }

      const parsed = JSON.parse(jsonStr);
      return schema.parse(parsed);
    } catch (error) {
      console.error('Failed to parse LLM JSON response:', response);
      throw new Error(`Invalid JSON response: ${error}`);
    }
  }

  async completeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    delay = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
      }
    }

    throw lastError;
  }

  /**
   * Complete with tool calling support (for agentic workflows)
   */
  async completeWithTools(
    messages: any[],
    tools: any[],
    toolChoice: 'auto' | 'required' | 'none' = 'auto'
  ): Promise<any> {
    const { provider, model, temperature = 0.6, maxTokens = 8000 } = this.config;

    try {
      if ((provider === 'openai' || provider === 'openrouter') && this.openai) {
        const response = await this.openai.chat.completions.create({
          model,
          messages,
          tools,
          tool_choice: toolChoice,
          temperature,
          max_tokens: maxTokens,
        });

        return response;
      }

      throw new Error(`Provider ${provider} does not support tool calling`);
    } catch (error) {
      console.error('LLM tool calling error:', error);
      throw error;
    }
  }
}

// Default instances
export const defaultLLM = new LLMClient({
  provider: 'openrouter',
  model: 'openai/gpt-4o',
  temperature: 0.7,
});

export const fastLLM = new LLMClient({
  provider: 'openrouter',
  model: 'openai/gpt-4o-mini',
  temperature: 0.5,
});

// DeepSeek V3.1 - Agentic model for research with tool calling
export const agenticLLM = new LLMClient({
  provider: 'openrouter',
  model: 'deepseek/deepseek-chat', // V3.1 with tool calling support
  temperature: 0.6,
  maxTokens: 8000,
});

// DeepSeek R1 - Reasoning model for probability synthesis
export const reasoningLLM = new LLMClient({
  provider: 'openrouter',
  model: 'deepseek/deepseek-r1',
  temperature: 0.6,
  maxTokens: 8000,
});
