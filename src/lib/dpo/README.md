# DPO Training System for PsychoHistory

This directory contains the complete DPO (Direct Preference Optimization) preprocessing and training pipeline for the PsychoHistory probability tree system.

## 📁 Files Overview

### Core Modules

1. **`dpo-preprocessor.ts`** - Core preprocessing functions
   - Builds tree history from root to current node
   - Calculates cumulative probabilities
   - Extracts sibling context
   - Formats data for training
   - Quality metrics calculation

2. **`preference-collector.ts`** - Preference pair generation
   - Model comparison strategy
   - Temperature sweep strategy
   - Human feedback integration
   - Temporal validation (compare to actual outcomes)
   - Ensemble disagreement

3. **`enhanced-node-processor.ts`** - Research data capture
   - Extends standard node processing
   - Returns both children AND research data
   - Batch processing with rate limiting
   - DPO-ready output format

### Scripts

4. **`/scripts/collect-dpo-examples.ts`** - Data collection CLI
   - End-to-end data collection
   - Multiple seed events
   - JSONL export for training
   - Statistics and reporting

### Documentation

5. **`/DPO_GUIDE.md`** - Comprehensive guide
   - What is DPO?
   - Why use it for PsychoHistory?
   - Step-by-step implementation
   - Training code examples
   - Best practices

---

## 🚀 Quick Start

### 1. Collect Training Data

```bash
# Install TypeScript execution tool
npm install -g tsx

# Run collection with model comparison (easiest)
npx tsx scripts/collect-dpo-examples.ts --strategy model_comparison --seeds 3

# Or with temperature sweep (higher quality)
npx tsx scripts/collect-dpo-examples.ts --strategy temperature_sweep --seeds 5 --output my_data.jsonl
```

This will:
- Process 3-5 seed events
- Generate probability trees
- Collect preference pairs at each node
- Export to `dpo_training_data.jsonl`

### 2. Review the Data

```bash
# Check the pretty-printed version
cat dpo_training_data_pretty.json | less
```

Verify:
- ✅ Chosen outputs are higher quality than rejected
- ✅ Tree history is included in inputs
- ✅ Probabilities sum to ~1.0
- ✅ Justifications cite research

### 3. Train the Model

See [`DPO_GUIDE.md`](../../DPO_GUIDE.md) for full training instructions.

Quick version:

```python
# train.py
from transformers import AutoModelForCausalLM, AutoTokenizer
from trl import DPOTrainer, DPOConfig
import json

# Load data
def load_jsonl(path):
    with open(path) as f:
        return [json.loads(line) for line in f]

train_data = load_jsonl("dpo_training_data.jsonl")

# Setup model
model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.3-70B-Instruct")
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.3-70B-Instruct")

# Configure DPO
config = DPOConfig(
    output_dir="./psychohistory-dpo",
    num_train_epochs=3,
    per_device_train_batch_size=2,
    learning_rate=5e-7,
    beta=0.1,
)

# Train
trainer = DPOTrainer(
    model=model,
    args=config,
    train_dataset=train_data,
    tokenizer=tokenizer,
)

trainer.train()
```

---

## 💡 Usage Examples

### Example 1: Collect from Custom Seeds

```typescript
import { collectDPOData } from './scripts/collect-dpo-examples';
import { SeedInput } from './src/types/tree';

const customSeeds: SeedInput[] = [
  {
    event: 'Your custom event here',
    context: 'Additional context',
    timeframe: '6 months',
    maxDepth: 2,
    domain: 'policy',
  },
];

await collectDPOData(customSeeds, 'model_comparison', 'custom_data.jsonl');
```

### Example 2: Manual Preference Collection

```typescript
import { nodeToDPOInput } from './src/lib/dpo/dpo-preprocessor';
import { collectByModelComparison } from './src/lib/dpo/preference-collector';

// After processing a node
const dpoInput = nodeToDPOInput(node, nodeMap, researchData, timeframe);

// Collect preference pair
const example = await collectByModelComparison(
  dpoInput,
  treeId,
  node.id
);

console.log('Chosen quality:', calculateOutputQuality(example.chosen.outcomes, dpoInput));
console.log('Rejected quality:', calculateOutputQuality(example.rejected.outcomes, dpoInput));
```

### Example 3: Human Feedback Collection

```typescript
import { collectByHumanFeedback } from './src/lib/dpo/preference-collector';

// Generate candidate outputs
const outputA = await generateOutput(input, { temp: 0.5 });
const outputB = await generateOutput(input, { temp: 0.7 });

// Show to human, collect feedback
const humanChoice = await showToHuman([outputA, outputB]);

// Create training example
const example = await collectByHumanFeedback(
  input,
  [outputA, outputB],
  {
    chosenOutputId: humanChoice.id,
    rating: 5,
    comments: "Better research citations",
  },
  treeId,
  nodeId
);
```

