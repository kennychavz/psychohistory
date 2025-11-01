# PsychoHistory: Probabilistic Event Forecasting System

## Concept Overview

A system that generates probability trees of future events based on a seed condition, grounded in historical research and academic analysis. Inspired by Asimov's psychohistory concept.

### Core Mechanics

1. **Seed Node (n₀)**: Starting condition/policy/event
2. **Research Phase**: LLM generates search queries → gathers historical precedents
3. **Probability Generation**: LLM outputs up to 5 possible outcomes with probabilities (Σp = 1)
4. **Recursive Expansion**: Each child node repeats the process
5. **Constraints**:
   - Max depth: 5 levels
   - Max children per node: 5
   - Max concurrent processing: 20 nodes
   - Probabilities must sum to 100%

### Node Schema

```json
{
  "id": "uuid",
  "event": "Description of what happens",
  "probability": 0.35,
  "justification": "Explanation citing historical precedents",
  "sentiment": -45,
  "depth": 2,
  "sources": ["url1", "url2"],
  "children": [],
  "parentId": "parent-uuid"
}
```

---

## Three-Phase Implementation Plan

---

## Phase 1: Core Infrastructure & Probability Engine (Week 1-2)

**Goal**: Build the backend logic for tree generation, LLM orchestration, and probability calculations.

### 1.1 Project Setup
- Initialize Next.js 14 with TypeScript
- Set up TailwindCSS
- Configure environment variables (OpenAI/Anthropic API keys, search APIs)
- Install dependencies: `ai` SDK, `zod`, `uuid`, `axios`

### 1.2 Data Models & Types
```typescript
// types/tree.ts
- EventNode interface
- TreeState interface
- ProbabilityOutput schema (Zod)
- SearchQuery schema
- ResearchContext schema
```

### 1.3 LLM Orchestration Layer
```typescript
// lib/llm/
- query-generator.ts: Generate search queries from event context
- probability-analyzer.ts: Analyze research → output probabilities
- prompt-templates.ts: System prompts for different LLM tasks
- llm-client.ts: Unified interface for OpenAI/Anthropic
```

**Key Functions**:
- `generateSearchQueries(eventContext: string): Promise<string[]>`
- `analyzeProbabilities(context: string, research: string[]): Promise<ProbabilityOutput[]>`
- Ensure probability normalization (sum to 1.0)
- Validation with Zod schemas

### 1.4 Research/Search Module
```typescript
// lib/research/
- search-engine.ts: Integration with Exa/Perplexity/Tavily
- citation-extractor.ts: Extract and format sources
- research-aggregator.ts: Combine multi-source results
```

**Key Functions**:
- `performResearch(queries: string[]): Promise<ResearchResult[]>`
- Cache results to avoid redundant API calls
- Rate limiting and error handling

### 1.5 Tree Generation Engine
```typescript
// lib/tree/
- tree-builder.ts: Core recursive tree expansion logic
- node-processor.ts: Process individual nodes (research → probabilities)
- queue-manager.ts: Handle max 20 concurrent nodes
- depth-tracker.ts: Enforce max depth of 5
```

**Key Algorithm**:
```
function expandTree(seedNode):
  queue = [seedNode]
  processed = Set()

  while queue is not empty and depth < 5:
    batch = queue.pop(min(20, queue.length))

    for node in batch (parallel):
      if node.depth >= 5: continue

      1. Generate search queries from node.event
      2. Perform research
      3. Generate probabilities (max 5 children)
      4. Validate probabilities sum to 1.0
      5. Create child nodes
      6. Add children to queue

    processed.add(batch)
```

### 1.6 Database/State Management
- Use Zustand for client-side tree state
- Optional: Persist to SQLite/PostgreSQL for saved trees
- Implement tree serialization/deserialization

**Deliverables Phase 1**:
- ✅ Functional tree generation from seed
- ✅ LLM-powered research and probability analysis
- ✅ Validated JSON outputs with citations
- ✅ Queue-based concurrent processing
- ✅ Test suite for core logic

