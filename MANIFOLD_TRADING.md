# Manifold Markets Trading API Integration

This project includes a complete TypeScript client for programmatic trading on Manifold Markets using their REST API.

## 🎮 Key Features

- **Play Money Trading**: Uses Mana (M$) - completely free, no real money involved
- **Full API Access**: Markets, bets, positions, and account management
- **No Geographic Restrictions**: Available worldwide (play money only)
- **Simple Authentication**: Just an API key, no crypto wallets needed
- **Risk-Free Practice**: Perfect for testing prediction market strategies

## 🆚 Manifold vs Polymarket

| Feature | Manifold | Polymarket |
|---------|----------|------------|
| Currency | Play money (Mana) | Real money (USDC) |
| Initial Balance | M$1000 free | Must deposit |
| Authentication | API key | Polygon wallet private key |
| Geographic Limits | None | US prohibited |
| Risk | Zero - play money | Real financial risk |
| Best For | Testing, learning | Real trading |

## 📋 Prerequisites

1. **Manifold Account**: Sign up at https://manifold.markets
2. **API Key**: Generate from your profile settings
3. **That's it!** No crypto wallet or real money needed

## 🔧 Setup

### 1. Create Manifold Account

1. Go to https://manifold.markets
2. Sign up (free)
3. You'll receive M$1000 to start trading

### 2. Generate API Key

1. Go to your profile
2. Click "Edit"
3. Find the "API Key" section
4. Click "Refresh" to generate a new key
5. Copy the key

### 3. Configure Environment Variables

Add your API key to `.env`:

```bash
MANIFOLD_API_KEY=your_api_key_here
```

**Security Notes:**
- Keep your API key private
- Don't commit it to version control
- Since it's play money, security risks are minimal

## 💡 Usage

### Basic Example

```typescript
import { createManifoldClient } from './src/lib/manifold/trading-client';

// Initialize client
const client = createManifoldClient(process.env.MANIFOLD_API_KEY!);

// Get your account info
const user = await client.getMe();
console.log(`Balance: M$${user.balance}`);

// Browse markets
const markets = await client.getMarkets({ limit: 10 });

// Search for specific markets
const results = await client.searchMarkets('Trump 2024', {
  filter: 'open',
  sort: 'volume'
});

// Place a bet
await client.placeBet({
  contractId: 'market_id',
  outcome: 'YES',
  amount: 10 // M$10
});

// Simplified betting
await client.bet('will-trump-win-2024', 'YES', 10);
```

### Run the Example Script

```bash
npm run manifold:example
```

This will:
- Display your account information
- Browse available markets
- Search for specific markets
- Show market details
- View your positions
- Demonstrate betting (simulated)

## 📚 API Reference

### Client Methods

#### Account Management

- `getMe()` - Get your account information
- `getUser(username)` - Get another user's public profile
- `getBalance()` - Get your current Mana balance
- `getProfitStats()` - Get profit statistics

#### Market Discovery

- `getMarkets(params)` - Get all markets with filters
- `getMarket(marketId)` - Get specific market by ID or slug
- `searchMarkets(query, params)` - Search markets by text

#### Trading

- `placeBet(bet)` - Place a bet with full control
- `bet(marketSlug, outcome, amount, limitProb?)` - Simplified betting
- `placeMultiBet(contractId, answers, amount)` - Bet on multiple choices
- `sellShares(marketId, outcome?, shares?)` - Sell shares

#### Order Management

- `cancelBet(betId)` - Cancel a limit order
- `getBets(marketId, params)` - Get bets on a market
- `getUserPositions(userId)` - Get user's positions

### Types

```typescript
interface ManifoldBet {
  amount: number;          // Mana amount (before fees)
  contractId: string;      // Market ID
  outcome?: 'YES' | 'NO';  // Default: YES
  limitProb?: number;      // For limit orders: 0.01-0.99
  expiresAt?: number;      // Unix timestamp
  dryRun?: boolean;        // Simulate without placing
}

interface ManifoldMarket {
  id: string;
  question: string;
  outcomeType: 'BINARY' | 'FREE_RESPONSE' | 'MULTIPLE_CHOICE' | 'NUMERIC' | 'PSEUDO_NUMERIC';
  probability?: number;    // For binary markets
  volume: number;
  isResolved: boolean;
  tags: string[];
  url: string;
}
```

