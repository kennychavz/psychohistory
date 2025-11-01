# DPO Preprocessing Cheatsheet
## Quick Visual Reference for Data Transformations

---

## The 9-Step Transformation Pipeline

```
Raw EventNode → DPOInput → Prompt → Training Pair → Model Weights
     (JS)         (JS)      (Text)      (JSONL)       (Tensors)
```

---

## STEP 0 → STEP 1: Node to Context

```typescript
// INPUT: EventNode (from your tree)
{
  id: "abc123",
  event: "NYC rent control",
  children: [...],        // ← TRANSFORM to existingChildren
  parent: {...},          // ← TRANSFORM to pathFromRoot
  probability: 1.0,       // ✓ Keep
  depth: 0,              // ✓ Keep
  sources: [...],        // ✓ Keep
  ...50 other fields...  // ← Ignore (metadata)
}

                    ↓ buildTreeHistory()      (parent → pathFromRoot)
                    ↓ calculateCumulativeProbability()
                    ↓ extractSiblings()       (parent.children → siblings)
                    ↓ extractChildren()        (node.children → existingChildren)

// OUTPUT: DPOInput (clean structure)
{
  parentEvent: "NYC rent control",
  depth: 0,
  pathFromRoot: [{...}],           // ← PARENT transformed to ancestry
  cumulativeProbability: 1.0,      // ← Calculated from path
  siblings: [],                     // ← PARENT.children transformed
  existingChildren: [...],         // ← CHILDREN transformed
  researchSummary: "...",          // ← Evidence added
  sources: [{...}, {...}],         // ← Filtered: top 5
}
```

**Why**: Transform object refs → serializable context, flatten structure

### 🔑 KEY INSIGHT: We DON'T Ignore Parent/Children!

