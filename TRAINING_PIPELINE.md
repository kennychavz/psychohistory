# PsychoHistory Training Pipeline

**Goal:** Train a model to output accurate probability trees by learning from historical events with known outcomes.

## Core Concept

Just like training GPT:
- **GPT:** Input = "The cat sat on the" → Output = P(token) → Ground truth = "mat" → Loss = -log(P(mat))
- **PsychoHistory:** Input = "Brexit vote passes" → Output = P(event tree) → Ground truth = "Article 50 triggered" → Loss = -log(P(Article 50))

---

## Pipeline Architecture

```
┌─────────────────┐
│  Data Factory   │  Generate historical cases (2018-2022)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Training Data  │  JSONL: seed → outcome_chain
└────────┬────────┘
         │
         ├──────────────┬──────────────┐
         ▼              ▼              ▼
    ┌────────┐    ┌────────┐    ┌─────────┐
    │  SFT   │    │  GRPO  │    │  Eval   │
    │ Rank64 │───▶│ Rank 4 │───▶│Pipeline │
    └────────┘    └────────┘    └─────────┘
         │              │              │
         ▼              ▼              ▼
    ┌─────────────────────────────────┐
    │   Hot-Swappable Inference       │
    │   (baseline vs LoRA heads)      │
    └─────────────────────────────────┘
```

---

## 1. Data Format

### Input: Historical Case Study
```json
{
  "case_id": "brexit_2016",
  "seed_event": "Brexit vote passes",
  "seed_date": "2016-06-23",
  "context": "52% leave, 48% remain, unexpected result",
  "domain": "Geopolitics",
  "outcome_chain": [
    {
      "depth": 1,
      "event": "Article 50 triggered",
      "date": "2017-03-29",
      "timeframe_months": 9
    },
    {
      "depth": 2,
      "event": "Theresa May resigns",
      "date": "2019-07-24",
      "timeframe_months": 28
    },
    {
      "depth": 3,
      "event": "Boris Johnson becomes PM",
      "date": "2019-07-24",
      "timeframe_months": 0
    }
  ]
}
```

### Model Output: Probability Tree
```typescript
{
  event: "Brexit vote passes",
  probability: 1.0,
  children: [
    {
      event: "Article 50 triggered",
      probability: 0.65,
      children: [
        { event: "Theresa May resigns", probability: 0.40 },
        { event: "Trade deal signed", probability: 0.35 },
        { event: "Extension granted", probability: 0.25 }
      ]
    },
    { event: "Second referendum called", probability: 0.20 },
    { event: "Brexit cancelled", probability: 0.15 }
  ]
}
```

---

## 2. Loss Calculation

### Algorithm
```typescript
function calculateLoss(predictedTree, actualChain) {
  let totalLoss = 0;

  for (const actualEvent of actualChain) {
    // Get all predicted nodes at this depth
    const nodesAtDepth = getNodesAtDepth(predictedTree, actualEvent.depth);

    // Find best match (semantic similarity or LLM judge)
    const match = findBestMatch(actualEvent.event, nodesAtDepth);

    if (match) {
      // Cross-entropy: -log(P(what actually happened))
      totalLoss += -Math.log(Math.max(match.probability, 0.001));
    } else {
      // Penalty if model didn't predict this event at all
      totalLoss += -Math.log(0.001); // ~6.9
    }
  }

  return totalLoss / actualChain.length;
}
```

### Perplexity
```
Perplexity = e^(average_loss)
```
- Perplexity of 1.0 = perfect prediction
- Perplexity of 10 = as confused as if 10 equally likely outcomes

---

## 3. Training Phases

### Phase 1: Supervised Fine-Tuning (SFT)
**Goal:** Learn to predict events that actually happened

**Config:**
- **LoRA Rank:** 64 (higher for learning new patterns)
- **Target Modules:** All layers (Thinking Machines recommendation)
- **Learning Rate:** 3e-4 (10x higher than full fine-tuning)
- **GPU:** 1x A100 (24GB for rank 64)
- **Duration:** ~2-3 hours for 100 cases
- **Cost:** ~$6-9

**Expected Improvement:**
- Before: Perplexity ~8.5 (hedged, uniform probabilities)
- After: Perplexity ~2.8 (confident, specific events)

### Phase 2: Group Relative Policy Optimization (GRPO)
**Goal:** Multi-objective optimization (calibration + diversity + sharpness)

**Config:**
- **LoRA Rank:** 4 (ultra-low! RL needs minimal capacity)
- **Target Modules:** All layers
- **Learning Rate:** 5e-4
- **GPU:** 1x A10G (12GB sufficient for rank 4)
- **Duration:** ~3-4 hours for 100 cases
- **Cost:** ~$2-3

**Algorithm:**
```python
for batch in dataset:
    # Generate 4-8 trees per seed
    trees = [generate_tree(batch.seed) for _ in range(4)]

    # Score each tree
    scores = [
      0.4 * calibration_score(tree, batch.actual) +
      0.2 * sharpness_score(tree) +
      0.2 * diversity_score(tree) +
      0.2 * coherence_score(tree)
      for tree in trees
    ]

    # GRPO: normalize within group
    baseline = mean(scores)
    advantages = [s - baseline for s in scores]

    # Update policy to favor high-advantage trees
    loss = grpo_loss(trees, advantages)
    loss.backward()
```

**Expected Improvement:**
- Before GRPO: Perplexity ~2.8
- After GRPO: Perplexity ~1.9 (sharper, better calibrated)

