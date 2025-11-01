/**
 * HuggingFace client for GPT-OSS models
 */

import { z } from 'zod';

export interface HuggingFaceConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export class HuggingFaceClient {
  private apiKey: string;
  private config: HuggingFaceConfig;
  private baseURL = 'https://api-inference.huggingface.co/models';

  constructor(config: HuggingFaceConfig) {
    this.config = config;
    const apiKey = process.env.HUGGINGFACE_API_KEY;

    if (!apiKey) {
      throw new Error('HUGGINGFACE_API_KEY environment variable is required');
    }

    this.apiKey = apiKey;
  }

  async complete(prompt: string): Promise<string> {
    const { model, temperature = 0.7, maxTokens = 4000 } = this.config;

    try {
      const response = await fetch(`${this.baseURL}/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            temperature,
            max_new_tokens: maxTokens,
            return_full_text: false,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HuggingFace API error: ${error}`);
      }

      const data = await response.json();

      // Handle different response formats
      if (Array.isArray(data) && data.length > 0) {
        return data[0].generated_text || '';
      } else if (data.generated_text) {
        return data.generated_text;
      }

      throw new Error('Unexpected response format from HuggingFace');
    } catch (error) {
      console.error('HuggingFace completion error:', error);
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

      const parsed = JSON.parse(jsonStr);
      return schema.parse(parsed);
    } catch (error) {
      console.error('Failed to parse HuggingFace JSON response:', response);
      throw new Error(`Invalid JSON response: ${error}`);
    }
  }

  /**
   * Complete with tool calling support (for agentic workflows)
   * Note: Not all HuggingFace models support tool calling
   */
  async completeWithTools(
    messages: any[],
    tools: any[],
    toolChoice: 'auto' | 'required' | 'none' = 'auto'
  ): Promise<any> {
    const { model, temperature = 0.6, maxTokens = 8000 } = this.config;

    try {
      // Convert messages to single prompt (simplified approach)
      const prompt = messages.map((m: any) => {
        if (m.role === 'user') return `User: ${m.content}`;
        if (m.role === 'assistant') return `Assistant: ${m.content}`;
        if (m.role === 'system') return `System: ${m.content}`;
        return '';
      }).join('\n\n');

      const response = await fetch(`${this.baseURL}/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            temperature,
            max_new_tokens: maxTokens,
            return_full_text: false,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HuggingFace API error: ${error}`);
      }

      const data = await response.json();

      // Format response to match OpenAI-style structure
      let content = '';
      if (Array.isArray(data) && data.length > 0) {
        content = data[0].generated_text || '';
      } else if (data.generated_text) {
        content = data.generated_text;
      }

      return {
        choices: [{
          message: {
            role: 'assistant',
            content,
            tool_calls: null, // HuggingFace doesn't natively support tool calling in this format
          },
        }],
      };
    } catch (error) {
      console.error('HuggingFace tool calling error:', error);
      throw error;
    }
  }
}