We TRANSFORM them:
- `node.parent` → `pathFromRoot` (full ancestry chain)
- `parent.children` → `siblings` (lateral context, other branches)
- `node.children` → `existingChildren` (downward context, what's explored)

**Why transform instead of direct references?**
1. **Serialization**: Circular refs break `JSON.stringify()`
2. **Model needs text**: Can't understand memory pointers
3. **Richer context**: Full path > immediate parent

---

## WHY Transform Parent/Children? (Deep Dive)

### Problem: Circular References

```typescript
// ❌ Direct references DON'T WORK
EventNode {
  parent: EventNode {              // Points to parent
    children: [this, ...]          // Parent points back to child
  },
  children: [
    EventNode { parent: this }     // Child points back to parent
  ]
}

JSON.stringify(node)
// Error: Converting circular structure to JSON
// parent → child → parent → child → ∞


// ✅ Transformed context WORKS
{
  pathFromRoot: [
    {event: "Parent", p: 1.0},     // Just data, no pointers
    {event: "Current", p: 0.5}
  ],
  siblings: [
    {event: "Sibling", p: 0.3}     // Just data
  ],
  existingChildren: [
    {event: "Child", p: 0.6}       // Just data
  ]
}

JSON.stringify(context)  // ✓ Success!
```

### Solution: Extract Meaning, Not Pointers

```
┌────────────────────────────────────────────────────────┐
│ What Object References Give Us:                        │
├────────────────────────────────────────────────────────┤
│ node.parent → EventNode@0x7f8a (memory address)       │
│                                                        │
│ Model sees: ??? (meaningless)                         │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ What Transformed Context Gives Us:                     │
├────────────────────────────────────────────────────────┤
│ pathFromRoot → "Rent control → Supply drops → Current"│
│                                                        │
│ Model sees: "Ah! Causality chain. Supply dropped      │
│              BECAUSE of rent control. My prediction   │
│              should respect this relationship."        │
└────────────────────────────────────────────────────────┘
```

### Visual: Complete Tree Transformation

```
RAW TREE (JavaScript Object Graph):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                  Grandparent
                      ↑ node.parent.parent
                  Parent
                  ↑     ↓ parent.children
      ┌───────────┼───────────┐
      ↑           ↑           ↑
  Sibling1   **Current**   Sibling2
                  ↓ node.children
              ┌───┴───┐
              ↓       ↓
           Child1   Child2


TRANSFORMED CONTEXT (Model-Friendly):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DPOInput {
  // UPWARD: Parent chain
  pathFromRoot: [
    {event: "Grandparent", p: 1.0, depth: 0},
    {event: "Parent", p: 0.6, depth: 1},
    {event: "Current", p: 0.45, depth: 2}
  ],

  // LATERAL: Siblings (from parent.children)
  siblings: [
    {event: "Sibling1", p: 0.30},
    {event: "Sibling2", p: 0.25}
  ],

  // DOWNWARD: Children (from node.children)
  existingChildren: [
    {event: "Child1", p: 0.55, numDescendants: 3},
    {event: "Child2", p: 0.45, numDescendants: 1}
  ]
}
```

---

## STEP 1 → STEP 2: Context to Prompt

**What happens**: Convert JavaScript object → human-readable text the model can understand

**Why**: Language models are trained on TEXT (words, sentences), not JSON objects

### Concrete Example:

```typescript
// INPUT: DPOInput object (from Step 1)
{
  parentEvent: "Rental supply decreases 15-20%",
  depth: 1,
  pathFromRoot: [
    {
      event: "NYC implements strict rent control",
      probability: 1.0,
      sentiment: 0,
      depth: 0,
      justification: "Policy decision by city council"
    },
    {
      event: "Rental supply decreases 15-20%",
      probability: 0.45,
      sentiment: -40,
      depth: 1,
      justification: "Berlin 2020 rent cap led to 18% reduction"
    }
  ],
  cumulativeProbability: 0.45,
  siblings: [
    {event: "Black market rentals increase 25%", probability: 0.35, sentiment: -60},
    {event: "Political backlash leads to policy reversal", probability: 0.20, sentiment: 10}
  ],
  existingChildren: [],
  researchSummary: "Historical analysis shows Berlin's 2020 rent freeze led to 18% supply reduction within 12 months. Stockholm's 1994 rent control resulted in similar patterns...",
  sources: [
    {
      url: "https://example.com/berlin-study",
      title: "Berlin Rent Cap: 2020-2022 Analysis",
      snippet: "The rent freeze resulted in 18% fewer listings..."
    }
  ],
  queriesExecuted: ["rent control supply effects", "Berlin rent cap 2020"]
}

        ↓ formatDPOPrompt() - turns object fields into readable paragraphs

// OUTPUT: Multi-line text string (what the model actually sees)
`# Probability Tree Analysis Task

## Tree Path History (Root to Current Node)
[Depth 0] NYC implements strict rent control (p=1.00, sentiment=0)
  [Depth 1] Rental supply decreases 15-20% (p=0.45, sentiment=-40)

Cumulative Probability of This Path: 0.4500

## Sibling Branches at Current Level
  - Black market rentals increase 25% (p=0.35, sentiment=-60)
  - Political backlash leads to policy reversal (p=0.20, sentiment=10)

## Existing Children (Already Explored Below This Node)
  (No children yet - this is a leaf node)

## Current Node Details
Event: Rental supply decreases 15-20%
Depth: 1/5
Timeframe: 6-12 months
Sentiment: -40
Category: policy

## Research Context
Queries Executed:
  1. rent control supply effects
  2. Berlin rent cap 2020

Research Summary:
Historical analysis shows Berlin's 2020 rent freeze led to 18% supply
reduction within 12 months. Stockholm's 1994 rent control resulted in
similar patterns...

Sources (1 total):
  1. Berlin Rent Cap: 2020-2022 Analysis
     The rent freeze resulted in 18% fewer listings...

## Task
Based on the tree history, research findings, sibling context, and existing
children above, predict 1-5 possible next events.

Requirements:
- Probabilities must sum to 1.0
- Justify each prediction using research evidence
- Assign sentiment from -100 to 100
- Make events specific and measurable
- Consider the cumulative path context
- Avoid duplicating what siblings already cover

Output format:
[{"event": "...", "probability": 0.x, "justification": "...", "sentiment": x}]
`
```

**Key transformations**:
1. `pathFromRoot` array → indented tree visualization
2. `siblings` array → bulleted list
3. `sources` array → numbered list with titles
4. All metadata → organized sections with headers
5. Adds instructions for the model at the end

---

## STEP 2 → STEP 3: Prompt to Outputs

**What happens**: Send the same prompt to the model TWICE with different settings (temperature), get two different quality outputs

**Why**: DPO needs pairs (chosen vs rejected). We generate both by varying how "creative" vs "conservative" the model is.

### Concrete Example:

```typescript
// INPUT: The prompt from Step 2 (shown above)

const prompt = `# Probability Tree Analysis Task\n\n...` // Full prompt

// Generate OUTPUT A: Low temperature = more conservative, precise
await analyzeProbabilities(prompt, {
  temperature: 0.4,  // ← Low temp = less random, more focused on likely outcomes
  model: "deepseek/deepseek-r1"
})

                    ↓ Model generates predictions

// OUTPUT A (Conservative, High Quality):
{
  outcomes: [
    {
      event: "New construction permits decrease 35-45% within 18 months",
      probability: 0.50,
      justification: "Berlin saw 45% permit drop in 18 months post-cap (Source 1), similar Stockholm pattern showed 40% decline",
      sentiment: -55
    },
    {
      event: "Average apartment unit size decreases 10-15% as developers optimize",
      probability: 0.30,
      justification: "Stockholm data shows developers minimize square footage to maximize unit count under price controls",
      sentiment: -30
    },
    {
      event: "Landlord maintenance spending drops 15-25%",
      probability: 0.20,
      justification: "ROI constraints reduce incentive for upkeep, documented in Berlin post-freeze analysis",
      sentiment: -45
    }
  ],
  modelInfo: {
    model: "deepseek/deepseek-r1",
    temperature: 0.4,
    timestamp: "2025-01-15T10:30:00Z"
  }
}

// Calculate quality score
Quality Score A: 0.89
  ✓ Probabilities: 0.50 + 0.30 + 0.20 = 1.00 (perfect!)
  ✓ Specificity: Has "35-45%", "18 months", "10-15%" (numbers!)
  ✓ Citations: References "Source 1", "Stockholm data", "Berlin post-freeze"
  ✓ Diversity: 3 different angles (permits, unit size, maintenance)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Generate OUTPUT B: High temperature = more creative, random
await analyzeProbabilities(prompt, {
  temperature: 0.9,  // ← High temp = more random, less focused
  model: "deepseek/deepseek-r1"
})

                    ↓ Model generates predictions

// OUTPUT B (Creative, Low Quality):
{
  outcomes: [
    {
      event: "Housing market situation becomes more challenging",
      probability: 0.65,
      justification: "Rent control policies typically create various market difficulties",
      sentiment: -35
    },
    {
      event: "Some changes in development patterns",
      probability: 0.35,
      justification: "Developers may respond to new policy environment",
      sentiment: -20
    }
  ],
  modelInfo: {
    model: "deepseek/deepseek-r1",
    temperature: 0.9,
    timestamp: "2025-01-15T10:30:05Z"
  }
}

// Calculate quality score
Quality Score B: 0.31
  ✗ Probabilities: 0.65 + 0.35 = 1.00 ✓ BUT only 2 outcomes (should be 3-5)
  ✗ Specificity: "becomes more challenging", "some changes" (vague!)
  ✗ Citations: "typically create", "may respond" (no sources cited)
  ✗ Diversity: Only 2 outcomes, not enough variety
```

**What we now have**:
- Output A: High quality (0.89) - CHOSEN
- Output B: Low quality (0.31) - REJECTED
- Quality gap: 0.58 (large enough to be a strong training signal)

---

## STEP 3 → STEP 4: Outputs to Training Pair

**What happens**: Combine the input prompt + both outputs into a single training example with metadata

**Why**: Package everything together so the training code knows: "for THIS input, prefer THIS output over THAT output"

### Concrete Example:

```typescript
// INPUT: The two outputs from Step 3 + original input from Step 1

// Step 1: Calculate quality scores (already done in Step 3)
const qualityA = 0.89  // Output A score
const qualityB = 0.31  // Output B score

// Step 2: Rank them
const chosen = qualityA > qualityB ? outputA : outputB     // → Output A (0.89)
const rejected = qualityA > qualityB ? outputB : outputA   // → Output B (0.31)

// Step 3: Create complete training example
const dpoExample = createDPOExample(input, chosen, rejected, {
  treeId: "tree_abc123",
  nodeId: "node_xyz789"
})

                    ↓ Package everything together

// OUTPUT: Complete DPOExample
{
  id: "tree_abc123_node_xyz789_1736936700000",  // Unique identifier

  // The input (from Step 1)
  input: {
    parentEvent: "Rental supply decreases 15-20%",
    depth: 1,
    pathFromRoot: [...],
    siblings: [...],
    existingChildren: [],
    researchSummary: "...",
    sources: [...],
    ... // All the context from Step 1
  },

  // The better output (Output A)
  chosen: {
    outcomes: [
      {
        event: "New construction permits decrease 35-45% within 18 months",
        probability: 0.50,
        justification: "Berlin saw 45% permit drop...",
        sentiment: -55
      },
      {
        event: "Average apartment unit size decreases 10-15%...",
        probability: 0.30,
        justification: "Stockholm data shows...",
        sentiment: -30
      },
      {
        event: "Landlord maintenance spending drops 15-25%",
        probability: 0.20,
        justification: "ROI constraints reduce...",
        sentiment: -45
      }
    ],
    modelInfo: {
      model: "deepseek/deepseek-r1",
      temperature: 0.4,
      timestamp: "2025-01-15T10:30:00Z"
    }
  },

  // The worse output (Output B)
  rejected: {
    outcomes: [
      {
        event: "Housing market situation becomes more challenging",
        probability: 0.65,
        justification: "Rent control policies typically...",
        sentiment: -35
      },
      {
        event: "Some changes in development patterns",
        probability: 0.35,
        justification: "Developers may respond...",
        sentiment: -20
      }
    ],
    modelInfo: {
      model: "deepseek/deepseek-r1",
      temperature: 0.9,
      timestamp: "2025-01-15T10:30:05Z"
    }
  },

  // Tracking metadata
  metadata: {
    timestamp: "2025-01-15T10:30:10Z",
    treeId: "tree_abc123",
    nodeId: "node_xyz789",
    metrics: {
      probabilityCalibration: 0.89,  // Chosen output score
      diversityScore: 0.75,
      citationQuality: 0.92
    }
  }
}
```

**What this gives us**:
- Complete training example in one object
- Clear chosen vs rejected pair
- Full context (input) preserved
- Metadata for debugging later
- Ready to export to file

---

## STEP 4 → STEP 5: DPOExample to JSONL

```typescript
// INPUT: DPOExample (nested object)

                    ↓ exportToJSONL()

// OUTPUT: JSONL line (flat)
{"prompt":"# Probability Tree...","chosen":"[{\"event\":\"Supply drops 15%\"...}]","rejected":"[{\"event\":\"Housing changes\"...}]","metadata":{...}}
```

**Why**: Standard ML training format (one example per line)

---

## STEP 5 → STEP 6: JSONL to Dataset

```python
# INPUT: JSONL file

with open('dpo_training_data.jsonl') as f:
    for line in f:
        data = json.loads(line)

                    ↓ load_dataset()

# OUTPUT: HuggingFace Dataset
Dataset({
    features: ['prompt', 'chosen', 'rejected', 'metadata'],
    num_rows: 1000
})
```

**Why**: Training libraries expect Dataset objects

---

## STEP 6 → STEP 7: Dataset to Tokens

```python
# INPUT: Dataset (text)

def tokenize(example):
    return {
        'prompt_ids': tokenizer(example['prompt']),
        'chosen_ids': tokenizer(example['chosen']),
        'rejected_ids': tokenizer(example['rejected'])
    }

dataset = dataset.map(tokenize)

                    ↓

# OUTPUT: Tokenized Dataset (numbers)
{
  'prompt_ids': [1, 45, 234, 567, ...],      # 342 tokens
  'chosen_ids': [89, 123, 456, ...],          # 156 tokens
  'rejected_ids': [12, 345, 678, ...]         # 89 tokens
}
```

**Why**: Models process numbers, not words

---

## STEP 7 → STEP 8: Tokens to Training

```python
# INPUT: Tokenized Dataset

trainer = DPOTrainer(
    model=model,
    train_dataset=dataset,
    beta=0.1
)

trainer.train()  # 3 epochs

                    ↓ Forward pass
                    ↓ Compute loss
                    ↓ Backward pass
                    ↓ Update weights

# OUTPUT: Loss curve
Epoch 1: loss = 0.52
Epoch 2: loss = 0.31
Epoch 3: loss = 0.19  ← Converging!
```

**Why**: Gradient descent optimizes preference

---

## STEP 8 → STEP 9: Training to Improved Model

```python
# INPUT: Model + Loss gradients

                    ↓ Backpropagation
                    ↓ Weight updates

# OUTPUT: Fine-tuned weights

Before:  W[layer_23][neuron_456] = 0.234
After:   W[layer_23][neuron_456] = 0.187

Result: Model now prefers "chosen" style outputs!
```

**Why**: Changed weights = changed behavior

---

## Complete Example: Side-by-Side View

```
┌────────────────────────────────────────────────────────────────────────┐
│                         TRANSFORMATION FLOW                             │
└────────────────────────────────────────────────────────────────────────┘

STEP 0: EventNode in Memory
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EventNode {
  id: "abc123",
  event: "NYC implements rent control",
  probability: 1.0,
  depth: 0,
  children: [
    EventNode { event: "Supply drops 15%", ... },
    EventNode { event: "Black market increases", ... }
  ],
  sources: [{url: "...", title: "Berlin rent cap"}, ...],
  parentId: null
}

                              ↓ nodeToDPOInput()

STEP 1: DPOInput (Structured Context)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  parentEvent: "NYC implements rent control",
  depth: 0,
  pathFromRoot: [
    {event: "NYC implements rent control", probability: 1.0, depth: 0}
  ],
  cumulativeProbability: 1.0,
  siblings: [],
  researchSummary: "Berlin's 2020 rent freeze led to 18% supply reduction...",
  sources: [{url: "...", title: "...", snippet: "..."}],
  queriesExecuted: ["rent control outcomes", "Berlin rent cap 2020"]
}

                              ↓ formatDPOPrompt()

