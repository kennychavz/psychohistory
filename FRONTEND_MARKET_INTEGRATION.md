# 🎯 Frontend Market Analysis Integration - Quick Start

The Psychohistory frontend now has full integration with Manifold Markets for analyzing and trading prediction markets!

## ✨ What's New

### Two Input Modes

The seed input form now has **two tabs**:

1. **Custom Event** - Original functionality for analyzing any scenario
2. **🔮 Manifold Market** - New! Analyze prediction markets from Manifold

## 🚀 How to Use

### Step 1: Start the Development Server

```bash
cd /Users/kennychavez/git/Project-test
npm run dev
```

Navigate to `http://localhost:3000`

### Step 2: Switch to Manifold Market Tab

1. Click on the **🔮 Manifold Market** tab in the seed input form
2. You'll see a URL input field and trading options

### Step 3: Paste a Market URL

```
Example URL: https://manifold.markets/ItsMe/nvda-reaches-300-in-2025
```

1. Paste the Manifold market URL
2. Click **"Fetch"** to load market details
3. You'll see:
   - Market question
   - Current probability
   - Trading volume

### Step 4: Configure Trading (Optional)

**Dry Run (Default):**
- Leave "Execute trade automatically" **unchecked**
- Analysis will run without placing bets

**Auto-Trading:**
- Check "Execute trade automatically"
- Set **Bet Amount** (default: M$10)
- Adjust **Confidence Threshold** (default: 70%)
  - Higher = more selective, only trades when very confident

### Step 5: Generate Analysis

1. Adjust **Max Depth** (1-5) for analysis detail
2. Click **🔮 Analyze & Generate Tree**
3. Watch as the probability tree generates in real-time!

### Step 6: View Results

After generation completes, you'll see:

**Tree Visualization:**
- Full probability tree of scenarios
- Node colors by sentiment
- Click nodes to see details

**Market Analysis Panel (bottom-right):**
- **Market Probability**: Current market price
- **Analyzed Probability**: AI-generated probability
- **Difference**: Gap between market and analysis
- **Sentiment**: Overall confidence score
- **Trading Recommendation**: BUY_YES, BUY_NO, or SKIP
- **Trade Status**: If executed, shows bet ID and shares

## 📊 Understanding the Analysis

### Probability Comparison

```
Market:    45.0%  ← Current market consensus
Analyzed:  62.3%  ← AI analysis result
Difference: +17.3% ← Potential opportunity
```

### Trading Recommendations

| Recommendation | Meaning | When It Happens |
|---------------|---------|-----------------|
| **BUY YES** | Market undervalued | Analyzed prob > Market prob + 10% |
| **BUY NO** | Market overvalued | Analyzed prob < Market prob - 10% |
| **SKIP** | Prices aligned | Difference < 10% or low confidence |

### Confidence Threshold

- **50%**: Aggressive - trades on small differences
- **70%**: Balanced - moderate selectivity (default)
- **90%**: Conservative - only trades when very confident

## 🎨 UI Features

### Seed Input Form
- **Tab switching**: Toggle between Custom Event and Manifold Market
- **Live fetch**: Get market details instantly
- **Market preview**: See question, probability, volume before analyzing
- **Trading controls**: Enable/disable trading, set amount and threshold
- **Depth slider**: Adjust analysis depth (1-5)

### Market Analysis Panel
- **Floating overlay**: Appears bottom-right after analysis
- **Color-coded**: Green (undervalued), Red (overvalued), Gray (skip)
- **Trade confirmation**: Shows bet ID if trade was executed
- **Direct link**: Click to view market on Manifold

### Tree Visualization
- **Full tree view**: See all analyzed scenarios
- **Node details**: Click nodes to see probabilities and justifications
- **Real-time updates**: Watch nodes appear as they're processed
- **Most probable path**: Highlighted with golden glow

## ⚙️ Configuration

### Environment Variables Required

```bash
# .env file
MANIFOLD_API_KEY=your_manifold_api_key_here
OPENROUTER_API_KEY=your_openrouter_key
EXA_API_KEY=your_exa_key
SEARCH_PROVIDER=exa
```

### Get Your Manifold API Key

1. Go to https://manifold.markets
2. Sign up / Log in
3. Click your profile → Edit
4. Find "API Key" section
5. Click "Refresh" to generate
6. Copy and paste into `.env`

## 📝 Example Workflow

### 1. Quick Analysis (No Trading)

```
1. Switch to "Manifold Market" tab
2. Paste: https://manifold.markets/user/market-slug
3. Click "Fetch"
4. Keep trading OFF (dry run)
5. Click "Analyze & Generate Tree"
6. Review analysis panel results
```

### 2. Automated Trading

```
1. Switch to "Manifold Market" tab
2. Paste market URL → Fetch
3. Check "Execute trade automatically"
4. Set amount: M$20
5. Set threshold: 75%
6. Click "Analyze & Generate Tree"
7. If confidence > 75%, bet will execute
8. See trade confirmation in results panel
```

### 3. Deep Analysis

```
1. Paste market URL → Fetch
2. Set Max Depth: 4 or 5
3. Increase confidence threshold: 85%
4. Enable trading if desired
5. Generate (takes 3-5 min for depth 4-5)
6. Review comprehensive tree + analysis
```

## 🎯 Tips & Best Practices

### For Accurate Analysis
- ✅ Use markets with clear causal factors
- ✅ Binary YES/NO markets work best
- ✅ Medium-term events (weeks/months)
- ✅ Markets with good volume (>M$100)
- ❌ Avoid pure randomness (coin flips)
- ❌ Skip very short-term events (<24hr)

### For Safe Trading
- ✅ Start with M$1-10 bets
- ✅ Use dry run mode first
- ✅ Set high confidence thresholds (>70%)
- ✅ Review analysis before enabling auto-trade
- ❌ Don't bet your entire balance
- ❌ Don't blindly follow recommendations

### For Better Results
- 📈 Increase depth for complex questions
- 📈 Higher thresholds = more selective
- 📈 Check "Most Probable Path" for logic
- 📈 Compare multiple markets
- 📉 Lower depth for quick analysis
- 📉 Lower thresholds for more trades

## 🐛 Troubleshooting

### "Failed to fetch market"
- Check URL is correct Manifold format
- Ensure market is still open (not resolved)
- Verify internet connection

### "MANIFOLD_API_KEY not configured"
- Add API key to `.env` file
- Restart dev server after updating `.env`

### Tree generation is slow
- Reduce Max Depth (try 2 instead of 3)
- Check LLM API is responding
- Verify search API (Exa/Tavily) is working

### No trading recommendation
- Market and analyzed probabilities too close
- Sentiment too neutral
- Try increasing tree depth for more data

## 📚 Related Documentation

- [MARKET_ANALYSIS.md](./MARKET_ANALYSIS.md) - Full market analysis guide
- [MANIFOLD_TRADING.md](./MANIFOLD_TRADING.md) - Manifold API details
- [DPO_GUIDE.md](./DPO_GUIDE.md) - Training the system

## 🎉 Features Summary

✅ Dual-mode input (Custom / Manifold)
✅ Live market fetching
✅ Auto-trading option
✅ Configurable thresholds
✅ Real-time tree generation
✅ Market analysis overlay
✅ Trade execution confirmation
✅ Color-coded recommendations
✅ Direct links to markets

---

**Ready to analyze markets? Open `http://localhost:3000` and try the 🔮 Manifold Market tab!**
