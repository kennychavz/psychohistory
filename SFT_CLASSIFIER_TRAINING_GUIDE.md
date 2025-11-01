# SFT Classifier Training Data Generation
## From Polymarket Events to Training Dataset

---

## Overview

Given 100 Polymarket events with known outcomes, generate SFT training data for a classifier that predicts terminal outcomes (YES/NO) based on event paths.

---

## Input Data Required

### Polymarket Event Format
```json
{
  "id": "election-2024-kamala",
  "question": "Will Kamala Harris win the 2024 US Presidential Election?",
  "outcome": "NO",  // What actually happened
  "closedAt": "2024-11-05T23:59:59Z",
  "category": "politics"
}
```

**Minimum required**: Just `question` and `outcome`

---

## Pipeline

```
Step 1: Load Polymarket events (100 events)
         ↓
Step 2: For each event, generate probability tree
         ↓
Step 3: Extract all terminal paths from tree
         ↓
Step 4: Label paths (correct if classification matches actual outcome)
         ↓
Step 5: Filter to keep only correct paths
         ↓
Step 6: Format as SFT training examples
         ↓
Step 7: Save to JSONL file
```

---

## Step-by-Step Process

### Step 1: Load Polymarket Events

```typescript
// scripts/generate-sft-data.ts

interface PolymarketEvent {
  id: string;
  question: string;
  outcome: 'YES' | 'NO';  // Actual result
  closedAt: string;
  category?: string;
}

async function loadPolymarketEvents(): Promise<PolymarketEvent[]> {
  // Load from your data source
  const events = await loadJSON('./data/polymarket_events.json');
  return events;
}
```

### Step 2: Generate Tree for Each Event

```typescript
import { buildTree } from '@/lib/tree/tree-builder';

async function generateTreeForEvent(event: PolymarketEvent) {
  const seed = {
    event: event.question,
    maxDepth: 3,  // Adjust based on event complexity
    domain: event.category || 'general',
  };

  // Your existing tree generation
  const tree = await buildTree(seed);

  return {
    eventId: event.id,
    question: event.question,
    actualOutcome: event.outcome,
    tree: tree
  };
}
```

### Step 3: Extract Terminal Paths

```typescript
interface TerminalPath {
  pathId: string;
  nodes: PathNode[];
  cumulativeProbability: number;
  classification: 'YES' | 'NO';  // What the path predicts
}

interface PathNode {
  event: string;
  probability: number;
  depth: number;
  justification: string;
}

function extractTerminalPaths(tree: EventNode): TerminalPath[] {
  const paths: TerminalPath[] = [];

  function traverse(node: EventNode, currentPath: PathNode[], cumProb: number) {
    const pathNode = {
      event: node.event,
      probability: node.probability,
      depth: node.depth,
      justification: node.justification
    };

    const newPath = [...currentPath, pathNode];
    const newCumProb = cumProb * node.probability;

    // Terminal node (leaf)
    if (!node.children || node.children.length === 0) {
      paths.push({
        pathId: `path_${paths.length}`,
        nodes: newPath,
        cumulativeProbability: newCumProb,
        classification: node.terminalClassification || inferClassification(node)
      });
      return;
    }

    // Recurse on children
    for (const child of node.children) {
      traverse(child, newPath, newCumProb);
    }
  }

  traverse(tree, [], 1.0);
  return paths;
}

function inferClassification(node: EventNode): 'YES' | 'NO' {
  // If not explicitly set, infer from event text
  const text = node.event.toLowerCase();

  // Look for indicators
  if (text.includes('wins') || text.includes('succeeds') || text.includes('passes')) {
    return 'YES';
  }
  if (text.includes('loses') || text.includes('fails') || text.includes('defeated')) {
    return 'NO';
  }

  // Default: use sentiment
  return node.sentiment > 0 ? 'YES' : 'NO';
}
```

### Step 4: Label Paths