STEP 2: Prompt String (Human-Readable)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Probability Tree Analysis Task

## Tree Path History (Root to Current Node)
[Depth 0] NYC implements rent control (p=1.00, sentiment=0)

Cumulative Probability of This Path: 1.0000

## Sibling Branches at Current Level
  (No siblings - this is a root node)

## Research Context
Queries Executed:
  1. rent control outcomes
  2. Berlin rent cap 2020

Research Summary:
Berlin's 2020 rent freeze led to 18% supply reduction...

## Task
Based on the tree history, research findings, and context above,
predict 1-5 possible next events.

Output format: [{event: "...", probability: 0.x, justification: "...", sentiment: x}]

                              ↓ generateOutput() × 2

STEP 3A: Output A (temp=0.4, Quality=0.89)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[
  {
    "event": "Rental housing supply decreases 15-20% over 24 months",
    "probability": 0.45,
    "justification": "Berlin's 2020 rent cap led to 18% reduction (Source 1), similar to Stockholm's 1994 experience",
    "sentiment": -50
  },
  {
    "event": "Black market rental agreements increase 25-30%",
    "probability": 0.35,
    "justification": "Side-market emergence documented in Berlin and Stockholm cases",
    "sentiment": -60
  },
  {
    "event": "New construction permits drop 40% within 18 months",
    "probability": 0.20,
    "justification": "Developer exit pattern observed in Berlin data (Source 2)",
    "sentiment": -55
  }
]