---

## Phase 2: Visualization Layer - React Flow + D3 (Week 3-4)

**Goal**: Create an interactive, depth-aware visualization of probability trees.

### 2.1 React Flow Setup
```typescript
// components/TreeVisualization/
- TreeCanvas.tsx: Main React Flow canvas
- NodeTypes/: Custom node components
  - EventNode.tsx: Display event, probability, sentiment
  - SeedNode.tsx: Special styling for root node
- EdgeTypes/: Custom edge components
  - ProbabilityEdge.tsx: Width based on probability
```

### 2.2 Depth-Aware Layout Algorithm
**Critical**: Position nodes based on depth, NOT circular/heliocentric.

**Layout Strategy**: Vertical or Horizontal Hierarchical
```typescript
// lib/layout/
- depth-layout.ts: Calculate node positions

Layout Options:
1. **Vertical Depth Layout** (Recommended)
   - X-axis: Spread children horizontally
   - Y-axis: Depth (0 at top, increases downward)
   - Spacing: Proportional to probability

2. **Horizontal Depth Layout**
   - X-axis: Depth (0 at left, increases rightward)
   - Y-axis: Spread children vertically
```

**Implementation**:
```typescript
function calculateNodePositions(tree: EventNode): NodePosition[] {
  const positions: NodePosition[] = []
  const DEPTH_SPACING = 300 // pixels between depth levels
  const CHILD_SPACING = 200 // base spacing between siblings

  function layout(node: EventNode, depth: number, xOffset: number) {
    // Position current node
    positions.push({
      id: node.id,
      x: xOffset,
      y: depth * DEPTH_SPACING
    })

    // Calculate total width needed for children
    const totalChildren = node.children.length
    const childrenWidth = totalChildren * CHILD_SPACING
    const startX = xOffset - (childrenWidth / 2)

    // Recursively layout children
    node.children.forEach((child, index) => {
      const childX = startX + (index * CHILD_SPACING)
      layout(child, depth + 1, childX)
    })
  }

  layout(tree, 0, 0)
  return positions
}
```

### 2.3 D3 Enhancements
```typescript
// lib/d3/
- probability-scale.ts: D3 scales for probability visualization
- sentiment-color.ts: Color gradients for sentiment (-100 to 100)
- animation.ts: Smooth transitions for tree expansion
```

**Visual Encodings**:
- **Edge Width**: Proportional to probability (thicker = more likely)
- **Node Color**: Sentiment gradient (red → yellow → green)
- **Node Size**: Could encode confidence or importance
- **Edge Opacity**: Cumulative probability along path

### 2.4 Interactive Features
```typescript
// components/TreeVisualization/
- NodeDetailsPanel.tsx: Show full justification, sources
- ControlPanel.tsx: Expand/collapse, filter by probability
- PathHighlighter.tsx: Highlight most probable path
- SentimentLegend.tsx: Color scale legend
```

**Interactions**:
- Click node → Show details panel
- Hover node → Highlight upstream path
- Expand/collapse branches
- Filter nodes by min probability threshold
- Show/hide low-probability branches
- Export to JSON/PNG

### 2.5 Real-time Tree Expansion
```typescript
// hooks/
- useTreeExpansion.ts: Manage incremental tree building
- useNodeProcessing.ts: Subscribe to node processing events
```

**Flow**:
1. User enters seed event
2. Tree starts expanding (show loading state)
3. Nodes appear incrementally as processed
4. Animate new nodes/edges appearing
5. Auto-layout adjusts as tree grows

**Deliverables Phase 2**:
- ✅ Interactive React Flow visualization
- ✅ Depth-aware hierarchical layout
- ✅ Probability-weighted edge rendering
- ✅ Sentiment color coding
- ✅ Real-time tree expansion with animations
- ✅ Node detail panels with citations

---

## Phase 3: UI/UX Polish & Advanced Features (Week 5-6)

