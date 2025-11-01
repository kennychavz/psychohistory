# DPO Visual Concepts Guide
## Understanding RL, Preprocessing, and DPO from First Principles

---

## Part 1: What is Reinforcement Learning (RL)?

### The Core Problem

Language models are trained in two phases:

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Pre-training (Learn Language)                      │
│                                                              │
│ Input:  "The capital of France is"                          │
│ Output: "Paris" ✓                                           │
│                                                              │
│ How: Predict next token from billions of text examples      │
│ Goal: Learn grammar, facts, reasoning                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Alignment (Learn Preferences)  ← YOU ARE HERE      │
│                                                              │
│ Input:  "Predict NYC rent control outcomes"                 │
│ Output A: "Housing situation changes" ❌ (vague)            │
│ Output B: "Rental supply drops 15-20% in 2 years" ✓        │
│                                                              │
│ How: Teach model to prefer B over A                         │
│ Goal: Generate BETTER outputs (specific, grounded, useful)  │
└─────────────────────────────────────────────────────────────┘
```

### Why RL? The Alignment Problem

Pre-trained models know language but don't know what GOOD looks like:

```
User: "Predict what happens after rent control"

GPT (Pre-trained only):
├─ "Things will change" (too vague)
├─ "Prices increase" (contradicts economics)
├─ "Supply drops 90%" (too extreme)
└─ "Rental supply decreases 15-20% based on Berlin 2020 data" ✓

Problem: All are grammatically correct!
Solution: RL teaches which one is BETTER
```

### Three Approaches to RL Alignment

```
┌────────────────────────────────────────────────────────────────┐
│ Approach 1: RLHF (Reinforcement Learning from Human Feedback) │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Step 1: Collect human preferences                            │
│    Human sees Output A vs Output B → chooses B                │
│                                                                │
│  Step 2: Train a REWARD MODEL                                 │
│    Neural network learns: reward(B) > reward(A)               │
│                                                                │
│  Step 3: Use PPO algorithm                                    │
│    Optimize LLM to maximize reward from reward model          │
│                                                                │
│  Cons: Complex! Requires 2 models, unstable training          │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ Approach 2: DPO (Direct Preference Optimization) ← WE USE THIS│
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Step 1: Collect preference pairs (A vs B)                    │
│    Same as RLHF                                               │
│                                                                │
│  Step 2: Direct optimization                                  │
│    Train LLM DIRECTLY to prefer B over A                      │
│    No reward model needed!                                    │
│                                                                │
│  Pros: Simpler, more stable, same performance                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ Approach 3: Supervised Fine-tuning (SFT)                      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Step 1: Collect ONLY good examples                           │
│    No comparisons, just "this is correct"                     │
│                                                                │
│  Step 2: Standard supervised learning                         │
│    Train model to reproduce good examples                     │
│                                                                │
│  Cons: Doesn't learn WHY something is better                  │
└────────────────────────────────────────────────────────────────┘
```

**Why DPO for PsychoHistory?**
- ✅ You have clear quality criteria (calibration, specificity, citations)
- ✅ Easy to generate pairs (different temperatures → different quality)
- ✅ Stable training (important for production)
- ✅ No extra models needed

---

## Part 2: What is Preprocessing?

### The Central Challenge

Machine learning models are mathematical functions that eat **numbers**, not concepts:

```
What the model ACTUALLY sees:
┌─────────────────────────────────────────────────────────────┐
│ Human-readable:                                              │
│   "NYC implements rent control"                              │
│                                                              │
│ After tokenization:                                          │
│   [45, 123, 4567, 89, 234, 567]                             │
│                                                              │
│ After embedding:                                             │
│   [[0.23, -0.45, 0.67, ...], [0.12, 0.89, -0.34, ...], ...] │
│                                                              │
│ Shape: (6 tokens, 4096 dimensions)                          │
└─────────────────────────────────────────────────────────────┘
```

### Preprocessing = Data Transformation Pipeline

```
Raw Reality → Clean Structure → Model Input → Training Format
     ↓              ↓                ↓              ↓
   Messy        Organized      Mathematical    Optimized
