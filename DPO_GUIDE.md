# DPO Training Guide for PsychoHistory

## What is DPO?

**Direct Preference Optimization (DPO)** is a reinforcement learning technique for fine-tuning language models. Unlike traditional RLHF (Reinforcement Learning from Human Feedback), DPO:

- ✅ Doesn't require a separate reward model
- ✅ Trains directly on preference pairs (chosen vs rejected outputs)
- ✅ Is more stable and easier to implement
- ✅ Works well with smaller datasets

## Why Use DPO for PsychoHistory?

Your probability tree system can benefit from DPO to:

1. **Improve Probability Calibration**: Learn to generate probabilities that sum to 1.0 and better reflect reality
2. **Better Research Integration**: Learn to cite sources and ground predictions in evidence
3. **Context Awareness**: Learn to use tree history (path from root) to make coherent predictions
4. **Quality Control**: Prefer specific, measurable outcomes over vague predictions

## Core Concepts

### Input: Tree Context + Research
Every prediction happens in context:
- **Tree path**: All ancestor nodes from root to current
- **Cumulative probability**: Product of all probabilities along path
- **Sibling context**: Other branches at the same level
- **Research data**: Sources, queries, summaries

### Output: Probability-Weighted Outcomes
The model generates:
- 1-5 possible next events
- Probabilities that sum to 1.0
- Justifications citing research
- Sentiment scores (-100 to +100)

### Preference Pairs
DPO needs pairs of (chosen, rejected) outputs:
- **Chosen**: Better quality prediction (well-calibrated, specific, grounded)
- **Rejected**: Worse quality prediction (poor calibration, vague, unsupported)

---

## Step-by-Step Implementation

### Phase 1: Data Collection

#### Option A: Model Comparison (Easiest)
Generate two outputs with different settings, automatically rank by quality.

```typescript
import { collectByModelComparison } from '@/lib/dpo/preference-collector';
import { nodeToDPOInput } from '@/lib/dpo/dpo-preprocessor';

async function collectData() {
  // 1. Process your tree normally
  const tree = await buildTree(seedInput);

  // 2. For each node, collect preference pairs
  const examples = [];

  for (const node of getProcessedNodes(tree)) {
    const input = nodeToDPOInput(
      node,
      nodeMap,
      {
        summary: researchResult.summary,
        queries: researchResult.queries,
      },
      seedInput.timeframe
    );

    // Generate two outputs, rank by quality
    const example = await collectByModelComparison(
      input,
      tree.id,
      node.id
    );

    examples.push(example);
  }

  // 3. Save to file
  const jsonl = exportToJSONL(examples);
  await fs.writeFile('training_data.jsonl', jsonl);
}
```

#### Option B: Temperature Sweep (Better quality)
Generate multiple outputs at different temperatures, create multiple preference pairs.

```typescript
import { collectByTemperatureSweep } from '@/lib/dpo/preference-collector';

// Generates outputs at temps [0.3, 0.5, 0.7, 0.9]
// Creates pairs: best vs worst, best vs median
const examples = await collectByTemperatureSweep(
  input,
  treeId,
  nodeId
);
// Returns 2-3 training examples per node
```

#### Option C: Human Feedback (Highest quality)
Show outputs to humans, collect their preferences.

```typescript
import { collectByHumanFeedback } from '@/lib/dpo/preference-collector';

// 1. Generate 2-3 candidate outputs
const outputs = await Promise.all([
  generateOutput(input, { temp: 0.5, model: 'modelA' }),
  generateOutput(input, { temp: 0.7, model: 'modelB' }),
]);

// 2. Show to human, collect feedback
const feedback = {
  chosenOutputId: outputs[0].modelInfo.timestamp.toISOString(),
  rating: 5,
  comments: "This one better cites research",
};

// 3. Create training example
const example = await collectByHumanFeedback(
  input,
  outputs,
  feedback,
  treeId,
  nodeId
);
```

#### Option D: Temporal Validation (Best for long-term)
Wait for actual outcomes, compare predictions to reality.