STEP 3B: Output B (temp=0.9, Quality=0.31)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[
  {
    "event": "Housing situation becomes more difficult",
    "probability": 0.6,
    "justification": "Rent control typically creates challenges",
    "sentiment": -40
  },
  {
    "event": "Some changes in the rental market occur",
    "probability": 0.4,
    "justification": "Markets respond to policy interventions",
    "sentiment": -20
  }
]

                              ↓ createDPOExample()

STEP 4: DPOExample (Training Pair)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  id: "tree_abc_node_xyz_1736936700",
  input: { ...DPOInput from Step 1... },
  chosen: { ...Output A... },      // Quality: 0.89
  rejected: { ...Output B... },    // Quality: 0.31
  metadata: {
    timestamp: "2025-01-15T10:00:00Z",
    treeId: "tree_abc",
    nodeId: "node_xyz",
    metrics: {
      probabilityCalibration: 0.89,
      diversityScore: 0.85,
      citationQuality: 0.92
    }
  }
}

                              ↓ exportToJSONL()

STEP 5: JSONL Line (Training Format)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{"prompt":"# Probability Tree Analysis Task\n\n## Tree Path History...","chosen":"[{\"event\":\"Rental housing supply decreases 15-20% over 24 months\",\"probability\":0.45,...}]","rejected":"[{\"event\":\"Housing situation becomes more difficult\",\"probability\":0.6,...}]","metadata":{...}}

                              ↓ load_dataset() [Python]