```

**Example for PsychoHistory:**

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 0: Raw Reality (Your Tree in Memory)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  EventNode {                                                 │
│    id: "abc123",                                             │
│    event: "NYC implements rent control",                    │
│    children: [EventNode, EventNode, ...],                   │
│    parent: EventNode,                                        │
│    probability: 1.0,                                         │
│    sources: [{...}, {...}],                                  │
│    ...lots of metadata...                                    │
│  }                                                           │
│                                                              │
│  Problem: Nested objects, circular references, too much info│
└─────────────────────────────────────────────────────────────┘
                            ↓
                    [Preprocessing Step 1]
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Extract Relevant Context                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  DPOInput {                                                  │
│    parentEvent: "NYC implements rent control",              │
│    depth: 0,                                                 │
│    pathFromRoot: [                                           │
│      { event: "NYC...", probability: 1.0, depth: 0 }       │
│    ],                                                        │
│    cumulativeProbability: 1.0,                              │
│    researchSummary: "Historical data shows...",             │
│    sources: [...top 5 only...],                             │
│  }                                                           │
│                                                              │
│  Better: Flat structure, only relevant info                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    [Preprocessing Step 2]
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Format as Prompt (Human-Readable)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  # Probability Tree Analysis                                │
│                                                              │
│  ## Tree Path History                                        │
│  [Depth 0] NYC implements rent control (p=1.0)              │
│                                                              │
│  Cumulative Probability: 1.0000                             │
│                                                              │
│  ## Research Summary                                         │
│  Historical data shows Berlin's 2020 rent cap...            │
│                                                              │
│  ## Task                                                     │
│  Predict 1-5 possible next events...                        │
│                                                              │
│  Better: Readable text the model can understand             │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    [Preprocessing Step 3]
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Create Training Example (DPO Format)                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  {                                                           │
│    "prompt": "# Probability Tree Analysis\n\n...",          │
│    "chosen": "[{event: 'Supply drops 15%', p: 0.45}]",     │
│    "rejected": "[{event: 'Things change', p: 0.7}]"        │
│  }                                                           │
│                                                              │
│  Better: Standard format for DPO training libraries         │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    [Preprocessing Step 4]
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Tokenize (Model Input)                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  {                                                           │
│    "prompt_ids": [1, 45, 234, 567, ...],                   │
│    "chosen_ids": [89, 123, 456, ...],                       │
│    "rejected_ids": [12, 345, 678, ...]                      │
│  }                                                           │
│                                                              │
│  Better: Pure numbers the model can process                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 3: DPO Deep Dive

### The Mathematical Intuition

DPO optimizes this objective:

```
Goal: Make P(chosen | prompt) > P(rejected | prompt)

How? Adjust model weights to increase chosen probability
     and decrease rejected probability

Loss function:
  L = -log(σ(β * (log π(chosen) - log π(rejected))))

Where:
  π = your model's probability
  σ = sigmoid function (0 to 1)
  β = how strongly to enforce preference (typically 0.1)
```

**In plain English:**

```
┌────────────────────────────────────────────────────────┐
│ Before Training:                                        │
│                                                         │
│ Prompt: "Predict outcomes of rent control"             │
│                                                         │
│ Model generates:                                        │
│   P("Things change") = 0.15        ← rejected          │
│   P("Supply drops 15%") = 0.12     ← chosen            │
│                                                         │
│ Problem: Model slightly prefers the BAD output!        │
└────────────────────────────────────────────────────────┘
                         ↓
                 [DPO Training]
                         ↓
┌────────────────────────────────────────────────────────┐
│ After Training:                                         │
│                                                         │
│ Prompt: "Predict outcomes of rent control"             │
│                                                         │
│ Model generates:                                        │
│   P("Things change") = 0.05        ← rejected ↓        │
│   P("Supply drops 15%") = 0.35     ← chosen ↑          │
│                                                         │
│ Success: Model now prefers the GOOD output!            │
└────────────────────────────────────────────────────────┘
```

### DPO vs RLHF: Architecture Comparison

```
┌─────────────────────────────────────────────────────────────┐
│ RLHF (Complex - 3 Model System)                              │
└─────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │ Base Model   │ (e.g., Llama 3.3)
    └──────┬───────┘
           │
           ├─────────────┐
           │             │
    ┌──────▼───────┐   ┌▼─────────────┐
    │ Reward Model │   │ Policy Model │
    │ (Learn what  │   │ (Generate    │
    │  is good)    │   │  outputs)    │
    └──────┬───────┘   └──────┬───────┘
           │                   │
           │   Reward signal   │
           └──────────►────────┘
                      │
              ┌───────▼────────┐
              │ PPO Algorithm  │ (Unstable!)
              │ (Optimize)     │
              └────────────────┘