### Example 4: Temporal Validation (Advanced)

```typescript
import { collectByActualOutcome } from './src/lib/dpo/preference-collector';

// After 6 months, check what happened
const actualOutcome = {
  event: "Rent prices increased 15% despite controls",
  timeOccurred: new Date('2025-06-15'),
};

// Compare historical predictions
const example = collectByActualOutcome(
  historicalInput,
  [predictionA, predictionB, predictionC],
  actualOutcome,
  treeId,
  nodeId
);

// This creates a training pair where the closest prediction is "chosen"
```

---

## 📊 Data Format

### Input Structure

```typescript
{
  parentEvent: string;           // Current node event
  depth: number;                 // Tree depth (0-5)
  pathFromRoot: PathNode[];      // Full ancestry
  cumulativeProbability: number; // P(this path)
  siblings: SiblingNode[];       // Other branches
  researchSummary: string;       // Research findings
  sources: Source[];             // Citations
  queriesExecuted: string[];     // Search queries
}
```

### Output Structure

```typescript
{
  outcomes: [
    {
      event: "Specific prediction",
      probability: 0.42,
      justification: "Evidence from Source 1...",
      sentiment: -30
    }
  ],
  modelInfo: {
    model: "deepseek/deepseek-r1",
    temperature: 0.6,
    timestamp: Date
  }
}
```

### Training Example (JSONL)

```json
{
  "prompt": "# Probability Tree Analysis\n\n## Tree Path History...",
  "chosen": "[{\"event\": \"GDP slows to 1.2%\", ...}]",
  "rejected": "[{\"event\": \"Economy changes\", ...}]",
  "metadata": {...}
}
```

---

## 🎯 Quality Metrics

The system automatically scores outputs on:

1. **Probability Calibration** (30%)
   - How close probabilities sum to 1.0
   - Target: |sum - 1.0| < 0.01

2. **Diversity** (20%)
   - Unique events predicted
   - Target: All different events

3. **Justification Quality** (25%)
   - Length and detail
   - Research citations
   - Target: 150-300 chars with sources

4. **Specificity** (25%)
   - Numbers, dates, magnitudes
   - Avoid vague language
   - Target: Measurable outcomes

---

## 🔄 Recommended Workflow

### Phase 1: Initial Collection (Week 1)
- Collect 200-500 examples using model comparison
- Use diverse seed events (economics, policy, technology)
- Review 10% manually for quality

### Phase 2: Quality Refinement (Week 2)
- Add temperature sweep for high-value nodes
- Collect human feedback on 50-100 examples
- Filter low-quality pairs (quality score < 0.5)

### Phase 3: First Training Run (Week 3)
- Train on 500-1000 high-quality examples
- Use 10% for validation
- Monitor: loss curves, calibration metrics

### Phase 4: Evaluation & Iteration (Week 4)
- Generate test trees with fine-tuned model
- Compare to baseline (original model)
- Collect more data where model struggles
- Retrain with combined dataset

---

## 🐛 Troubleshooting

### "Chosen and rejected are too similar"
- Increase temperature difference
- Use different models (e.g., GPT-4 vs Claude)
- Add more diverse generation strategies

### "Probabilities don't sum to 1.0"
- Check normalization in `probability-analyzer.ts`
- Increase quality threshold in filtering
- Add post-processing normalization step

### "Low diversity in predictions"
- Increase temperature in generation
- Add diversity bonus to quality scoring
- Use ensemble method to filter groupthink

### "Training loss not decreasing"
- Check data format (must match TRL expectations)
- Reduce learning rate (try 1e-7)
- Increase beta parameter (0.1 → 0.3)

---

## 📚 Additional Resources

- **Main Guide**: [`/DPO_GUIDE.md`](../../DPO_GUIDE.md)
- **DPO Paper**: https://arxiv.org/abs/2305.18290
- **TRL Docs**: https://huggingface.co/docs/trl/dpo_trainer
- **HuggingFace Datasets**: https://huggingface.co/docs/datasets/

---

## 🤝 Contributing

To add new collection strategies:

1. Add method to `preference-collector.ts`
2. Update CLI in `scripts/collect-dpo-examples.ts`
3. Document in `DPO_GUIDE.md`
4. Add tests (TODO: test suite)

---

## ⚡ Performance Tips

- **Rate Limiting**: The system adds 1-2s delays to avoid API limits
- **Batching**: Process multiple nodes concurrently (default: 5)
- **Caching**: Research results could be cached by query hash
- **Filtering**: Remove low-quality pairs before training (quality < 0.5)

---

Happy training! Start with the Quick Start section above and refer to the main guide for detailed explanations.
