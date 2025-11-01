# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PsychoHistory is a probabilistic event forecasting system that generates probability trees of future events based on historical research and academic analysis. It combines agentic research (using DeepSeek V3.1 with tool calling), LLM-powered probability analysis, and interactive visualization to create branching forecasts with probabilities, justifications, and sentiment scores.

**Two main components:**
1. **Frontend application** (Next.js) - Interactive tree generation and visualization
2. **Training pipeline** (Modal + Python) - Fine-tuning models on historical outcomes

## Development Commands

### Frontend Development
```bash
# Start development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Run tests (Jest)
npm test
```

### Training Pipeline (Modal)

**Prerequisites:** Modal CLI setup and secrets configured (see training/README.md)

```bash
# === DATA COLLECTION (Real Historical Data) ===
# Generate 100 seed events (70 post-cutoff + 30 in-distribution)
python3 training/data_collection/run_brainstorm.py

# Find actual 3-depth outcome chains for each seed
python3 training/data_collection/run_chronicle.py

# Generate alternative outcomes (for counterfactual training)
python3 training/data_collection/run_alternatives.py

# Full data collection pipeline
python3 training/data_collection/pipeline.py

# === SYNTHETIC DATA (Optional) ===
# Generate synthetic training data (for testing)
python3 training/scripts/generate_synthetic_data.py

# === EVALUATION ===
# Test evaluation metrics
python3 training/evaluation/evaluator.py

# === TRAINING ===
# Run SFT training (Phase 1, ~2-3 hours, H100)
modal run training/modal_sft.py

# Run GRPO training (Phase 2, ~3-4 hours, A10G)
modal run training/modal_grpo.py

# Full end-to-end pipeline
python3 training/run_pipeline.py

# === INFERENCE ===
# Test inference with hot-swappable adapters
python3 training/inference.py
```

## Core Architecture

### Tree Generation Flow

The tree is built **depth-by-depth** (not breadth-first, not recursive):

```
1. Create root node from seed event
2. For each depth level (0 to maxDepth):
   a. Get all nodes at current depth
   b. Process in batches of 20 (maxConcurrent limit)
   c. For each node:
      - Conduct agentic research (search for precedents)
      - Generate child events with probabilities
      - Normalize probabilities to sum to 1.0
   d. Add children to processing queue
3. Return complete tree
```

**Key file:** `src/lib/tree/tree-builder.ts` - Core orchestration engine

### Agentic Research System

Uses **two-model architecture** for optimal performance:

**Phase 1: Research (DeepSeek V3.1)**
- Model: `deepseek/deepseek-chat` via OpenRouter
- Tool calling enabled (OpenAI-compatible)
- Conducts iterative research with search tools

**Tools available:**
- `search(query)` - Execute web search, returns sources
- `finish_research(summary, confidence)` - Terminate research

**Research flow:**
1. LLM receives research task with tool definitions
2. LLM decides which tool to call (can call multiple)
3. Execute tool calls, return results to LLM
4. LLM processes results, decides next action
5. Repeat until `finish_research` called or max iterations (5)

**Phase 2: Synthesis (DeepSeek R1)**
- Model: `deepseek/deepseek-r1` via OpenRouter
- Reasoning-optimized model
- Analyzes research results and generates probabilities
- Produces justifications and sentiment scores

**Key files:**
- `src/lib/research/agentic-researcher.ts` - Tool calling orchestration (Phase 1)
- `src/lib/research/search-engine.ts` - Exa/Tavily/mock search providers
- `src/lib/tree/node-processor.ts` - Two-phase orchestration
- `src/lib/llm/probability-analyzer.ts` - Probability synthesis (Phase 2)

### Streaming Architecture

Tree generation streams progress via **Server-Sent Events (SSE)**:

**Event types:**
- `tree_started` - Root node created
- `node_processing` - Node research beginning
- `node_completed` - Node children generated
- `depth_completed` - All nodes at depth finished
- `tree_completed` - Full tree ready
- `error` - Failure occurred

**Key files:**
- `src/app/api/generate-tree/stream/route.ts` - SSE endpoint
- `src/hooks/useTreeGeneration.ts` - Frontend SSE consumer