Problems:
  - Two models to maintain
  - PPO is unstable (hyperparameter hell)
  - Slow training (two forward passes per sample)

┌─────────────────────────────────────────────────────────────┐
│ DPO (Simple - 1 Model System)                               │
└─────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │ Base Model   │ (e.g., Llama 3.3)
    └──────┬───────┘
           │
    ┌──────▼───────────────────────┐
    │ Direct Optimization          │
    │                              │
    │ Loss = f(chosen, rejected)   │
    │                              │
    │ (No reward model needed!)    │
    └──────────────────────────────┘

Benefits:
  ✅ One model
  ✅ Stable training (standard gradient descent)
  ✅ Fast training (one forward pass per sample)
  ✅ Same performance as RLHF
```

---

## Part 4: Visual Preprocessing Pipeline for PsychoHistory

### Complete Data Transformation (Real Example)

```
┌─────────────────────────────────────────────────────────────┐
│ INPUT: Raw Tree Node                                         │
└─────────────────────────────────────────────────────────────┘

EventNode {
  id: "node_abc123",
  event: "NYC implements strict rent control",
  probability: 1.0,
  depth: 0,
  children: [
    EventNode {
      id: "node_xyz789",
      event: "Rental supply decreases 15-20%",
      probability: 0.45,
      depth: 1,
      children: [...],
      sources: [{...}, {...}]
    },
    EventNode {
      id: "node_def456",
      event: "Black market rentals increase",
      probability: 0.35,
      depth: 1,
      children: [...]
    }
  ],
  sources: [
    {
      url: "https://example.com/berlin-rent-cap",
      title: "Berlin's Rent Cap: Lessons Learned",
      snippet: "The 2020 rent freeze led to 18% supply reduction..."
    }
  ],
  parentId: null,
  createdAt: 2025-01-15T10:00:00Z
}

Research Data (from conductAgenticResearch):
{
  summary: "Historical analysis of rent control shows...",
  queries: ["rent control outcomes", "Berlin rent cap 2020"],
  sources: [{...}, {...}, {...}],
  confidence: "medium",
  iterations: 3
}
```

**↓ STEP 1: Build Tree History**

```
┌─────────────────────────────────────────────────────────────┐
│ TRANSFORMATION 1: buildTreeHistory(node, nodeMap)           │
└─────────────────────────────────────────────────────────────┘

