# 🔮 Psychohistory Market Analysis & Auto-Trading

Analyze prediction markets using AI-powered probability tree analysis and automatically trade based on the insights.

## Overview

This feature integrates the Psychohistory probability tree engine with Manifold Markets to:

1. **Extract** market questions from Manifold URLs
2. **Analyze** using deep probability tree analysis (LLM + research)
3. **Compare** analyzed probability vs current market price
4. **Recommend** whether to buy YES, buy NO, or skip
5. **Execute** trades automatically (optional)

## 🎯 How It Works

### Step-by-Step Process

1. **Market Discovery**: Paste a Manifold market URL
2. **Tree Generation**: Creates a probability tree analyzing the market question
   - Depth 0: Root question from the market
   - Depth 1-3: Sub-scenarios and outcomes
   - Each node has: probability, sentiment, justification, sources
3. **Analysis**: Calculates analyzed probability from the tree
   - Weighted by sentiment and node depth
   - Identifies most probable path
   - Compares against current market price
4. **Trading Decision**:
   - **BUY YES** if market is underpriced (analyzed prob > market prob + 10%)
   - **BUY NO** if market is overpriced (analyzed prob < market prob - 10%)
   - **SKIP** if prices are aligned or confidence is low
5. **Execution**: Optionally places bet on Manifold Markets

### Decision Logic

```
IF |analyzed_prob - market_prob| < threshold:
    SKIP (low confidence)

IF |sentiment| < 20:
    SKIP (unclear direction)

IF analyzed_prob > market_prob + 0.1:
    BUY YES (market undervalued)

IF analyzed_prob < market_prob - 0.1:
    BUY NO (market overvalued)

ELSE:
    SKIP (prices aligned)
```

## 🚀 Usage

### Command Line Interface

```bash
# Dry run (analyze only, no trading)
npm run analyze-market <market_url>

# Analyze and trade
npm run analyze-market <market_url> --trade

# Custom bet amount
npm run analyze-market <market_url> --trade --amount=50

# Adjust analysis depth
npm run analyze-market <market_url> --depth=4

# Custom confidence threshold
npm run analyze-market <market_url> --trade --threshold=0.8
```

### Options

- `--trade` - Actually place a bet (default: dry run)
- `--amount=<number>` - Bet amount in Mana (default: 10)
- `--depth=<number>` - Tree depth for analysis (default: 3)
- `--threshold=<number>` - Confidence threshold 0-1 (default: 0.7)

### Examples

```bash
# Example 1: Analyze a market (dry run)
npm run analyze-market https://manifold.markets/ItsMe/nvda-reaches-300-in-2025

# Example 2: Analyze and trade M$20
npm run analyze-market https://manifold.markets/ItsMe/nvda-reaches-300-in-2025 --trade --amount=20

# Example 3: Deep analysis (depth 4) with high confidence threshold
npm run analyze-market https://manifold.markets/user/market-slug --depth=4 --threshold=0.8 --trade
```

### API Endpoint

```typescript
POST /api/analyze-market

Body: {
  marketUrl: string,              // Required: Manifold market URL
  shouldTrade?: boolean,          // Optional: Execute trade (default: false)
  betAmount?: number,             // Optional: Bet amount (default: 10)
  confidenceThreshold?: number,   // Optional: 0-1 (default: 0.7)
  maxDepth?: number               // Optional: Tree depth (default: 3)
}

Response: {
  market: {
    id: string,
    question: string,
    currentProbability: number,
    url: string
  },
  analysis: {
    analyzedProbability: number,
    sentiment: number,
    totalNodes: number,
    mostProbablePath: Array<{
      event: string,
      probability: number,
      depth: number
    }>,
    justification: string
  },
  trade?: {
    executed: boolean,
    recommendation: 'BUY_YES' | 'BUY_NO' | 'SKIP',
    reason: string,
    outcome?: 'YES' | 'NO',
    amount?: number,
    betId?: string,
    shares?: number
  }
}
```

