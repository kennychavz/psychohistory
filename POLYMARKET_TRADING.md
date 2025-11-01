# Polymarket Trading API Integration

This project includes a complete TypeScript client for programmatic trading on Polymarket using their CLOB (Central Limit Order Book) API.

## 🚀 Features

- **Market Data**: Fetch available markets, prices, and order books
- **Order Placement**: Place market orders (instant execution) or limit orders (specified price)
- **Order Management**: Cancel individual orders or all open orders
- **Account Management**: View open orders and trade history
- **Simplified Trading**: Easy-to-use wrapper methods for common operations

## 📋 Prerequisites

1. **Polygon Wallet**: You need a wallet with a private key on Polygon (chain ID 137)
2. **Funds**: USDC on Polygon network for trading
3. **Legal Compliance**: Ensure you're not in a restricted jurisdiction (US persons prohibited)

## 🔧 Setup

### 1. Install Dependencies

Already installed in this project:
```bash
npm install @polymarket/clob-client ethers@5
```

### 2. Configure Environment Variables

Add your Polygon private key to `.env`:

```bash
# WARNING: Keep this secure! Only use test wallets with small amounts
POLYMARKET_PRIVATE_KEY=0x...your_private_key_here...
```

**Security Notes:**
- Never commit your private key to version control
- Use a dedicated wallet for trading with limited funds
- Consider using a hardware wallet for production

## 💡 Usage

### Basic Example

```typescript
import { createTradingClient } from './src/lib/polymarket/trading-client';

// Initialize client
const client = await createTradingClient(process.env.POLYMARKET_PRIVATE_KEY!);

// Get available markets
const markets = await client.getMarkets();
console.log(`Found ${markets.length} markets`);

// Get pricing for a specific token
const price = await client.getPrice(tokenId, 'BUY');
console.log(`Current buy price: $${price}`);

// Place a market order (executes immediately)
await client.placeMarketOrder({
  tokenId: 'token_id_here',
  amount: 10, // $10 USD
  side: 'BUY'
});

// Place a limit order (only executes at specified price)
await client.placeLimitOrder({
  tokenId: 'token_id_here',
  price: 0.55, // 55 cents per share
  size: 10, // 10 shares
  side: 'BUY'
});

// Simplified trading by market slug
await client.trade({
  market_slug: 'will-trump-win-2024',
  side: 'BUY',
  outcome: 'Yes',
  amount: 10 // $10 market order
});
```

### Run the Example Script

```bash
npm run polymarket:example
```

This will:
- Connect to Polymarket
- Display available markets
- Show pricing information
- Demonstrate order placement (simulated)
- Display account information

## 📚 API Reference

### Client Methods

#### Market Data

- `getMarkets()` - Fetch all available markets
- `getMarket(marketSlug)` - Get specific market by slug
- `getOrderBook(tokenId)` - Get order book for a token
- `getPrice(tokenId, side)` - Get current price (BUY/SELL)
- `getMidpoint(tokenId)` - Get midpoint price
- `getLastTradePrice(tokenId)` - Get last trade price

#### Trading

- `placeMarketOrder(order)` - Place market order (instant execution)
- `placeLimitOrder(order)` - Place limit order (specific price)
- `trade(params)` - Simplified trading method

#### Order Management

- `cancelOrder(orderId)` - Cancel specific order
- `cancelAllOrders()` - Cancel all open orders
- `getOpenOrders()` - Get all open orders
- `getTradeHistory()` - Get trade history

#### Account

- `getAddress()` - Get wallet address
- `initialize()` - Initialize API credentials (called automatically)

### Types

```typescript
interface MarketOrder {
  tokenId: string;
  amount: number; // Dollar amount
  side: 'BUY' | 'SELL';
}

interface LimitOrder {
  tokenId: string;
  price: number; // Between 0.00 and 1.00
  size: number; // Number of shares
  side: 'BUY' | 'SELL';
}

interface TradeParams {
  market_slug: string;
  side: 'BUY' | 'SELL';
  outcome: 'Yes' | 'No';
  amount?: number; // For market orders
  price?: number; // For limit orders
  size?: number; // For limit orders
}
```

## 🔐 Security Best Practices

1. **Use Test Wallets**: Start with a dedicated wallet containing small amounts
2. **Environment Variables**: Never hardcode private keys
3. **Version Control**: Add `.env` to `.gitignore`
4. **Rate Limiting**: Respect API rate limits
5. **Error Handling**: Always wrap trading calls in try-catch blocks
6. **Testing**: Test thoroughly on testnet or with minimal amounts first

## ⚠️ Important Warnings

- **Financial Risk**: Trading involves real money and financial risk
- **No Guarantees**: This software is provided as-is without warranties
- **Legal Compliance**: Ensure you comply with local regulations
- **US Restriction**: US persons are prohibited from trading on Polymarket
- **Test First**: Always test with small amounts before scaling

## 📖 Resources

- [Polymarket Documentation](https://docs.polymarket.com/)
- [Polymarket CLOB Client (GitHub)](https://github.com/Polymarket/py-clob-client)
- [Polymarket API Documentation](https://docs.polymarket.com/developers/CLOB/authentication)
- [Polygon Network](https://polygon.technology/)

## 🛠️ Troubleshooting

### Authentication Errors
- Verify your private key is correct
- Ensure your wallet has USDC on Polygon
- Check that you're not in a restricted jurisdiction

### Order Placement Failures
- Verify you have sufficient balance
- Check that the market is still open
- Ensure price is within valid range (0.00-1.00)

### Rate Limiting
- The API has rate limits - space out requests
- Consider implementing exponential backoff

## 📝 Example Trading Strategies

### Simple Buy Strategy
```typescript
// Buy when price drops below threshold
const price = await client.getPrice(tokenId, 'BUY');
if (price < 0.30) {
  await client.placeMarketOrder({
    tokenId,
    amount: 10,
    side: 'BUY'
  });
}
```

### Market Making
```typescript
// Place limit orders on both sides
await client.placeLimitOrder({
  tokenId,
  price: 0.48,
  size: 10,
  side: 'BUY'
});

await client.placeLimitOrder({
  tokenId,
  price: 0.52,
  size: 10,
  side: 'SELL'
});
```

## 🤝 Contributing

This is part of the Psychohistory project. See main README for contribution guidelines.

## 📄 License

See main project license.

---

**Disclaimer**: This software is for educational and research purposes. Use at your own risk. Always ensure compliance with local laws and regulations.