```typescript
import { collectByActualOutcome } from '@/lib/dpo/preference-collector';

// After 6 months, check what actually happened
const actualOutcome = {
  event: "Rent prices increased 15% despite controls",
  timeOccurred: new Date('2025-04-15'),
};

// Rank historical predictions by accuracy
const example = collectByActualOutcome(
  historicalInput,
  historicalOutputs,
  actualOutcome,
  treeId,
  nodeId
);
```

### Phase 2: Data Format

Each training example looks like:

```json
{
  "id": "tree_abc123_node_xyz789_1698765432",
  "input": {
    "parentEvent": "NYC implements rent control",
    "depth": 1,
    "pathFromRoot": [
      {
        "event": "NYC implements rent control",
        "probability": 1.0,
        "sentiment": 20,
        "depth": 0
      }
    ],
    "cumulativeProbability": 1.0,
    "siblings": [],
    "researchSummary": "Historical analysis shows...",
    "sources": [...],
    "queriesExecuted": ["rent control outcomes", "NYC housing policy"]
  },
  "chosen": {
    "outcomes": [
      {
        "event": "Rental supply decreases by 15-20% over 2 years",
        "probability": 0.45,
        "justification": "Berlin's 2020 rent cap led to 18% supply reduction (Source 1)",
        "sentiment": -40
      },
      {
        "event": "Black market rentals increase 30%",
        "probability": 0.35,
        "justification": "Similar to Stockholm's experience (Source 3)",
        "sentiment": -60
      }
    ],
    "modelInfo": {
      "model": "deepseek-r1",
      "temperature": 0.4,
      "timestamp": "2025-01-15T10:30:00Z"
    }
  },
  "rejected": {
    "outcomes": [
      {
        "event": "Housing situation changes",
        "probability": 0.6,
        "justification": "Based on general trends",
        "sentiment": -20
      }
    ],
    "modelInfo": {
      "model": "deepseek-r1",
      "temperature": 0.9,
      "timestamp": "2025-01-15T10:30:05Z"
    }
  }
}
```

### Phase 3: Training Preparation

Convert to format expected by training frameworks:

```python
# training_script.py
import json
from datasets import Dataset

def load_dpo_data(filepath):
    """Load JSONL data and format for DPO training"""
    examples = []

    with open(filepath, 'r') as f:
        for line in f:
            data = json.loads(line)

            examples.append({
                'prompt': format_prompt(data['input']),
                'chosen': json.dumps(data['chosen']['outcomes']),
                'rejected': json.dumps(data['rejected']['outcomes']),
            })

    return Dataset.from_list(examples)

def format_prompt(input_data):
    """Convert DPO input to model prompt"""
    # Use the formatDPOPrompt function output
    path_summary = '\n'.join([
        f"[Depth {node['depth']}] {node['event']} (p={node['probability']:.2f})"
        for node in input_data['pathFromRoot']
    ])

    return f"""# Probability Tree Analysis

## Tree Path History
{path_summary}

Cumulative Probability: {input_data['cumulativeProbability']:.4f}

## Current Node
Event: {input_data['parentEvent']}
Depth: {input_data['depth']}/5

## Research Summary
{input_data['researchSummary']}

Predict 1-5 possible next events. Output JSON only.
"""
```

### Phase 4: Training with TRL (Transformers Reinforcement Learning)

```python
# train_dpo.py
from transformers import AutoModelForCausalLM, AutoTokenizer
from trl import DPOTrainer, DPOConfig
from datasets import load_dataset

# 1. Load your model (could be Llama, Qwen, DeepSeek, etc.)
model_name = "meta-llama/Llama-3.3-70B-Instruct"
model = AutoModelForCausalLM.from_pretrained(model_name)
tokenizer = AutoTokenizer.from_pretrained(model_name)

# 2. Load your DPO data
train_dataset = load_dpo_data("training_data.jsonl")
eval_dataset = load_dpo_data("eval_data.jsonl")

# 3. Configure training
config = DPOConfig(
    output_dir="./dpo-psychohistory",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    learning_rate=5e-7,
    beta=0.1,  # DPO beta parameter (controls strength of preference)
    max_length=4096,
    max_prompt_length=2048,
)

# 4. Train!
trainer = DPOTrainer(
    model=model,
    args=config,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
    tokenizer=tokenizer,
)

trainer.train()
trainer.save_model("./dpo-psychohistory-final")
```