## 📊 Example Output

```
==================================================
🔮 Psychohistory Market Analyzer
==================================================

📊 Step 1: Fetching market details...
✓ Market found: NVDA reaches $300 in 2025?
  Current probability: 13.9%
  Volume: M$1488.00
  Status: Open
  URL: https://manifold.markets/ItsMe/nvda-reaches-300-in-2025

🌳 Step 2: Generating probability tree...
  Max depth: 3
  This may take a few minutes...
✓ Tree generated successfully

🔍 Step 3: Analyzing results...

==================================================
📈 ANALYSIS RESULTS
==================================================

Market Question: NVDA reaches $300 in 2025?

Current Market Price: 13.9%
Analyzed Probability: 25.3%
Difference: +11.4%
Average Sentiment: 42.3
Total Nodes Analyzed: 45

🛤️  Most Probable Path:
  0. [100.0%] NVDA reaches $300 in 2025?
     Sentiment: 0.0
  1. [35.0%] Strong AI chip demand continues through 2025
     Sentiment: 65.2
  2. [72.1%] Data center expansion accelerates
     Sentiment: 58.4
  3. [80.5%] Market share gains in enterprise AI

==================================================
💡 TRADING RECOMMENDATION
==================================================

Recommendation: BUY_YES
Reason: Market undervalued: current 13.9% vs analyzed 25.3%
Suggested Outcome: YES
Suggested Amount: M$10

🧪 DRY RUN: No bet placed (use --trade to execute)

==================================================
✓ Analysis complete!
==================================================
```

## ⚙️ Configuration

### Environment Variables

```bash
# Required
MANIFOLD_API_KEY=your_api_key_here

# For LLM analysis
OPENROUTER_API_KEY=your_openrouter_key

# For research
EXA_API_KEY=your_exa_key  # or use TAVILY_API_KEY
SEARCH_PROVIDER=exa        # or 'tavily'
```

### Adjustable Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `maxDepth` | 3 | How deep to build the probability tree (1-5) |
| `betAmount` | 10 | Amount to bet in Mana |
| `confidenceThreshold` | 0.7 | Minimum confidence to place bet (0-1) |
| `shouldTrade` | false | Whether to actually execute trades |

## 🎓 Understanding the Analysis

### Probability Tree

The analysis creates a tree of scenarios:

```
Root: "Will Trump win 2024?"
├─ YES (60%)
│  ├─ Economy strong → YES more likely
│  ├─ High turnout → YES more likely
│  └─ Legal issues resolved → YES more likely
└─ NO (40%)
   ├─ Economy weak → NO more likely
   └─ Low turnout → NO more likely
```

### Analyzed Probability

The final analyzed probability is calculated by:
1. Weighting each path by its cumulative probability
2. Adjusting for sentiment (positive/negative confidence)
3. Considering research evidence from sources

### Trading Signals

**Strong Buy Signals:**
- Large gap between analyzed and market probability (>15%)
- Strong positive sentiment (>50)
- Deep, well-researched tree (>30 nodes)
- Clear most probable path

**Weak/Skip Signals:**
- Small gap (<10%)
- Neutral sentiment (-20 to +20)
- Shallow tree (<20 nodes)
- Conflicting probabilities

## 💡 Best Practices

### When to Use

✅ **Good Use Cases:**
- Binary YES/NO markets
- Markets with clear causal factors
- Events with available research data
- Medium-term outcomes (weeks to months)

❌ **Poor Use Cases:**
- Multiple choice markets (not yet supported)
- Pure randomness (coin flips, dice)
- Very short-term events (<24 hours)
- Markets with insider information

### Risk Management

1. **Start Small**: Use M$1-10 for initial tests
2. **Dry Run First**: Always analyze without trading first
3. **Set Limits**: Use confidence thresholds
4. **Diversify**: Don't bet everything on one market
5. **Review Results**: Track your win rate over time