STEP 6: HuggingFace Dataset
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dataset({
  features: ['prompt', 'chosen', 'rejected', 'metadata'],
  num_rows: 1000
})

[0] = {
  'prompt': '# Probability Tree Analysis Task...',
  'chosen': '[{"event":"Rental housing supply decreases...',
  'rejected': '[{"event":"Housing situation becomes...',
  'metadata': {...}
}

                              ↓ tokenize()

STEP 7: Tokenized Dataset
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  'prompt_ids': [1, 45, 234, 567, 89, 123, ...],     # 342 tokens
  'chosen_ids': [1, 89, 123, 456, 789, ...],         # 156 tokens
  'rejected_ids': [1, 12, 345, 678, 901, ...]        # 89 tokens
  'attention_mask': [1, 1, 1, 1, 1, 1, ...],
  'labels': [...]
}

                              ↓ DPOTrainer.train()

STEP 8: Training (Forward + Backward Pass)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Batch 1:
  Forward pass:
    π_chosen = 0.12    (model probability of chosen)
    π_rejected = 0.18  (model probability of rejected)

  Compute DPO loss:
    loss = -log(σ(β * (log(0.12) - log(0.18))))
         = -log(σ(0.1 * (-2.12 - -1.71)))
         = -log(σ(-0.041))
         = 0.52

  Backward pass:
    ∇loss/∂W → Update weights to increase π_chosen