**Goal**: Production-ready interface with advanced analysis capabilities.

### 3.1 Seed Input Interface
```typescript
// components/SeedInput/
- SeedForm.tsx: Main input form
- TemplateSelector.tsx: Pre-built templates
- ContextEditor.tsx: Rich text editor for detailed context
```

**Templates**:
- Policy Analysis (e.g., rent control)
- Geopolitical Events (e.g., Russia-Ukraine)
- Economic Scenarios (e.g., interest rate changes)
- Technology Adoption (e.g., AI regulation)

### 3.2 Analysis Dashboard
```typescript
// components/Analysis/
- ProbabilityDistribution.tsx: Histogram of outcome probabilities
- SentimentAnalysis.tsx: Overall sentiment trends by depth
- PathAnalyzer.tsx: Most/least probable paths
- ConfidenceMetrics.tsx: Show certainty levels
```

**Metrics**:
- Most probable outcome at each depth
- Average sentiment by depth level
- Entropy/uncertainty measures
- Citation quality scores

### 3.3 Export & Sharing
```typescript
// lib/export/
- json-exporter.ts: Export tree as JSON
- pdf-generator.ts: Generate PDF report
- share-link.ts: Generate shareable URLs
```

### 3.4 Performance Optimizations
- Virtualize large trees (only render visible nodes)
- Lazy load node details
- Cache LLM responses
- Debounce search queries
- Web Workers for layout calculations

