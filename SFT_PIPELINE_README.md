# SFT Classifier Training Pipeline - Quick Start

## What This Does

Processes Polymarket events to generate training data for a binary classifier:
1. Loads 5 historical Polymarket events (with known outcomes)
2. Generates probability trees for each event
3. Extracts all terminal paths
4. Classifies each path (YES/NO)
5. Keeps only paths that matched the actual outcome
6. Saves as SFT training data

---

## Run the Pipeline

```bash
npm run sft:generate
```

This will:
- Process 5 mock Polymarket events
- Generate ~50-200 training examples
- Save 3 files:
  - `sft_classifier_training.jsonl` - Full training dataset
  - `sft_classifier_training_sample.json` - First 10 examples (human-readable)
  - `sft_classifier_statistics.json` - Pipeline statistics

---

## Expected Output

### Console Output
```
🚀 Polymarket SFT Training Data Pipeline
==========================================

📥 Loading Polymarket events...
✓ Loaded 5 events

================================================================================
[1/5] Processing: Will Kamala Harris win the 2024 US Presidential Election?
Actual outcome: NO
================================================================================

🌲 Generating tree for: Will Kamala Harris win the 2024 election?...
  Processing depth 0: Will Kamala Harris win...
  ✓ Generated 3 children
  Processing depth 1: Economic crisis occurs...
  ✓ Generated 2 children
  ...

📊 Extracted 15 terminal paths

Aggregated Prediction:
  P(YES) = 0.4200
  P(NO) = 0.5800
  Predicted: NO | Actual: NO ✓

✓ Correct paths: 9/15 (60.0%)

...

📊 FINAL SUMMARY
================================================================================
Total training examples: 47
Total paths analyzed: 78
Correct paths: 47 (60.26%)

By outcome:
  YES: 18 (38.3%)
  NO: 29 (61.7%)

✅ Pipeline complete!
```

### Generated Files

**sft_classifier_training.jsonl** (one line per example):
```jsonl
{"prompt":"# Binary Event Classification\nQuestion: Will Kamala Harris win the 2024 election?\n[Depth 1] Economic crisis occurs (probability: 0.40)\n[Depth 2] Crisis blamed on Biden (probability: 0.60)\n[Depth 3] Voters swing to Trump (probability: 0.85)\n\nCumulative Path Probability: 0.2040\n\nContext: Historical data shows...\n\nTask: Based on this scenario path, classify whether the original question resolves to YES or NO.\nOutput only: YES or NO","completion":"NO","metadata":{"eventId":"poly_election_2024","pathId":"path_0","cumulativeProbability":0.204,"actualOutcome":"NO","isCorrect":true}}
...
```

**sft_classifier_training_sample.json** (pretty-printed):
```json
[
  {
    "prompt": "# Binary Event Classification\n\nQuestion: Will Kamala Harris win the 2024 US Presidential Election?\n[Depth 1] Economic crisis occurs before November (probability: 0.40)\n[Depth 2] Crisis blamed on Biden administration (probability: 0.60)\n[Depth 3] Voters swing to Trump (probability: 0.85)\n\nCumulative Path Probability: 0.2040\n\nContext: Historical data shows incumbent party loses 85% of time when recession hits within 3 months of election\n\nTask: Based on this scenario path, classify whether the original question resolves to YES or NO.\nOutput only: YES or NO",
    "completion": "NO",
    "metadata": {
      "eventId": "poly_election_2024",
      "pathId": "path_0",
      "cumulativeProbability": 0.204,
      "actualOutcome": "NO",
      "isCorrect": true
    }
  }
]
```

**sft_classifier_statistics.json**:
```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "totalExamples": 47,
  "totalPaths": 78,
  "correctPaths": 47,
  "incorrectPaths": 31,
  "accuracy": "60.26%",
  "byOutcome": {
    "YES": 18,
    "NO": 29
  }
}
```

---

## Next Steps

### 1. Review the Data
```bash
# Look at sample examples
cat sft_classifier_training_sample.json

# Check statistics
cat sft_classifier_statistics.json

# Count total examples
wc -l sft_classifier_training.jsonl
```

### 2. Scale to Real Data

Replace mock events in `scripts/polymarket-sft-pipeline.ts` with actual Polymarket API:

```typescript
async function loadPolymarketEvents(limit: number): Promise<PolymarketEvent[]> {
  // TODO: Call actual Polymarket API
  const response = await fetch('https://gamma-api.polymarket.com/events');
  const data = await response.json();

  return data.map(event => ({
    id: event.id,
    question: event.question,
    outcome: event.outcome,  // Must be resolved
    category: event.category
  })).slice(0, limit);
}
```

### 3. Train the Classifier

Use the generated JSONL file with HuggingFace:

```python
# train.py
from transformers import AutoModelForCausalLM, AutoTokenizer, Trainer, TrainingArguments
from datasets import load_dataset

# Load data
dataset = load_dataset('json', data_files='sft_classifier_training.jsonl')

# Load model
model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.3-70B-Instruct")
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.3-70B-Instruct")

# Format for training
def format_example(example):
    text = f"{example['prompt']}\n\n{example['completion']}"
    return tokenizer(text, truncation=True, max_length=2048)

dataset = dataset.map(format_example)

# Train
trainer = Trainer(
    model=model,
    train_dataset=dataset['train'],
    args=TrainingArguments(
        output_dir="./classifier-model",
        num_train_epochs=3,
        per_device_train_batch_size=4,
    )
)

trainer.train()
trainer.save_model("./classifier-final")
```

---

## Customization

### Change Number of Events
Edit the limit in `scripts/polymarket-sft-pipeline.ts`:
```typescript
const events = await loadPolymarketEvents(10);  // Process 10 instead of 5
```

### Change Tree Depth
```typescript
const seed: SeedInput = {
  ...
  maxDepth: 4,  // Generate deeper trees
};
```

### Change Classification Logic
Edit `inferClassification()` function to use better heuristics or a pre-trained classifier.

---

## Troubleshooting

**Issue**: "Module not found"
```bash
npm install
```

**Issue**: API rate limiting
- Increase `sleep()` duration between events (currently 2000ms)
- Process fewer events at once

**Issue**: Low accuracy (<50%)
- Check classification logic in `inferClassification()`
- Review sample outputs manually
- Ensure mock events have realistic outcomes

---

## Files Created

- `scripts/polymarket-sft-pipeline.ts` - Main pipeline
- `sft_classifier_training.jsonl` - Training data
- `sft_classifier_training_sample.json` - Human-readable sample
- `sft_classifier_statistics.json` - Statistics

Ready to generate SFT data! Run: `npm run sft:generate`