Batch 2:
  loss = 0.48  ← Improving!

...

Epoch 3, Batch 500:
  loss = 0.19  ← Converged!

                              ↓ Save model

STEP 9: Fine-tuned Model
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
New behavior:

Input: "# Probability Tree Analysis... predict outcomes"

Before DPO:
  → "Housing situation becomes more difficult" (vague)

After DPO:
  → "Rental housing supply decreases 15-20% over 24 months based on Berlin 2020 data"
    (specific, grounded, measurable)

Success! Model learned to prefer quality outputs.
```

---

## Quality Metrics Quick Reference

```
┌─────────────────────────────────────────────────────────┐
│ Metric              │ Formula          │ Target        │
├─────────────────────┼──────────────────┼───────────────┤
│ Calibration (30%)   │ 1 - |sum - 1.0|  │ > 0.99        │
│ Diversity (20%)     │ unique / total   │ = 1.0         │
│ Justification (25%) │ avg_len / 200    │ > 0.8         │
│ Specificity (25%)   │ has_numbers      │ > 0.6         │
└─────────────────────┴──────────────────┴───────────────┘

Total Quality = Σ(weight × metric)

Good pair:   chosen=0.89, rejected=0.31, Δ=0.58 ✓
Weak pair:   chosen=0.52, rejected=0.48, Δ=0.04 ✗
```

---

## Common Transformations Code

```typescript
// Build tree history
function buildTreeHistory(node: EventNode, nodeMap: Map<string, EventNode>): PathNode[] {
  const path: PathNode[] = [];
  let current = node;
  while (current) {
    path.unshift({event: current.event, probability: current.probability, depth: current.depth});
    current = current.parentId ? nodeMap.get(current.parentId) : undefined;
  }
  return path;
}