---

## 4. Evaluation Pipeline

### Metrics Tracked

```typescript
interface EvaluationMetrics {
  // Core accuracy
  loss: number;                    // Cross-entropy loss
  perplexity: number;              // e^loss

  // Match quality (sanity check)
  match_coverage: {
    exact_matches: number;         // Event found verbatim
    semantic_matches: number;      // Found via embedding similarity
    llm_matches: number;           // Found via LLM judge
    no_matches: number;            // Not found (penalty applied)
    match_rate: number;            // (total matches / total events)
  };

  // Calibration
  brier_score: number;             // (forecast - outcome)^2

  // Per-depth breakdown
  depth_metrics: {
    [depth: number]: {
      loss: number;
      perplexity: number;
      match_rate: number;
    }
  };
}
```

### Importance of Match Coverage
**Why:** Verify that semantic matcher (embeddings + LLM judge) is working correctly.

**Red flags:**
- `no_matches > 20%` → Matcher is too strict, missing valid predictions
- `llm_matches > 80%` → Over-relying on LLM judge, embeddings not working
- `exact_matches > 50%` → Model memorizing training data verbatim

---

## 5. Hot-Swappable Inference

### Architecture
```typescript
class ProbabilityTreeInference {
  private baseModel: Model;
  private currentAdapter: LoRAAdapter | null;

  async loadAdapter(adapterPath: string) {
    // Load LoRA weights without reloading base model
    this.currentAdapter = await LoRAAdapter.load(adapterPath);
  }

  async generateTree(seed: SeedInput, useBaseline = false) {
    const model = useBaseline
      ? this.baseModel
      : this.baseModel.withAdapter(this.currentAdapter);

    return await this.treeBuilder.build(seed, model);
  }
}
```

### Usage
```typescript
const inference = new ProbabilityTreeInference("deepseek/deepseek-r1");

// Baseline evaluation
await inference.loadAdapter(null);
const baselineTree = await inference.generateTree(seed);

// SFT evaluation
await inference.loadAdapter("/models/sft-checkpoint");
const sftTree = await inference.generateTree(seed);

// GRPO evaluation
await inference.loadAdapter("/models/grpo-checkpoint");
const grpoTree = await inference.generateTree(seed);

// Compare all three apples-to-apples
compare([baselineTree, sftTree, grpoTree], groundTruth);
```

---

## 6. Modal Implementation

### Volume Structure
```
/data
  /raw                    # Synthetic data for testing
    /synthetic_cases.jsonl
  /processed              # Real historical data (future)
    /train.jsonl
    /val.jsonl
    /test.jsonl

/models
  /base                   # Base model cache
  /sft                    # SFT checkpoints
    /checkpoint-100/
    /checkpoint-200/
  /grpo                   # GRPO checkpoints
    /checkpoint-50/
```

### Key Patterns

**1. Shared Volume (avoid re-downloading models)**
```python
volume = modal.Volume.from_name("psychohistory-data", create_if_missing=True)
```

**2. Secrets Management**
```python
secrets=[
  modal.Secret.from_name("huggingface"),
  modal.Secret.from_name("openrouter")
]
```

**3. GPU Selection**
```python
# SFT: Needs memory for rank 64
gpu=modal.gpu.A100(memory=40)

# GRPO: Low rank = low memory
gpu=modal.gpu.A10G(memory=24)
```

---

## 7. Success Metrics

### Training Progress

| Checkpoint | Perplexity | Brier Score | Match Rate | Status |
|------------|------------|-------------|------------|--------|
| Baseline   | 8.5        | 0.45        | 35%        | ❌ Poor |
| SFT-100    | 4.2        | 0.28        | 68%        | ⚠️ Improving |
| SFT-200    | 2.8        | 0.18        | 82%        | ✅ Good |
| GRPO-50    | 2.1        | 0.12        | 85%        | ✅✅ Great |
| GRPO-100   | 1.9        | 0.10        | 87%        | 🎯 Excellent |

### Production Ready When:
- Perplexity < 2.5
- Brier Score < 0.15
- Match Rate > 80%
- Depth 3+ match rate > 70%

---

## 8. Next Steps

1. ✅ Generate synthetic data (10-20 cases)
2. ⏳ Implement training loop with synthetic data
3. ⏳ Build evaluation pipeline
4. ⏳ Deploy to Modal
5. ⏳ Test hot-swapping
6. 🔮 Scale to real historical data (100+ cases)

---

## Cost Projection

### Development (Synthetic Data)
- SFT training (10 cases): ~$2
- GRPO training (10 cases): ~$1
- Evaluation runs (5x): ~$1
- **Total:** ~$4

### Production (100 Real Cases)
- Data collection: $50 (LLM API calls for Brainstormer/Chronicler)
- SFT training: ~$6
- GRPO training: ~$3
- Evaluation: ~$2
- **Total:** ~$61

### Per-Inference Cost
- Single tree generation: ~$0.02
- 1000 trees/day: ~$20/day
- With caching: ~$5/day

---

## Key Insights

1. **RL needs rank 1-8** (Thinking Machines paper) → GRPO is cheap!
2. **SFT is most important** → Get calibration right first
3. **Match coverage is critical** → Verify matcher isn't broken
4. **Hot-swapping enables A/B testing** → Compare baseline vs trained
5. **Perplexity is the north star** → Single metric to optimize