### Probability Calculation

Probabilities are **normalized within siblings** to sum to 1.0:

```typescript
// LLM outputs raw probabilities
children = [
  { event: "A", probability: 0.7 },
  { event: "B", probability: 0.5 },
  { event: "C", probability: 0.3 }
]

// Normalize: sum = 1.5, divide each by sum
normalized = [
  { event: "A", probability: 0.467 },  // 0.7 / 1.5
  { event: "B", probability: 0.333 },  // 0.5 / 1.5
  { event: "C", probability: 0.200 }   // 0.3 / 1.5
]
```

**Key file:** `src/lib/tree/probability-calculator.ts`

### Training Pipeline Architecture

**Goal:** Train models to predict actual historical outcomes (not synthetic forecasts)

**Data Collection Pipeline:**
Three-agent system to build training dataset from real historical events:

1. **Brainstormer Agent** (`brainstormer.py`) - Generate 100 seed events
   - 70% Post-cutoff (July 2024 - June 2025): Out-of-distribution forecasting
   - 30% In-distribution (2019-2022): Calibration learning
   - Domains: Politics, Economics, Technology, Geopolitics, Business
   - Requirements: Specific dates, measurable outcomes, well-documented

2. **Chronicler Agent** (`chronicler.py`) - Find actual 3-depth outcome chains
   - Uses Exa/Tavily search to find what happened after each seed
   - Builds depth-3 causal chains (seed → 1mo → 2mo → 3mo outcomes)
   - Search window: ±2 weeks around target timeframe
   - Validates outcomes are direct consequences with clear documentation

3. **Alternative Generator** (`alternative_gen.py`) - Create counterfactuals
   - Generate plausible alternative outcomes that didn't happen
   - Used for negative examples and probability calibration
   - Ensures model learns to distinguish likely from unlikely paths

**Two-phase training approach:**
1. **SFT (Supervised Fine-Tuning)** - Learn to predict events that happened
   - LoRA rank 64 (higher capacity for learning)
   - H100 GPU, 2-3 hours, ~$6-9
   - Loss: `-log(P(actual_event))`

2. **GRPO (Group Relative Policy Optimization)** - Multi-objective RL
   - LoRA rank 4 (ultra-low, RL needs minimal capacity)
   - A10G GPU, 3-4 hours, ~$2-3
   - Objectives: calibration + diversity + sharpness

**Hot-swapping:** Load different LoRA adapters without reloading base model for A/B testing

**Key files:**
- `training/data_collection/agents/brainstormer.py` - Seed generation
- `training/data_collection/agents/chronicler.py` - Outcome chains
- `training/data_collection/agents/alternative_gen.py` - Counterfactuals
- `training/data_collection/pipeline.py` - End-to-end data collection
- `training/modal_sft.py` - Phase 1 training
- `training/modal_grpo.py` - Phase 2 training
- `training/inference.py` - Hot-swappable inference
- `training/evaluation/evaluator.py` - Metrics calculation

## Environment Variables

Required environment variables (`.env.local`):

```bash
# OpenRouter API Key (required for LLM)
OPENROUTER_API_KEY=sk-or-v1-...

# Search Provider (optional, defaults to 'mock')
SEARCH_PROVIDER=exa  # or 'tavily' or 'mock'

# Exa AI (if using Exa)
EXA_API_KEY=...

# Tavily AI (if using Tavily)
TAVILY_API_KEY=...

# Site URL (optional, for OpenRouter attribution)
SITE_URL=http://localhost:3000
```

**Modal secrets (for training):**
```bash
modal secret create huggingface-secret HUGGING_FACE_HUB_TOKEN=hf_...
modal secret create openrouter OPENROUTER_API_KEY=sk-or-...
```

## Key Type Definitions

**EventNode** (`src/types/tree.ts`):
- `event`: Description of what happens
- `probability`: 0-1, sums to 1.0 with siblings
- `justification`: Why this event is likely
- `sentiment`: -100 to 100 impact rating
- `sources`: Array of research citations
- `children`: Array of child EventNodes
- `depth`: 0-5 tree depth

