# PsychoHistory - Complete File Structure

```
PsychoHistory/
├── README.md                          # Main documentation
├── IMPLEMENTATION_PLAN.md             # 3-phase implementation guide
├── FILE_STRUCTURE.md                  # This file
├── package.json                       # Dependencies
├── tsconfig.json                      # TypeScript config
├── next.config.mjs                    # Next.js config
├── tailwind.config.ts                 # Tailwind config
├── postcss.config.mjs                 # PostCSS config
├── .env.example                       # Environment variables template
├── .gitignore                         # Git ignore rules
│
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # Main page
│   │   └── globals.css               # Global styles
│   │
│   ├── components/
│   │   ├── SeedInput/
│   │   │   └── SeedForm.tsx          # Input form with templates
│   │   │
│   │   ├── TreeVisualization/
│   │   │   ├── TreeCanvas.tsx        # React Flow canvas
│   │   │   ├── NodeDetailsPanel.tsx  # Node info sidebar
│   │   │   └── NodeTypes/
│   │   │       ├── EventNode.tsx     # Event node component
│   │   │       └── SeedNode.tsx      # Seed node component
│   │   │
│   │   ├── Analysis/                 # (To be implemented)
│   │   │   ├── ProbabilityDistribution.tsx
│   │   │   ├── SentimentAnalysis.tsx
│   │   │   └── PathAnalyzer.tsx
│   │   │
│   │   └── UI/                       # (To be implemented)
│   │       └── (shared UI components)
│   │
│   ├── lib/
│   │   ├── llm/                      # LLM orchestration layer
│   │   │   ├── llm-client.ts         # Unified LLM client
│   │   │   ├── prompt-templates.ts   # System prompts
│   │   │   ├── query-generator.ts    # Search query generation
│   │   │   └── probability-analyzer.ts # Probability analysis
│   │   │
│   │   ├── research/                 # Search & research
│   │   │   ├── search-engine.ts      # Exa/Tavily integration
│   │   │   └── research-aggregator.ts # Research synthesis
│   │   │
│   │   ├── tree/                     # Tree generation engine
│   │   │   ├── tree-builder.ts       # Core tree expansion logic
│   │   │   └── node-processor.ts     # Individual node processing
│   │   │
│   │   ├── layout/                   # Visualization layout
│   │   │   └── depth-layout.ts       # Depth-aware hierarchical layout
│   │   │
│   │   ├── d3/                       # (To be implemented)
│   │   │   ├── probability-scale.ts
│   │   │   ├── sentiment-color.ts
│   │   │   └── animation.ts
│   │   │
│   │   └── export/                   # (To be implemented)
│   │       ├── json-exporter.ts
│   │       └── pdf-generator.ts
│   │
│   ├── types/
│   │   └── tree.ts                   # Core type definitions
│   │
│   └── hooks/                        # (To be implemented)
│       ├── useTreeExpansion.ts
│       └── useNodeProcessing.ts
│
├── public/                            # Static assets
│   └── (images, icons, etc.)
│
└── __tests__/                         # (To be implemented)
    ├── tree-generation.test.ts
    ├── probability-validation.test.ts
    ├── layout-algorithm.test.ts
    └── integration.test.ts
```

## Key Files Explained

### Core Logic

1. **src/lib/tree/tree-builder.ts**
   - Main tree generation orchestrator
   - Handles depth limits, concurrent processing
   - Manages tree state

2. **src/lib/tree/node-processor.ts**
   - Processes individual nodes
   - Coordinates research → analysis → child generation

3. **src/lib/llm/probability-analyzer.ts**
   - Analyzes research findings
   - Generates probability-weighted outcomes
   - Normalizes probabilities to sum to 1.0

4. **src/lib/layout/depth-layout.ts**
   - Calculates node positions
   - Implements depth-aware hierarchical layout
   - Converts tree to React Flow format

### UI Components

5. **src/app/page.tsx**
   - Main application entry point
   - Orchestrates form + visualization
   - Manages generation state

6. **src/components/TreeVisualization/TreeCanvas.tsx**
   - React Flow canvas wrapper
   - Handles node/edge rendering
   - Manages user interactions

7. **src/components/TreeVisualization/NodeTypes/EventNode.tsx**
   - Custom node visualization
   - Shows probability, sentiment, event text
   - Color-coded by sentiment

### Type Definitions

8. **src/types/tree.ts**
   - `EventNode`: Core tree node structure
   - `TreeState`: Global tree state
   - `SeedInput`: User input schema
   - `ProbabilityOutput`: LLM output schema

## Implementation Status

### ✅ Completed (Phase 1)
- Project structure
- Type definitions
- LLM orchestration layer
- Research/search module
- Tree generation engine
- Basic UI components
- React Flow visualization
- Depth-aware layout

### 🚧 In Progress (Phase 2)
- D3 enhancements
- Real-time expansion UI
- Node detail panel polish
- Testing suite

### 📋 To Do (Phase 3)
- Analysis dashboard
- Export functionality
- Performance optimizations
- Error handling improvements
- Documentation
- Deployment setup

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Add your OPENAI_API_KEY

# Run development server
npm run dev
```

## Development Workflow

1. **Add new feature**:
   - Define types in `src/types/`
   - Implement logic in `src/lib/`
   - Create UI in `src/components/`
   - Add tests in `__tests__/`

2. **Modify tree generation**:
   - Edit `src/lib/tree/tree-builder.ts` for orchestration
   - Edit `src/lib/tree/node-processor.ts` for node logic

3. **Change visualization**:
   - Edit `src/lib/layout/depth-layout.ts` for layout
   - Edit components in `src/components/TreeVisualization/`

4. **Tune LLM prompts**:
   - Edit `src/lib/llm/prompt-templates.ts`
   - Test with different seed events

## Architecture Principles

1. **Separation of Concerns**:
   - Logic layer (`lib/`) independent of UI
   - UI components receive pure data
   - State management isolated

2. **Type Safety**:
   - All data structures strongly typed
   - Zod schemas for runtime validation
   - No `any` types

3. **Modularity**:
   - Each module has single responsibility
   - Easy to swap providers (LLM, search)
   - Pluggable architecture

4. **Performance**:
   - Concurrent processing (max 20 nodes)
   - Lazy rendering in visualization
   - Caching for API calls

## Next Steps

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for detailed roadmap.