### Optimization

**For Better Accuracy:**
- Increase `maxDepth` (3-5) for complex questions
- Raise `confidenceThreshold` (0.8-0.9) to be more selective
- Review the "Most Probable Path" for logical consistency

**For Speed:**
- Decrease `maxDepth` (1-2) for quick analysis
- Lower `confidenceThreshold` (0.5-0.6) for more trades

## 🔬 Advanced Usage

### Batch Analysis

Analyze multiple markets:

```bash
#!/bin/bash
markets=(
  "https://manifold.markets/user/market-1"
  "https://manifold.markets/user/market-2"
  "https://manifold.markets/user/market-3"
)

for market in "${markets[@]}"; do
  npm run analyze-market "$market" --trade --amount=5
  sleep 60  # Rate limiting
done
```

### Integration with Custom Strategies

```typescript
import { TreeBuilder } from '@/lib/tree/tree-builder';
import { createManifoldClient } from '@/lib/manifold/trading-client';

async function customStrategy() {
  const manifold = createManifoldClient(apiKey);
  const markets = await manifold.searchMarkets('AI', {
    filter: 'open',
    limit: 10
  });

  for (const market of markets) {
    // Analyze each market
    const builder = new TreeBuilder(3, 20);
    const tree = await builder.buildTree({
      event: market.question,
      maxDepth: 3
    });

    // Your custom logic here
    const shouldBet = customLogic(tree, market);

    if (shouldBet) {
      await manifold.placeBet({
        contractId: market.id,
        outcome: 'YES',
        amount: 10
      });
    }
  }
}
```

## 🐛 Troubleshooting

### Common Issues

**"MANIFOLD_API_KEY not found"**
- Add your API key to `.env`
- Generate from: https://manifold.markets/profile → Edit → API Key

**"Market is already resolved"**
- The market has closed
- Find open markets only

**"Only binary markets supported"**
- Multiple choice markets not yet implemented
- Use binary YES/NO markets

**Analysis takes too long**
- Reduce `maxDepth` (try 2)
- Check your internet connection
- Verify LLM API is responding

**Poor trading recommendations**
- Increase `confidenceThreshold`
- Check if market has enough historical data
- Review "Most Probable Path" for logic errors

## 📈 Performance Metrics

Track your performance over time:

```bash
# View your trading history
npm run manifold:example  # Shows positions and P&L
```

Consider logging:
- Win rate (% of profitable bets)
- Average return per bet
- Sharpe ratio (return vs risk)
- Correlation with market movements

## 🚧 Limitations

Current limitations:
- **Play money only**: Manifold uses Mana (M$), not real currency
- **Binary markets only**: Multiple choice not yet supported
- **Depth limit**: Max depth 5 (computational constraints)
- **Rate limits**: API has 500 req/min limit
- **Analysis time**: 2-5 minutes for depth-3 analysis

## 🔮 Future Enhancements

Planned features:
- [ ] Support for multiple choice markets
- [ ] Real-time market monitoring
- [ ] Portfolio optimization
- [ ] Backtesting framework
- [ ] Performance analytics dashboard
- [ ] Polymarket integration (real money)
- [ ] Automated market scanning

## 📚 Related Documentation

- [MANIFOLD_TRADING.md](./MANIFOLD_TRADING.md) - Manifold Markets API guide
- [POLYMARKET_TRADING.md](./POLYMARKET_TRADING.md) - Polymarket integration
- [DPO_GUIDE.md](./DPO_GUIDE.md) - Training data collection

## ⚖️ Disclaimer

This tool is for educational and research purposes. Prediction markets involve risk (even play money represents time investment). Past performance does not guarantee future results. Always:

- Start with small amounts
- Test thoroughly in dry-run mode
- Review recommendations manually
- Understand the underlying logic
- Use at your own discretion

---

**Happy forecasting! 🎯**