```typescript
interface LabeledPath extends TerminalPath {
  actualOutcome: 'YES' | 'NO';
  isCorrect: boolean;
  eventId: string;
  question: string;
}

function labelPaths(
  paths: TerminalPath[],
  eventId: string,
  question: string,
  actualOutcome: 'YES' | 'NO'
): LabeledPath[] {
  return paths.map(path => ({
    ...path,
    eventId,
    question,
    actualOutcome,
    isCorrect: path.classification === actualOutcome  // ← Key filter
  }));
}
```

### Step 5: Filter Correct Paths

```typescript
function filterCorrectPaths(labeledPaths: LabeledPath[]): LabeledPath[] {
  return labeledPaths.filter(path => path.isCorrect);
}
```

### Step 6: Format as SFT Examples

```typescript
interface SFTExample {
  prompt: string;
  completion: string;
  metadata: {
    eventId: string;
    pathId: string;
    cumulativeProbability: number;
  };
}

function formatAsSFT(path: LabeledPath): SFTExample {
  // Format the path as a readable string
  const pathDescription = path.nodes
    .map((node, i) => {
      if (i === 0) {
        return `${node.event}`;  // Root question
      }
      return `  → [Depth ${node.depth}] ${node.event} (p=${node.probability.toFixed(2)})`;
    })
    .join('\n');

  // Calculate cumulative at each step
  const cumulativeSteps = path.nodes
    .slice(1)  // Skip root
    .map((_, i) => {
      const upToHere = path.nodes.slice(1, i + 2);
      const cumProb = upToHere.reduce((acc, n) => acc * n.probability, 1.0);
      return cumProb.toFixed(4);
    });

  const prompt = `# Binary Classification Task

## Question
${path.question}

## Event Path
${pathDescription}

## Cumulative Probability
${path.cumulativeProbability.toFixed(4)}

## Context
${path.nodes.slice(-1)[0].justification}

## Task
Based on this path and cumulative probability, classify the final outcome.
Output only: YES or NO`;

  return {
    prompt,
    completion: path.classification,  // 'YES' or 'NO'
    metadata: {
      eventId: path.eventId,
      pathId: path.pathId,
      cumulativeProbability: path.cumulativeProbability
    }
  };
}
```

### Step 7: Save to JSONL

```typescript
function saveToJSONL(examples: SFTExample[], filename: string) {
  const jsonl = examples
    .map(ex => JSON.stringify(ex))
    .join('\n');

  fs.writeFileSync(filename, jsonl);
  console.log(`Saved ${examples.length} examples to ${filename}`);
}
```

---

## Complete Pipeline Script

```typescript
// scripts/generate-sft-data.ts

async function main() {
  console.log('🚀 Starting SFT data generation...\n');

  // Step 1: Load events
  const events = await loadPolymarketEvents();
  console.log(`✓ Loaded ${events.length} Polymarket events\n`);

  const allSFTExamples: SFTExample[] = [];

  // Step 2-6: Process each event
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    console.log(`[${i + 1}/${events.length}] Processing: ${event.question.substring(0, 60)}...`);

    try {
      // Generate tree
      const treeData = await generateTreeForEvent(event);

      // Extract paths
      const paths = extractTerminalPaths(treeData.tree);
      console.log(`  → Found ${paths.length} terminal paths`);

      // Label paths
      const labeledPaths = labelPaths(
        paths,
        event.id,
        event.question,
        event.outcome
      );

      // Filter correct
      const correctPaths = filterCorrectPaths(labeledPaths);
      console.log(`  → ${correctPaths.length} paths were correct (${(correctPaths.length/paths.length*100).toFixed(1)}%)`);

      // Format as SFT
      const sftExamples = correctPaths.map(formatAsSFT);
      allSFTExamples.push(...sftExamples);

      // Rate limiting
      await sleep(1000);

    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
    }
  }

  console.log(`\n✓ Generated ${allSFTExamples.length} total training examples`);

  // Step 7: Save
  saveToJSONL(allSFTExamples, 'sft_classifier_training.jsonl');

  // Also save pretty version for review
  fs.writeFileSync(
    'sft_classifier_training_sample.json',
    JSON.stringify(allSFTExamples.slice(0, 5), null, 2)
  );

  // Statistics
  printStatistics(allSFTExamples);
}

function printStatistics(examples: SFTExample[]) {
  console.log('\n📊 Statistics:');
  console.log(`Total examples: ${examples.length}`);

  const byOutcome = examples.reduce((acc, ex) => {
    acc[ex.completion] = (acc[ex.completion] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\nBy outcome:');
  Object.entries(byOutcome).forEach(([outcome, count]) => {
    console.log(`  ${outcome}: ${count} (${(count/examples.length*100).toFixed(1)}%)`);
  });

  const avgCumProb = examples.reduce((sum, ex) =>
    sum + ex.metadata.cumulativeProbability, 0
  ) / examples.length;
  console.log(`\nAverage cumulative probability: ${avgCumProb.toFixed(4)}`);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run
main().catch(console.error);
```