### 3.5 Error Handling & Edge Cases
- Invalid probabilities (don't sum to 1)
- API rate limits
- No historical precedents found
- Contradictory research results
- User feedback on probability accuracy

### 3.6 Testing & Validation
```typescript
// __tests__/
- tree-generation.test.ts
- probability-validation.test.ts
- layout-algorithm.test.ts
- integration.test.ts
```

**Test Cases**:
- Probability sums equal 1.0
- Max depth enforcement
- Max 20 concurrent nodes
- Sentiment bounds (-100 to 100)
- Citation parsing

**Deliverables Phase 3**:
- ✅ Polished UI with templates
- ✅ Analysis dashboard
- ✅ Export functionality
- ✅ Performance optimizations
- ✅ Comprehensive test suite
- ✅ Error handling
- ✅ Documentation

---

## Technical Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Visualization**: React Flow + D3.js
- **State**: Zustand
- **Forms**: React Hook Form + Zod

### Backend/API
- **LLM**: OpenAI GPT-4o / Anthropic Claude 3.5 Sonnet
- **Search**: Exa AI / Perplexity API / Tavily
- **Rate Limiting**: Upstash Redis (optional)

### Data/Storage
- **State**: In-memory (Zustand)
- **Persistence**: PostgreSQL + Prisma (optional)
- **Caching**: Redis (optional)

### DevOps
- **Hosting**: Vercel
- **CI/CD**: GitHub Actions
- **Monitoring**: Vercel Analytics

---

## Key Algorithms

### 1. Probability Normalization
```typescript
function normalizeProbabilities(events: EventNode[]): EventNode[] {
  const sum = events.reduce((acc, e) => acc + e.probability, 0)
  return events.map(e => ({
    ...e,
    probability: e.probability / sum
  }))
}
```

### 2. Cumulative Path Probability
```typescript
function calculatePathProbability(path: EventNode[]): number {
  return path.reduce((acc, node) => acc * node.probability, 1.0)
}
```

### 3. Most Probable Path (Greedy)
```typescript
function findMostProbablePath(root: EventNode, depth: number): EventNode[] {
  const path = [root]
  let current = root

  for (let i = 0; i < depth; i++) {
    if (!current.children.length) break
    current = current.children.reduce((max, child) =>
      child.probability > max.probability ? child : max
    )
    path.push(current)
  }

  return path
}
```

### 4. Sentiment Aggregation
```typescript
function aggregateSentiment(tree: EventNode): number {
  // Weighted average by cumulative probability
  function traverse(node: EventNode, cumProb: number): number {
    let sum = node.sentiment * cumProb

    for (const child of node.children) {
      sum += traverse(child, cumProb * child.probability)
    }

    return sum
  }

  return traverse(tree, 1.0)
}
```

---

## Research Strategy

### Search Query Generation Prompt
```
Given this event: "{event}"

Generate 3-5 search queries to find:
1. Historical precedents (similar policies/events)
2. Academic research on outcomes
3. Expert analysis and predictions
4. Case studies from other countries/contexts

Output format:
["query 1", "query 2", ...]
```

### Probability Analysis Prompt
```
Event: {parentEvent}
Depth: {currentDepth}/5

Research findings:
{researchSummary}

Generate up to 5 possible next events that could occur within {timeframe}.

For each event, provide:
1. Event description
2. Probability (0-1, must sum to 1.0)
3. Justification citing research
4. Sentiment (-100 to 100)

Output JSON:
[{
  "event": "...",
  "probability": 0.35,
  "justification": "Based on...",
  "sentiment": -25
}]
```

---

## Success Metrics

1. **Accuracy**: Probabilities reflect reasonable forecasts
2. **Justification Quality**: Citations are relevant and credible
3. **Performance**: Generate 5-depth tree in < 5 minutes
4. **UX**: Intuitive exploration of probability space
5. **Generalizability**: Works for policy, geopolitics, economics, tech

---

## Future Enhancements (Post-Hackathon)

1. **Ensemble Predictions**: Multiple LLMs vote on probabilities
2. **Temporal Dynamics**: Time-based event windows (week 1, month 1, year 1)
3. **Monte Carlo Simulation**: Sample paths based on probabilities
4. **Backtesting**: Compare predictions to actual outcomes
5. **User Feedback Loop**: Let users rate prediction quality
6. **Multi-modal Research**: Include images, videos, charts
7. **Collaborative Trees**: Multiple users explore same scenario
8. **Real-time Updates**: Stream new research as it becomes available
9. **Custom Research Sources**: User-provided documents/databases
10. **Causal Inference**: Identify causal relationships between events

---

## Development Timeline

| Phase | Duration | Key Milestones |
|-------|----------|----------------|
| Phase 1 | 2 weeks | Tree generation engine working, LLM integration complete |
| Phase 2 | 2 weeks | Interactive visualization, depth layout implemented |
| Phase 3 | 2 weeks | Polish, testing, deployment |
| **Total** | **6 weeks** | **MVP ready for demo** |

For hackathon: Compress to 2-3 days by focusing on core flow + basic visualization.

---

## Hackathon MVP Scope (48 hours)

**Day 1 (12 hours)**:
- Project setup
- Basic tree generation logic
- LLM integration (OpenAI)
- Simple search integration (Exa)

**Day 2 (24 hours)**:
- React Flow visualization
- Depth layout algorithm
- Basic styling (sentiment colors, probability edges)
- Seed input form

**Day 3 (12 hours)**:
- Polish UI
- Add one demo scenario (rent control)
- Bug fixes
- Prepare demo/pitch

**Cut Features for Hackathon**:
- Database persistence
- Advanced analytics
- Export functionality
- Templates
- User accounts

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| LLM hallucinations | Require citations, show confidence levels |
| API rate limits | Cache aggressively, use multiple providers |
| Poor probability estimates | Ensemble methods, user feedback |
| Performance issues | Limit tree size, optimize layout algorithm |
| Complex layout bugs | Fallback to simple grid layout |

---

## Getting Started (Post-Planning)

```bash
# 1. Initialize project
npx create-next-app@latest psychohistory --typescript --tailwind

# 2. Install dependencies
npm install reactflow d3 zustand zod ai openai axios

# 3. Set up environment
cp .env.example .env.local
# Add: OPENAI_API_KEY, EXA_API_KEY

# 4. Run dev server
npm run dev
```

---

**Ready to build the future!** 🔮