WHY: Model needs to know ALL ancestors to make coherent predictions
     (Can't predict grandchild without knowing parent and grandparent)

Input:  node_xyz789 (depth 1)
Output: pathFromRoot array

pathFromRoot: [
  {
    event: "NYC implements strict rent control",
    probability: 1.0,
    sentiment: 0,
    depth: 0,
    justification: "Seed event"
  },
  {
    event: "Rental supply decreases 15-20%",
    probability: 0.45,
    sentiment: -40,
    depth: 1,
    justification: "Berlin 2020 rent cap led to 18% reduction"
  }
]

Guiding Principle:
  🎯 COHERENCE - Predictions must respect what came before

Example:
  Path: "Supply decreases" → "Prices should go UP" ✓
  Path: "Supply decreases" → "Prices drop 50%" ✗ (Incoherent!)
```

**↓ STEP 2: Calculate Cumulative Probability**

```
┌─────────────────────────────────────────────────────────────┐
│ TRANSFORMATION 2: calculateCumulativeProbability(path)      │
└─────────────────────────────────────────────────────────────┘

WHY: Rare paths should get different predictions than likely paths
     (A 1% probability path represents an edge case)

Input:  pathFromRoot = [p=1.0, p=0.45]
Output: cumulativeProbability = 1.0 × 0.45 = 0.45

cumulativeProbability: 0.45 (45% chance this path occurs)

Guiding Principle:
  🎯 PROBABILITY AWARENESS - Model learns P(path) context

Example:
  High probability path (p=0.7): Predict mainstream outcomes
  Low probability path (p=0.05): Predict edge cases, black swans
```

**↓ STEP 3: Extract Sibling Context**

```
┌─────────────────────────────────────────────────────────────┐
│ TRANSFORMATION 3: extractSiblings(node, nodeMap)            │
└─────────────────────────────────────────────────────────────┘

WHY: Model should know what OTHER branches exist at this level
     (Helps avoid duplicate predictions and ensures diversity)

Input:  node_xyz789
Output: siblings array

siblings: [
  {
    event: "Black market rentals increase",
    probability: 0.35,
    sentiment: -60
  },
  {
    event: "Political backlash leads to policy reversal",
    probability: 0.20,
    sentiment: 10
  }
]

Guiding Principle:
  🎯 DIVERSITY - Don't repeat what siblings already cover

Example:
  Sibling 1: "Supply decreases" ← we're here
  Sibling 2: "Black market increases"

  Good child: "New construction permits drop" (new angle)
  Bad child: "Black market grows more" (duplicate of sibling 2!)
```

**↓ STEP 4: Combine into DPOInput**

```
┌─────────────────────────────────────────────────────────────┐
│ TRANSFORMATION 4: nodeToDPOInput(...)                       │
└─────────────────────────────────────────────────────────────┘

WHY: Package all context into one clean structure

DPOInput {
  // Current focus
  parentEvent: "Rental supply decreases 15-20%",
  depth: 1,
  timeframe: "6-12 months",

  // Historical context
  pathFromRoot: [...see above...],
  cumulativeProbability: 0.45,

  // Lateral context
  siblings: [...see above...],

  // Evidence
  researchSummary: "Historical analysis shows...",
  sources: [{url: "...", title: "...", snippet: "..."}],
  queriesExecuted: ["rent control outcomes", "Berlin rent cap"],

  // Parent metadata
  parentSentiment: -40,
  parentJustification: "Berlin 2020 rent cap led to 18% reduction",
  categoryContext: "policy"
}

Guiding Principle:
  🎯 COMPLETENESS - Include everything model needs to decide
```

**↓ STEP 5: Format as Prompt**

```
┌─────────────────────────────────────────────────────────────┐
│ TRANSFORMATION 5: formatDPOPrompt(input)                    │
└─────────────────────────────────────────────────────────────┘

WHY: Convert structured data → natural language the model understands

Output: Multi-line string

"""
# Probability Tree Analysis Task

## Tree Path History (Root to Current Node)
[Depth 0] NYC implements strict rent control (p=1.00, sentiment=0)
  [Depth 1] Rental supply decreases 15-20% (p=0.45, sentiment=-40)

Cumulative Probability of This Path: 0.4500

## Sibling Branches at Current Level
  - Black market rentals increase (p=0.35)
  - Political backlash leads to policy reversal (p=0.20)

## Current Node Details
Event: Rental supply decreases 15-20%
Depth: 1/5
Timeframe: 6-12 months
Sentiment: -40
Category: policy

## Research Context
Queries Executed:
  1. rent control outcomes
  2. Berlin rent cap 2020

Research Summary:
Historical analysis shows rent control policies in Berlin (2020) and
Stockholm (1994) led to significant supply reductions. Berlin's freeze
resulted in 18% fewer listings within 12 months...

Sources (5 total):
  1. Berlin's Rent Cap: Lessons Learned
     The 2020 rent freeze led to 18% supply reduction...

## Task
Based on the tree history, research findings, and context above,
predict 1-5 possible next events.

Requirements:
- Probabilities must sum to 1.0
- Justify each prediction using research evidence
- Assign sentiment from -100 to 100
- Make events specific and measurable
- Consider the cumulative path context

Output format:
[
  {
    "event": "Specific, measurable outcome",
    "probability": 0.35,
    "justification": "Evidence from research...",
    "sentiment": 25
  }
]
"""

Guiding Principle:
  🎯 CLARITY - Make task crystal clear with examples
```

**↓ STEP 6: Generate Candidate Outputs**

```
┌─────────────────────────────────────────────────────────────┐
│ TRANSFORMATION 6: Generate Chosen vs Rejected               │
└─────────────────────────────────────────────────────────────┘

WHY: Need comparison pairs to teach preferences

Strategy: Model Comparison (different temperatures)

Output A (temp=0.4, conservative):
{
  outcomes: [
    {
      event: "New construction permits decrease 35-40% by Q4 2025",
      probability: 0.50,
      justification: "Berlin saw 45% permit drop in 18 months post-cap (Source 1)",
      sentiment: -50
    },
    {
      event: "Average apartment size decreases 10-15% as developers optimize",
      probability: 0.30,
      justification: "Stockholm data shows similar space optimization (Source 3)",
      sentiment: -25
    },
    {
      event: "Renovation and maintenance spending drops 20%",
      probability: 0.20,
      justification: "Landlords reduce investment when ROI capped (Source 2)",
      sentiment: -40
    }
  ],
  modelInfo: {
    model: "deepseek/deepseek-r1",
    temperature: 0.4,
    timestamp: 2025-01-15T10:05:00Z
  }
}

Quality Score: 0.87
  ✓ Probabilities sum to 1.0
  ✓ Specific percentages and timelines
  ✓ Strong research citations
  ✓ Measurable outcomes

Output B (temp=0.9, creative):
{
  outcomes: [
    {
      event: "Housing market changes significantly",
      probability: 0.60,
      justification: "Based on general economic trends",
      sentiment: -30
    },
    {
      event: "Some developers exit the market",
      probability: 0.40,
      justification: "Market dynamics shift",
      sentiment: -20
    }
  ],
  modelInfo: {
    model: "deepseek/deepseek-r1",
    temperature: 0.9,
    timestamp: 2025-01-15T10:05:03Z
  }
}

Quality Score: 0.34
  ✗ Vague predictions ("changes significantly", "some developers")
  ✗ No specific numbers or timelines
  ✗ Weak justifications (no source citations)
  ✗ Only 2 outcomes (should be 3-5)

Guiding Principle:
  🎯 QUALITY CONTRAST - Chosen must be clearly better than rejected
```

**↓ STEP 7: Create Training Example**

```
┌─────────────────────────────────────────────────────────────┐
│ TRANSFORMATION 7: createDPOExample(...)                     │
└─────────────────────────────────────────────────────────────┘

WHY: Package everything into standard DPO format

Final Training Example:
{
  id: "tree_abc123_node_xyz789_1736936700000",

  input: { ...DPOInput from Step 4... },

  chosen: { ...Output A... },    // Quality = 0.87

  rejected: { ...Output B... },  // Quality = 0.34

  metadata: {
    timestamp: 2025-01-15T10:05:00Z,
    treeId: "tree_abc123",
    nodeId: "node_xyz789",
    metrics: {
      probabilityCalibration: 0.87,
      diversityScore: 0.72,
      citationQuality: 0.91
    }
  }
}

Guiding Principle:
  🎯 TRACEABILITY - Keep metadata for debugging and analysis
```

**↓ STEP 8: Export to JSONL**

```
┌─────────────────────────────────────────────────────────────┐
│ TRANSFORMATION 8: exportToJSONL(examples)                   │
└─────────────────────────────────────────────────────────────┘

WHY: JSONL is standard format for ML training (one example per line)

Output File: dpo_training_data.jsonl

Line 1:
{"prompt":"# Probability Tree Analysis\n\n...","chosen":"[{\"event\":\"New construction permits decrease 35-40%\"...}]","rejected":"[{\"event\":\"Housing market changes\"...}]","metadata":{...}}

Line 2:
{"prompt":"# Probability Tree Analysis\n\n...","chosen":"[...]","rejected":"[...]","metadata":{...}}

...

Guiding Principle:
  🎯 STANDARDIZATION - Use formats ML libraries expect
```

**↓ STEP 9: Load for Training**

```
┌─────────────────────────────────────────────────────────────┐
│ TRANSFORMATION 9: Python Training Pipeline                  │
└─────────────────────────────────────────────────────────────┘

WHY: DPO training happens in Python (HuggingFace ecosystem)

Python code:
```python
from datasets import load_dataset

# Load JSONL
dataset = load_dataset('json', data_files='dpo_training_data.jsonl')

# Dataset structure:
# {
#   'prompt': str,
#   'chosen': str,
#   'rejected': str,
#   'metadata': dict
# }

# Tokenize
def tokenize(example):
    return {
        'prompt_ids': tokenizer(example['prompt']),
        'chosen_ids': tokenizer(example['chosen']),
        'rejected_ids': tokenizer(example['rejected'])
    }

dataset = dataset.map(tokenize)

# Now ready for DPOTrainer!
```

Guiding Principle:
  🎯 AUTOMATION - Preprocessing enables scalable training
```

---

## Part 5: Guiding Principles Summary

### The 7 Principles of DPO Preprocessing

```
┌────────────────────────────────────────────────────────────┐
│ 1. COHERENCE                                                │
│    Include tree history so predictions respect context     │
│    Example: Supply ↓ → Prices ↑ (not Prices ↓)            │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ 2. PROBABILITY AWARENESS                                    │
│    Track cumulative P(path) to inform predictions          │
│    Example: Rare paths → edge cases, Common paths → mainstream│
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ 3. DIVERSITY                                                │
│    Show siblings to avoid duplicate predictions            │
│    Example: Don't predict what siblings already cover      │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ 4. COMPLETENESS                                             │
│    Include all context model needs (research, sources)     │
│    Example: Full research summary + top 5 sources          │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ 5. CLARITY                                                  │
│    Format prompts with clear structure and examples        │
│    Example: Use headers, bullets, explicit requirements    │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ 6. QUALITY CONTRAST                                         │
│    Chosen must be meaningfully better than rejected        │
│    Example: Δ quality score > 0.3                          │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ 7. TRACEABILITY                                             │
│    Keep metadata for debugging and iteration               │
│    Example: Timestamp, quality scores, model settings      │
└────────────────────────────────────────────────────────────┘
```

### Quality Metrics Explained

```
┌─────────────────────────────────────────────────────────────┐
│ Metric 1: Probability Calibration (30% of score)            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ What: How close do probabilities sum to 1.0?                │
│                                                              │
│ Why: Probabilities must be valid distribution              │
│      sum = 1.05 → model doesn't understand math            │
│      sum = 1.00 → model understands constraints ✓          │
│                                                              │
│ Score: 1 - |sum - 1.0|                                      │
│        1 - |1.02 - 1.0| = 0.98 (excellent)                 │
│        1 - |1.35 - 1.0| = 0.65 (poor)                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Metric 2: Diversity (20% of score)                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ What: Are all predicted events different?                   │
│                                                              │
│ Why: Avoid repetitive predictions                          │
│      ["Supply drops", "Supply decreases"] → Bad            │
│      ["Supply drops", "Prices rise", "Quality falls"] → Good│
│                                                              │
│ Score: unique_events / total_events                         │
│        5 / 5 = 1.0 (all different)                         │
│        3 / 5 = 0.6 (some duplicates)                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Metric 3: Justification Quality (25% of score)              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ What: Do justifications cite research?                      │
│                                                              │
│ Why: Predictions should be grounded in evidence            │
│      "Based on trends" → Bad                                │
│      "Berlin 2020 saw 18% drop (Source 2)" → Good          │
│                                                              │
│ Score: min(avg_justification_length / 200, 1.0)            │
│        min(250 / 200, 1.0) = 1.0 (detailed)                │
│        min(50 / 200, 1.0) = 0.25 (too brief)               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Metric 4: Specificity (25% of score)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ What: Are predictions measurable?                           │
│                                                              │
│ Why: Vague predictions are useless                         │
│      "Things change" → Bad                                  │
│      "Supply drops 15-20% by Q4 2025" → Good               │
│                                                              │
│ Score: count(has_numbers OR has_specific_verbs) / total    │
│        Events with numbers: ["drops 15%", "by 2025"]       │
│        3 / 5 = 0.6                                          │
└─────────────────────────────────────────────────────────────┘

Total Quality Score = 0.3*calib + 0.2*div + 0.25*just + 0.25*spec
                    = 0.3*0.98 + 0.2*1.0 + 0.25*1.0 + 0.25*0.6
                    = 0.294 + 0.2 + 0.25 + 0.15
                    = 0.894 ← Excellent quality!
```

---

## Part 6: The Full Picture

### From Tree Generation to Trained Model

```
┌─────────────────────────────────────────────────────────────┐
│ STAGE 1: Tree Generation (Your Existing System)             │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ User: "NYC rent control"
                            ▼
                    ┌───────────────┐
                    │ Phase 1:      │
                    │ Research      │◄─── DeepSeek V3.1
                    │ (Agentic)     │     + Web Search
                    └───────┬───────┘
                            │
                            │ 5 sources, summary
                            ▼
                    ┌───────────────┐
                    │ Phase 2:      │
                    │ Probability   │◄─── DeepSeek R1
                    │ Synthesis     │     Reasoning
                    └───────┬───────┘
                            │
                            │ 3-5 outcomes
                            ▼
                    ┌───────────────┐
                    │ Tree Built    │
                    │ (in memory)   │
                    └───────┬───────┘
                            │
┌───────────────────────────┼───────────────────────────────┐
│ STAGE 2: DPO Preprocessing (New System)                   │
└───────────────────────────┼───────────────────────────────┘
                            │
                            │ EventNode objects
                            ▼
                ┌────────────────────────┐
                │ Extract Context        │
                │ - Tree history         │
                │ - Cumulative P         │
                │ - Siblings             │
                └───────────┬────────────┘
                            │
                            │ DPOInput
                            ▼
                ┌────────────────────────┐
                │ Format as Prompt       │
                │ - Readable text        │
                │ - Clear structure      │
                └───────────┬────────────┘
                            │
                            │ Prompt string
                            ▼
                ┌────────────────────────┐
                │ Generate Outputs       │
                │ - Output A (temp=0.4)  │
                │ - Output B (temp=0.8)  │
                └───────────┬────────────┘
                            │
                            │ Two outputs
                            ▼
                ┌────────────────────────┐
                │ Rank by Quality        │
                │ - Calculate scores     │
                │ - Choose best          │
                └───────────┬────────────┘
                            │
                            │ Chosen + Rejected
                            ▼
                ┌────────────────────────┐
                │ Export to JSONL        │
                │ - One line per example │
                │ - Standard format      │
                └───────────┬────────────┘
                            │
┌───────────────────────────┼───────────────────────────────┐
│ STAGE 3: Training (Python)                                 │
└───────────────────────────┼───────────────────────────────┘
                            │
                            │ .jsonl file
                            ▼
                ┌────────────────────────┐
                │ Load Dataset           │
                │ - Parse JSONL          │
                │ - Tokenize             │
                └───────────┬────────────┘
                            │
                            │ HuggingFace Dataset
                            ▼
                ┌────────────────────────┐
                │ DPO Training           │
                │ - 3 epochs             │
                │ - β = 0.1              │
                │ - Monitor loss         │
                └───────────┬────────────┘
                            │
                            │ Updated weights
                            ▼
                ┌────────────────────────┐
                │ Fine-tuned Model       │
                │ - Better calibration   │
                │ - More specific        │
                │ - Cites research       │
                └────────────────────────┘
```

---

## Part 7: Before/After Comparison

### What Changes After DPO Training?

```
┌──────────────────────────────────────────────────────────────┐
│ SCENARIO: Predict outcomes after "Supply decreases 15%"      │
└──────────────────────────────────────────────────────────────┘

Input (same for both):
  Tree Path: [Root: "Rent control" → "Supply drops 15%"]
  Research: "Berlin saw 18% drop in 2020..."

╔══════════════════════════════════════════════════════════════╗
║ BEFORE DPO (Base Model)                                      ║
╚══════════════════════════════════════════════════════════════╝

Output:
[
  {
    "event": "Housing market becomes more difficult",
    "probability": 0.6,
    "justification": "Supply decreases generally lead to challenges",
    "sentiment": -30
  },
  {
    "event": "Some changes in construction",
    "probability": 0.4,
    "justification": "Developers may respond to policy",
    "sentiment": -10
  }
]

Problems:
  ❌ Probabilities: 0.6 + 0.4 = 1.0 ✓ BUT only 2 outcomes (should be 3-5)
  ❌ Vague: "more difficult", "some changes"
  ❌ No specifics: No numbers, dates, or magnitudes
  ❌ Weak citations: "generally lead", "may respond"
  ❌ No research: Doesn't use Berlin data provided

Quality Score: 0.42

╔══════════════════════════════════════════════════════════════╗
║ AFTER DPO (Fine-tuned Model)                                 ║
╚══════════════════════════════════════════════════════════════╝

Output:
[
  {
    "event": "New construction permits decline 35-45% within 18 months",
    "probability": 0.45,
    "justification": "Berlin's 2020 rent cap led to 45% permit reduction in 18 months, similar Stockholm pattern showed 40% decline",
    "sentiment": -55
  },
  {
    "event": "Average unit sizes decrease 10-15% as developers optimize floor plans",
    "probability": 0.25,
    "justification": "Stockholm data shows developers minimize square footage to maximize unit count under price controls",
    "sentiment": -30
  },
  {
    "event": "Landlord maintenance spending drops 15-25%",
    "probability": 0.20,
    "justification": "ROI constraints reduce incentive for upkeep, documented in Berlin post-freeze analysis",
    "sentiment": -45
  },
  {
    "event": "Conversion of rental units to condos increases 20%",
    "probability": 0.10,
    "justification": "Exit strategy observed in both Berlin and San Francisco rent control implementations",
    "sentiment": -40
  }
]

Improvements:
  ✅ Probabilities: Sum to 1.0 exactly, 4 well-distributed outcomes
  ✅ Specific: "35-45%", "within 18 months", "10-15%"
  ✅ Measurable: All predictions have quantified magnitudes
  ✅ Research-backed: Every justification cites Berlin/Stockholm data
  ✅ Coherent: All outcomes logically follow from supply decrease

Quality Score: 0.91 (2.2x improvement!)
```

---

## Part 8: Key Takeaways

### Why This Preprocessing Matters

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Context is Everything                                     │
│                                                              │
│    Without tree history:                                     │
│      Model sees: "Predict after 'Supply drops 15%'"         │
│      Missing: WHY supply dropped (rent control policy)      │
│                                                              │
│    With tree history:                                        │
│      Model sees: Full path from root cause                  │
│      Result: Coherent, contextual predictions ✓             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2. Quality Contrast Drives Learning                         │
│                                                              │
│    Weak pairs (Δ quality < 0.1):                            │
│      Model: "These look the same, no preference"            │
│      Learning: Minimal                                       │
│                                                              │
│    Strong pairs (Δ quality > 0.3):                          │
│      Model: "This one is clearly better!"                   │
│      Learning: Strong signal, fast improvement ✓            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 3. Automation Enables Scale                                 │
│                                                              │
│    Manual: Label 1000 examples → weeks of human time        │
│                                                              │
│    Automated: Generate 1000 pairs → run overnight           │
│      - Model comparison                                      │
│      - Quality scoring                                       │
│      - Format conversion                                     │
│      Result: Can iterate quickly ✓                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 4. Metrics Guide Improvement                                │
│                                                              │
│    Track: Calibration, Diversity, Justification, Specificity│
│                                                              │
│    Before training: Baseline scores                         │
│    After training: Compare improvements                     │
│    Targeted collection: Focus on weak areas                 │
│                                                              │
│    Result: Continuous improvement loop ✓                    │
└─────────────────────────────────────────────────────────────┘
```

### The DPO Advantage for PsychoHistory

```
Traditional Supervised Learning:
  "Here are good examples, reproduce them"
  → Model memorizes patterns
  → Doesn't understand WHY they're good

DPO:
  "Here's a good example vs. a bad example"
  → Model learns PREFERENCE
  → Understands what makes quality
  → Generalizes better to new scenarios

Perfect for PsychoHistory because:
  ✓ Clear quality criteria (calibration, specificity, etc.)
  ✓ Easy to generate pairs (temperature variation)
  ✓ Relative ranking (easier than absolute scoring)
  ✓ Tree structure needs consistency (learned through context)
```

---

## Summary

You now understand:

1. **RL** = Teaching models preferences, not just patterns
2. **DPO** = Simpler alternative to RLHF, direct optimization
3. **Preprocessing** = Transform messy reality → clean training data
4. **Why each step** = Coherence, diversity, quality contrast

The preprocessing pipeline ensures your model learns to:
- Use tree history for coherent predictions
- Balance probabilities correctly
- Cite research evidence
- Make specific, measurable forecasts

**Next step**: Run `npm install && npm run dpo:collect` to see it in action!
