/**
 * Node debug logger for detailed agentic flow inspection
 * Captures complete V3.1 → R1 pipeline for debugging
 */

import fs from 'fs';
import path from 'path';

export interface DebugIteration {
  iteration: number;
  timestamp: string;
  llm_request?: {
    messages: any[];
    tools: any[];
  };
  llm_response?: {
    tool_calls?: any[];
    content?: string;
  };
  tool_executions?: Array<{
    tool_name: string;
    arguments: any;
    result: any;
    duration_ms: number;
  }>;
  duration_ms?: number;
}

export interface NodeDebugLog {
  nodeId: string;
  event: string;
  depth: number;
  timestamp: string;
  phase1_research?: {
    model: string;
    initial_prompt: string;
    iterations: DebugIteration[];
    total_duration_ms: number;
    total_sources: number;
    final_summary: string;
    confidence: string;
  };
  phase2_synthesis?: {
    model: string;
    input_research: string;
    llm_response: any;
    probabilities: any[];
    duration_ms: number;
  };
  children_created: number;
  total_duration_ms: number;
}

class NodeDebugLogger {
  private log: NodeDebugLog | null = null;
  private enabled: boolean = false;
  private startTime: number = 0;

  constructor() {
    // Enable if DEBUG_NODE env var is set
    this.enabled = process.env.DEBUG_NODE === 'true';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  enable() {
    this.enabled = true;
  }

  startNode(nodeId: string, event: string, depth: number) {
    if (!this.enabled) return;

    this.startTime = Date.now();
    this.log = {
      nodeId,
      event,
      depth,
      timestamp: new Date().toISOString(),
      children_created: 0,
      total_duration_ms: 0,
    };

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[DEBUG] Node: ${event.substring(0, 60)}...`);
    console.log(`[DEBUG] Depth: ${depth} | ID: ${nodeId}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  }

  startPhase1(model: string, initialPrompt: string) {
    if (!this.enabled || !this.log) return;

    this.log.phase1_research = {
      model,
      initial_prompt: initialPrompt,
      iterations: [],
      total_duration_ms: 0,
      total_sources: 0,
      final_summary: '',
      confidence: '',
    };

    console.log(`[Phase 1] Starting agentic research with ${model}...`);
  }

  logIteration(iteration: DebugIteration) {
    if (!this.enabled || !this.log?.phase1_research) return;

    this.log.phase1_research.iterations.push(iteration);

    // Console summary
    const toolCalls = iteration.llm_response?.tool_calls || [];
    const toolNames = toolCalls.map(tc => tc.function?.name || tc.name).join(', ');
    console.log(
      `  [Iteration ${iteration.iteration}] ${toolNames} (${iteration.duration_ms}ms)`
    );
  }

  endPhase1(totalSources: number, summary: string, confidence: string, duration: number) {
    if (!this.enabled || !this.log?.phase1_research) return;

    this.log.phase1_research.total_duration_ms = duration;
    this.log.phase1_research.total_sources = totalSources;
    this.log.phase1_research.final_summary = summary;
    this.log.phase1_research.confidence = confidence;

    console.log(
      `[Phase 1] ✓ Complete: ${this.log.phase1_research.iterations.length} iterations, ` +
      `${totalSources} sources, ${(duration / 1000).toFixed(1)}s, confidence: ${confidence}\n`
    );
  }

  startPhase2(model: string) {
    if (!this.enabled || !this.log) return;

    console.log(`[Phase 2] Starting probability synthesis with ${model}...`);
  }

  endPhase2(inputResearch: string, response: any, probabilities: any[], duration: number) {
    if (!this.enabled || !this.log) return;

    this.log.phase2_synthesis = {
      model: 'deepseek/deepseek-r1',
      input_research: inputResearch,
      llm_response: response,
      probabilities,
      duration_ms: duration,
    };

    console.log(
      `[Phase 2] ✓ Complete: ${probabilities.length} outcomes, ${(duration / 1000).toFixed(1)}s\n`
    );
  }

  async endNode(childrenCount: number) {
    if (!this.enabled || !this.log) return;

    this.log.children_created = childrenCount;
    this.log.total_duration_ms = Date.now() - this.startTime;

    // Write to file
    const filename = `node-debug-${Date.now()}-${this.log.nodeId.substring(0, 8)}.json`;
    const logsDir = path.join(process.cwd(), 'logs');
    const filepath = path.join(logsDir, filename);

    try {
      // Ensure logs directory exists
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Write pretty-printed JSON
      fs.writeFileSync(filepath, JSON.stringify(this.log, null, 2));

      console.log(`[DEBUG] ✓ Node complete: ${childrenCount} children created`);
      console.log(`[DEBUG] ✓ Total duration: ${(this.log.total_duration_ms / 1000).toFixed(1)}s`);
      console.log(`[DEBUG] ✓ Log saved: logs/${filename}\n`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    } catch (error) {
      console.error('[DEBUG] Failed to write log file:', error);
    }

    // Reset for next node
    this.log = null;
  }
}

// Singleton instance
export const nodeDebugLogger = new NodeDebugLogger();