**SeedInput** (`src/types/tree.ts`):
- `event`: Starting event description
- `context`: Optional background information
- `timeframe`: Optional time window (e.g., "next 6 months")
- `maxDepth`: Tree depth limit (1-5)
- `domain`: Optional category hint

## Important Constraints

### Concurrency Management
- **Max concurrent nodes:** 20 per depth level (prevents rate limit issues)
- **Depth-by-depth:** Must complete depth N before starting depth N+1
- **No parallel depths:** Ensures consistent probability normalization

### LLM Context
- **Max sequence length:** 2048 tokens for training
- **Research timeout:** 60 seconds total per node
- **Max research iterations:** 5 per node
- **Min sources:** 3 per node

### Probability Rules
- Siblings must sum to 1.0 (normalized automatically)
- Root node always has probability 1.0
- No negative probabilities (enforced in calculator)

## Testing Strategy

**Frontend testing:**
- Jest for unit tests (not extensively implemented yet)
- Manual testing via dev server

**Training pipeline testing:**
```python
# Test with synthetic data first
python3 training/scripts/generate_synthetic_data.py
python3 training/evaluation/evaluator.py

# Expected metrics (synthetic data):
# - Baseline: Perplexity ~8.5, Match Rate ~35%
# - SFT: Perplexity ~2.8, Match Rate ~82%
# - GRPO: Perplexity ~1.9, Match Rate ~87%
```

## Common Gotchas

1. **Tree depth is 0-indexed:** Root is depth 0, first children are depth 1
2. **Probabilities are normalized per-parent:** Don't expect raw LLM outputs
3. **Agentic research is not streaming:** Full tool call cycle per iteration
4. **Modal volumes persist across runs:** Delete volume to reset state
5. **LoRA rank impacts memory:** SFT (rank 64) needs H100, GRPO (rank 4) fits on A10G
6. **Search provider must be configured:** Defaults to 'mock' with fake data
7. **Streaming is SSE not WebSocket:** Use EventSource API in frontend
8. **Data collection uses checkpoints:** Progress saved in `training/data_collection/checkpoints/` - delete to restart
9. **Post-cutoff events must allow 3-month chains:** Seed events after March 2025 won't have complete outcome data
10. **Chronicler search requires API keys:** Exa or Tavily required for real historical outcome research

## Project Structure Highlights

```
src/
├── app/
│   └── api/generate-tree/stream/  # SSE endpoint for tree generation
├── components/
│   ├── SeedInput/                 # Input form
│   └── TreeVisualization/         # React Flow graph
├── lib/
│   ├── tree/                      # Core tree building engine
│   ├── research/                  # Agentic research + search
│   ├── llm/                       # LLM client and prompts
│   ├── layout/                    # D3 depth-aware layout
│   └── logging/                   # Debug logging system
└── types/                         # TypeScript definitions

training/
├── data_collection/               # Real historical data pipeline
│   ├── agents/
│   │   ├── brainstormer.py       # Generate 100 seed events
│   │   ├── chronicler.py         # Find actual outcome chains
│   │   └── alternative_gen.py    # Generate counterfactuals
│   ├── pipeline.py               # End-to-end data collection
│   ├── run_brainstorm.py         # Run brainstormer standalone
│   ├── run_chronicle.py          # Run chronicler standalone
│   ├── config.py                 # LLM/search config
│   ├── utils.py                  # Shared utilities
│   └── checkpoints/              # Incremental progress saves
├── modal_sft.py                  # SFT training (rank 64)
├── modal_grpo.py                 # GRPO training (rank 4)
├── inference.py                  # Hot-swappable inference
├── evaluation/
│   └── evaluator.py              # Metrics + match coverage
└── scripts/
    └── generate_synthetic_data.py # Synthetic data (testing only)
```

## Additional Documentation

- `README.md` - User-facing project documentation
- `TRAINING_PIPELINE.md` - Detailed training architecture
- `training/README.md` - Training quickstart guide
- `STREAMING_ARCHITECTURE.md` - SSE implementation details
- `MODAL_READY.md` - Modal deployment notes