// Calculate cumulative probability
function calculateCumulativeProbability(path: PathNode[]): number {
  return path.reduce((acc, node) => acc * node.probability, 1.0);
}

// Extract siblings
function extractSiblings(node: EventNode, nodeMap: Map<string, EventNode>): SiblingNode[] {
  if (!node.parentId) return [];
  const parent = nodeMap.get(node.parentId);
  return parent.children
    .filter(child => child.id !== node.id)
    .map(child => ({event: child.event, probability: child.probability}));
}

// Format prompt
function formatDPOPrompt(input: DPOInput): string {
  return `# Probability Tree Analysis
## Tree Path History
${input.pathFromRoot.map(n => `[Depth ${n.depth}] ${n.event} (p=${n.probability})`).join('\n')}

## Research Summary
${input.researchSummary}

## Task
Predict 1-5 possible next events...`;
}

// Calculate quality
function calculateOutputQuality(output: ProbabilityOutput[], input: DPOInput): number {
  const calibration = 1 - Math.abs(output.reduce((s, o) => s + o.probability, 0) - 1.0);
  const diversity = new Set(output.map(o => o.event)).size / output.length;
  const justification = Math.min(output.reduce((s, o) => s + o.justification.length, 0) / output.length / 200, 1);
  const specificity = output.filter(o => /\d+/.test(o.event)).length / output.length;
  return 0.3*calibration + 0.2*diversity + 0.25*justification + 0.25*specificity;
}
```

---

## File Locations

```
Project Root
│
├── src/lib/dpo/
│   ├── dpo-preprocessor.ts          ← Steps 0-4
│   ├── preference-collector.ts      ← Steps 3-4
│   └── enhanced-node-processor.ts   ← Research capture
│
├── scripts/
│   └── collect-dpo-examples.ts      ← End-to-end pipeline
│
├── dpo_training_data.jsonl          ← Step 5 output
└── dpo_training_data_pretty.json    ← Human-readable sample

Training (Python):
├── train_dpo.py                      ← Steps 6-9
└── fine_tuned_model/                 ← Step 9 output
```

---

## Commands

```bash
# Collect data
npm run dpo:collect                  # Model comparison
npm run dpo:collect:sweep            # Temperature sweep

# Review
npm run dpo:review                   # First 100 lines
cat dpo_training_data_pretty.json    # First 5 examples (formatted)

# Train (Python)
python train_dpo.py --data dpo_training_data.jsonl --epochs 3

# Evaluate
python evaluate.py --baseline gpt4 --finetuned ./fine_tuned_model
```

---

## Quick Diagnostics

```typescript
// Is my data valid?
const examples = loadExamples('dpo_training_data.jsonl');

// Check 1: Quality delta
examples.forEach(ex => {
  const chosenQ = calculateQuality(ex.chosen);
  const rejectedQ = calculateQuality(ex.rejected);
  const delta = chosenQ - rejectedQ;
  if (delta < 0.2) console.warn(`Weak pair: ${ex.id}, delta=${delta}`);
});

// Check 2: Probability calibration
examples.forEach(ex => {
  const sum = ex.chosen.outcomes.reduce((s, o) => s + o.probability, 0);
  if (Math.abs(sum - 1.0) > 0.05) console.warn(`Bad calibration: ${ex.id}, sum=${sum}`);
});

// Check 3: Diversity
examples.forEach(ex => {
  const events = ex.chosen.outcomes.map(o => o.event);
  const unique = new Set(events).size;
  if (unique < events.length) console.warn(`Duplicate events: ${ex.id}`);
});
```

---

## That's It!

The preprocessing pipeline in one page. Refer to:
- **DPO_VISUAL_CONCEPTS.md** for detailed explanations
- **DPO_GUIDE.md** for training instructions
- **src/lib/dpo/README.md** for API reference
