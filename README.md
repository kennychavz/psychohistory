# PsychoHistory 🔮

Probabilistic event forecasting system inspired by Isaac Asimov's Foundation series. Generate probability trees of future events based on historical research and academic analysis.

![PsychoHistory Demo](./demo.png)

## Overview

PsychoHistory takes a seed event (e.g., "NYC implements rent control") and generates a tree of possible outcomes, each with:

- **Probability**: Likelihood of occurrence (sums to 1.0 for siblings)
- **Justification**: Explanation citing historical precedents
- **Sentiment**: Impact rating from -100 (very negative) to +100 (very positive)
- **Research Sources**: Academic papers, case studies, and expert analysis

## Features

- 🌲 **Probabilistic Tree Generation**: Up to 5 levels deep
- 🔍 **Historical Research**: Automatic search for precedents and case studies
- 🤖 **LLM-Powered Analysis**: GPT-4o analyzes research and generates probabilities
- 📊 **Interactive Visualization**: React Flow + D3.js depth-aware layout
- 🎨 **Sentiment Encoding**: Color-coded nodes and edges
- 📖 **Citation Tracking**: All predictions include sources

## Tech Stack

### Frontend
- **Next.js 14** (App Router)
- **TypeScript**
- **TailwindCSS**
- **React Flow** (graph visualization)
- **D3.js** (data visualization)
- **Zustand** (state management)

### Backend/AI
- **OpenAI GPT-4o** (probability analysis)
- **Exa AI / Tavily** (semantic search)
- **Zod** (schema validation)

## Getting Started

### Prerequisites

- Node.js 18+
- OpenAI API key
- (Optional) Exa or Tavily API key for real search

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/psychohistory.git
cd psychohistory

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your API keys

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...

# Optional (defaults to mock search)
SEARCH_PROVIDER=exa  # or 'tavily' or 'mock'
EXA_API_KEY=...
TAVILY_API_KEY=...
```

## Usage

1. **Enter Seed Event**: Describe the starting condition
   - Example: "New York City implements strict rent control"

2. **Add Context** (Optional): Provide background information
   - Example: "Population: 8.3M, median rent: $3,500/month"

3. **Set Parameters**:
   - Max Depth: 1-5 levels (deeper = more detailed)
   - Timeframe: "next 6 months", "1-2 years", etc.

4. **Generate Tree**: Click "Generate Tree" and wait
   - System will research historical precedents
   - LLM analyzes findings and generates probabilities
   - Tree expands level by level

5. **Explore Results**:
   - Click nodes to see details
   - Hover edges to see probabilities
   - Toggle layout orientation
   - View most probable path

## Architecture

```
src/
├── app/                    # Next.js app router
├── components/
│   ├── SeedInput/         # Input form and templates
│   ├── TreeVisualization/ # React Flow components
│   └── Analysis/          # Metrics and dashboards
├── lib/
│   ├── llm/               # LLM orchestration
│   ├── research/          # Search and aggregation
│   ├── tree/              # Tree generation logic
│   ├── layout/            # Depth-aware layout
│   └── d3/                # D3 utilities
└── types/                 # TypeScript definitions
```

### Core Algorithms

#### 1. Tree Generation

```typescript
async function expandTree(seed):
  1. Create root node from seed
  2. For each depth level (0 to maxDepth):
     a. Get all nodes at current depth
     b. Process in batches of 20 (concurrent limit)
     c. For each node:
        - Generate search queries
        - Perform research
        - Analyze probabilities
        - Create child nodes
  3. Return complete tree
```

#### 2. Probability Normalization

```typescript
function normalizeProbabilities(events):
  sum = events.reduce((acc, e) => acc + e.probability, 0)
  return events.map(e => ({
    ...e,
    probability: e.probability / sum
  }))
```

#### 3. Depth Layout

```typescript
function layoutNode(node, depth, xOffset):
  y = depth * DEPTH_SPACING  // Vertical progression

  if (node.children.length == 0):
    position node at (xOffset, y)
    return CHILD_SPACING

  // Recursively layout children
  totalWidth = 0
  for child in node.children:
    width = layoutNode(child, depth + 1, xOffset + totalWidth)
    totalWidth += width

  // Center parent over children
  centerX = (firstChild.x + lastChild.x) / 2
  position node at (centerX, y)

  return totalWidth
```

## Examples

### Policy Analysis

**Seed**: "California passes universal basic income of $1,000/month"

**Generated Outcomes** (Depth 1):
1. **Inflation increases in consumer goods** (35%) - Sentiment: -25
2. **Small business hiring decreases** (25%) - Sentiment: -40
3. **Entrepreneurship rates increase** (20%) - Sentiment: +60
4. **Migration from other states increases** (15%) - Sentiment: +10
5. **Program is scaled back due to costs** (5%) - Sentiment: -30

### Geopolitical Forecasting

**Seed**: "Major trade agreement signed between US and China"

**Generated Outcomes** (Depth 1):
1. **Tariffs reduced on tech products** (40%) - Sentiment: +70
2. **Agricultural exports increase** (30%) - Sentiment: +50
3. **Political backlash in US Congress** (20%) - Sentiment: -20
4. **Other countries seek similar deals** (10%) - Sentiment: +40

## Limitations

- **LLM Hallucinations**: Probabilities are estimates, not predictions
- **Data Recency**: Limited to LLM training data cutoff
- **Complex Events**: Struggles with unprecedented scenarios
- **Bias**: Inherits biases from training data and search results
- **Depth Constraints**: Max depth of 5 limits long-term forecasting

## Roadmap

### Phase 1 (Current)
- [x] Core tree generation
- [x] LLM integration
- [x] React Flow visualization
- [x] Depth-aware layout

### Phase 2 (Next)
- [ ] Ensemble predictions (multiple LLMs)
- [ ] Temporal dynamics (time-based windows)
- [ ] Monte Carlo simulation
- [ ] Export to PDF/JSON

### Phase 3 (Future)
- [ ] Backtesting against actual outcomes
- [ ] User feedback loop
- [ ] Collaborative trees
- [ ] Real-time updates

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first.

## License

MIT License - see [LICENSE](./LICENSE)

## Acknowledgments

- Inspired by Isaac Asimov's *Foundation* series
- Built with [React Flow](https://reactflow.dev/)
- Powered by [OpenAI](https://openai.com/)

## Citation

If you use PsychoHistory in research, please cite:

```bibtex
@software{psychohistory2024,
  author = {Your Name},
  title = {PsychoHistory: Probabilistic Event Forecasting},
  year = {2024},
  url = {https://github.com/yourusername/psychohistory}
}
```

---

**Built for [Hackathon Name]** | **Team**: [Your Team]