## 🎯 Trading Features

### Market Orders
Instant execution at current price:
```typescript
await client.placeBet({
  contractId: 'market_id',
  outcome: 'YES',
  amount: 10
});
```

### Limit Orders
Execute only when price reaches target:
```typescript
await client.placeBet({
  contractId: 'market_id',
  outcome: 'YES',
  amount: 10,
  limitProb: 0.65  // Only bet if probability ≥ 65%
});
```

### Dry Run
Simulate bets without placing:
```typescript
await client.placeBet({
  contractId: 'market_id',
  outcome: 'YES',
  amount: 10,
  dryRun: true  // See impact without betting
});
```

### Sell Shares
Exit positions:
```typescript
// Sell all shares
await client.sellShares('market_id');

// Sell specific outcome
await client.sellShares('market_id', 'YES');

// Sell specific quantity
await client.sellShares('market_id', 'YES', 50);
```

## 📊 Example Strategies

### Simple Price Threshold
```typescript
const market = await client.getMarket('market-slug');
if (market.probability < 0.30) {
  await client.bet(market.id, 'YES', 50);
}
```

### Arbitrage Detection
```typescript
const markets = await client.searchMarkets('Trump 2024');
// Find price discrepancies between related markets
// Place offsetting bets for risk-free profit
```

### Portfolio Rebalancing
```typescript
const positions = await client.getUserPositions(userId);
for (const position of positions) {
  if (position.profit > 100) {
    await client.sellShares(position.contractId);
  }
}
```

## 🔐 API Rate Limits

- **500 requests per minute per IP**
- Generous limits for most use cases
- Consider adding delays for high-frequency strategies

## 💰 Mana Economics

- **Starting Balance**: M$1000 free
- **Transaction Fees**: Small fees on trades (creator + platform + liquidity)
- **No Cash Value**: Cannot convert to real money
- **Daily Bonuses**: Get free Mana for using the platform
- **Loans**: Borrow Mana to trade (pay back with profits)

## ✅ Advantages Over Real Money Markets

1. **Zero Risk**: Play money means no financial loss
2. **Easy Setup**: No KYC, wallets, or deposits
3. **Perfect for Testing**: Try strategies without consequences
4. **Global Access**: No geographic restrictions
5. **Learn & Practice**: Build skills before trading real money
6. **High Leverage**: Take bigger risks to test theories

## 📖 Resources

- [Manifold Markets](https://manifold.markets)
- [Manifold Documentation](https://docs.manifold.markets)
- [API Documentation](https://docs.manifold.markets/api)
- [Manifold Discord](https://discord.gg/eHQBNBqXuh)
- [GitHub](https://github.com/manifoldmarkets/manifold)

## 🛠️ Troubleshooting

### Authentication Errors
- Verify your API key is correct
- Check that you copied the full key
- Try regenerating the key from your profile

### Market Not Found
- Verify the market ID or slug
- Check if the market is still open
- Try searching instead of direct access

### Insufficient Balance
- Check your balance with `getBalance()`
- Markets may have minimum bet amounts
- You start with M$1000 - earn more by trading

## 🎓 Learning Resources

### For Beginners
1. Start with small bets (M$1-10)
2. Practice with diverse markets
3. Learn probability calibration
4. Study successful traders' profiles

### For Advanced Users
1. Build automated trading strategies
2. Implement market-making algorithms
3. Create arbitrage detection systems
4. Develop portfolio optimization tools

## 🤝 Contributing

This is part of the Psychohistory project. See main README for contribution guidelines.

## 📄 License

See main project license.

---

**Note**: Manifold Markets uses play money (Mana) for prediction markets. While this means zero financial risk, it also means you cannot profit monetarily. It's perfect for learning, testing strategies, and having fun with prediction markets!

## 🚀 Next Steps

1. Run `npm run manifold:example` to see it in action
2. Get your API key from Manifold Markets
3. Start with small test bets
4. Build and test your own strategies
5. Join the Manifold community for tips and discussions

Happy forecasting! 🎯