---

## Example Output

### Input Event
```json
{
  "id": "election-2024",
  "question": "Will Kamala Harris win the 2024 election?",
  "outcome": "NO"
}
```

### Generated Tree (simplified)
```
Root: "Will Kamala win?"
├─ Economic crisis (0.40)
│  ├─ Blamed on Biden (0.60) → Swing to Trump → NO ✓
│  └─ Seen as global (0.40) → Kamala resilient → YES ✗
└─ Foreign success (0.35)
   └─ Boosts incumbent (0.70) → Kamala wins → YES ✗
```

### SFT Training Example
```json
{
  "prompt": "# Binary Classification Task\n\n## Question\nWill Kamala Harris win the 2024 election?\n\n## Event Path\nWill Kamala Harris win the 2024 election?\n  → [Depth 1] Economic crisis occurs (p=0.40)\n  → [Depth 2] Crisis blamed on Biden administration (p=0.60)\n  → [Depth 3] Voters swing to Trump (p=0.85)\n\n## Cumulative Probability\n0.2040\n\n## Context\nHistorical data shows incumbent party loses 85% when recession hits 3 months before election\n\n## Task\nBased on this path and cumulative probability, classify the final outcome.\nOutput only: YES or NO",

  "completion": "NO",

  "metadata": {
    "eventId": "election-2024",
    "pathId": "path_0",
    "cumulativeProbability": 0.204
  }
}
```

---

## Usage

```bash
# Generate SFT training data
npm run generate-sft

# Review sample
cat sft_classifier_training_sample.json

# Check statistics
wc -l sft_classifier_training.jsonl
```

---

## Training the Classifier

```python
# train_classifier.py

from transformers import AutoModelForCausalLM, AutoTokenizer, Trainer, TrainingArguments
from datasets import load_dataset

# Load data
dataset = load_dataset('json', data_files='sft_classifier_training.jsonl')

# Load model
model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.3-70B-Instruct")
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.3-70B-Instruct")

# Tokenize
def preprocess(example):
    text = f"{example['prompt']}\n\nAnswer: {example['completion']}"
    return tokenizer(text, truncation=True, max_length=2048)

dataset = dataset.map(preprocess)

# Train
training_args = TrainingArguments(
    output_dir="./classifier-model",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    learning_rate=2e-5,
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=dataset['train'],
)

trainer.train()
trainer.save_model("./classifier-model-final")
```

---

## Expected Results

From 100 Polymarket events:
- ~30-50 paths per event average
- ~30-60% of paths are correct (match actual outcome)
- **Total: ~1,500-3,000 training examples**

Quality indicators:
- ✅ Balanced YES/NO distribution (45-55% each)
- ✅ Diverse cumulative probabilities (0.01 to 0.80)
- ✅ All examples verified correct by actual outcomes

---

## Next Steps

1. Run on 10 events first (validate pipeline)
2. Review sample outputs manually
3. Scale to 100 events
4. Train classifier on generated data
5. Test on new Polymarket events