---

## Practical Workflow

### Week 1: Data Collection
1. Generate 50-100 trees with different seed events
2. For each processed node, collect 1-2 preference pairs using model comparison
3. Target: **500-1000 training examples**

```bash
# Run collection script
npm run collect-dpo-data -- --trees 100 --strategy model_comparison
```

### Week 2: Quality Check
1. Manually review 50-100 examples
2. Ensure "chosen" is actually better than "rejected"
3. Filter out low-quality pairs

```bash
# Review tool
npm run review-dpo-data -- --sample 100
```

### Week 3: Training
1. Convert to HuggingFace format
2. Train using TRL library
3. Monitor loss curves

```bash
# Training
python train_dpo.py \
  --model meta-llama/Llama-3.3-70B-Instruct \
  --data training_data.jsonl \
  --epochs 3
```

### Week 4: Evaluation
1. Generate new trees with fine-tuned model
2. Compare quality metrics
3. A/B test with original model

```bash
# Evaluation
npm run evaluate-model -- --baseline gpt4 --finetuned ./dpo-model
```

---

## Quality Metrics to Track

### Before Training (Baseline)
- Probability calibration error (how far from 1.0)
- Justification length and citation rate
- Specificity score (has numbers, dates, magnitudes)
- Diversity (unique events per node)

### After Training (Improvements)
- ✅ Better probability calibration (closer to 1.0)
- ✅ More research citations in justifications
- ✅ More specific, measurable predictions
- ✅ Better use of tree context

### Example Comparison

**Before DPO:**
```json
{
  "event": "Economy gets worse",
  "probability": 0.7,
  "justification": "Based on trends",
  "sentiment": -30
}
```

**After DPO:**
```json
{
  "event": "GDP growth slows to 1.2% in Q3 2025",
  "probability": 0.42,
  "justification": "Similar to 2008 housing crisis pattern (Source 2), where rent controls preceded GDP slowdown by 6-9 months",
  "sentiment": -35
}
```

---

## Tips for Success

### 1. Start Small
- Begin with 100-200 examples
- Test the full pipeline
- Scale up gradually

### 2. Quality over Quantity
- Better to have 200 high-quality pairs than 1000 noisy ones
- Review samples manually
- Use multiple collection strategies

### 3. Include Tree History
- The key innovation for your system
- Models should learn to use ancestor context
- Helps maintain consistency across depth levels

### 4. Track Everything
- Save all model outputs
- Log quality metrics
- Monitor for degradation

### 5. Iterate
- DPO is iterative - train, evaluate, collect more data, train again
- Use the fine-tuned model to collect better preference pairs
- This creates a virtuous cycle

---

## Next Steps

1. **Run the collection script**
   ```bash
   npm run collect-dpo-data
   ```

2. **Review your first 10 examples**
   - Are chosen outputs clearly better?
   - Is tree history included?
   - Are probabilities calibrated?

3. **Scale to 500 examples**
   - Mix strategies (model comparison + temperature sweep)
   - Diverse seed events (economics, policy, technology)

4. **Train your first model**
   - Use a smaller model first (7B-13B parameters)
   - 1-2 epochs initially
   - Monitor validation loss

5. **Evaluate and iterate**
   - Generate test trees
   - Compare metrics
   - Collect more data where model struggles

---

## Resources

- [DPO Paper](https://arxiv.org/abs/2305.18290)
- [TRL Documentation](https://huggingface.co/docs/trl/dpo_trainer)
- [HuggingFace Datasets](https://huggingface.co/docs/datasets/)

Good luck! Start with model comparison strategy - it's the easiest to get running.
