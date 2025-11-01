import * as dotenv from 'dotenv';
import * as path from 'path';
import { createTradingClient } from '../src/lib/polymarket/trading-client';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Example: Get market information
 */
async function exampleGetMarkets(client: any) {
  console.log('\n📊 Fetching available markets...');
  const markets = await client.getMarkets();

  console.log(`Found ${markets.length} markets`);
  console.log('\nFirst 3 markets:');
  markets.slice(0, 3).forEach((market: any, idx: number) => {
    console.log(`\n${idx + 1}. ${market.question}`);
    console.log(`   Slug: ${market.market_slug}`);
    console.log(`   Tokens:`);
    market.tokens.forEach((token: any) => {
      console.log(`     - ${token.outcome}: $${token.price} (ID: ${token.token_id})`);
    });
  });
}

/**
 * Example: Get order book and pricing
 */
async function exampleGetPricing(client: any, tokenId: string) {
  console.log('\n💰 Fetching pricing information...');

  const midpoint = await client.getMidpoint(tokenId);
  const buyPrice = await client.getPrice(tokenId, 'BUY');
  const sellPrice = await client.getPrice(tokenId, 'SELL');
  const lastTradePrice = await client.getLastTradePrice(tokenId);

  console.log(`Token ID: ${tokenId}`);
  console.log(`Midpoint: $${midpoint.toFixed(4)}`);
  console.log(`Buy Price: $${buyPrice.toFixed(4)}`);
  console.log(`Sell Price: $${sellPrice.toFixed(4)}`);
  console.log(`Last Trade: $${lastTradePrice.toFixed(4)}`);

  const orderBook = await client.getOrderBook(tokenId);
  console.log(`\nOrder Book:`);
  console.log(`  Best Ask: $${orderBook.asks[0]?.price || 'N/A'} (${orderBook.asks[0]?.size || 0} shares)`);
  console.log(`  Best Bid: $${orderBook.bids[0]?.price || 'N/A'} (${orderBook.bids[0]?.size || 0} shares)`);
}

/**
 * Example: Place a limit order (SIMULATION ONLY - COMMENTED OUT)
 */
async function examplePlaceLimitOrder(client: any) {
  console.log('\n📝 Example: Placing a limit order...');
  console.log('⚠️  THIS IS A SIMULATION - ACTUAL ORDER PLACEMENT IS COMMENTED OUT');

  const orderParams = {
    tokenId: 'YOUR_TOKEN_ID',
    price: 0.55, // 55 cents per share
    size: 10, // 10 shares
    side: 'BUY' as const,
  };

  console.log('Order parameters:', orderParams);
  console.log('To place real orders, uncomment the following line:');
  console.log('// const result = await client.placeLimitOrder(orderParams);');

  // Uncomment to place real order:
  // const result = await client.placeLimitOrder(orderParams);
  // console.log('Order result:', result);
}

/**
 * Example: Place a market order (SIMULATION ONLY - COMMENTED OUT)
 */
async function examplePlaceMarketOrder(client: any) {
  console.log('\n💸 Example: Placing a market order...');
  console.log('⚠️  THIS IS A SIMULATION - ACTUAL ORDER PLACEMENT IS COMMENTED OUT');

  const orderParams = {
    tokenId: 'YOUR_TOKEN_ID',
    amount: 10, // $10 USD
    side: 'BUY' as const,
  };

  console.log('Order parameters:', orderParams);
  console.log('To place real orders, uncomment the following line:');
  console.log('// const result = await client.placeMarketOrder(orderParams);');

  // Uncomment to place real order:
  // const result = await client.placeMarketOrder(orderParams);
  // console.log('Order result:', result);
}

/**
 * Example: Simplified trade method (SIMULATION ONLY - COMMENTED OUT)
 */
async function exampleSimplifiedTrade(client: any) {
  console.log('\n🎯 Example: Simplified trade method...');
  console.log('⚠️  THIS IS A SIMULATION - ACTUAL TRADING IS COMMENTED OUT');

  const tradeParams = {
    market_slug: 'will-trump-be-inaugurated-in-2025',
    side: 'BUY' as const,
    outcome: 'Yes' as const,
    amount: 10, // $10 market order
  };

  console.log('Trade parameters:', tradeParams);
  console.log('To place real trades, uncomment the following line:');
  console.log('// const result = await client.trade(tradeParams);');

  // Uncomment to place real trade:
  // const result = await client.trade(tradeParams);
  // console.log('Trade result:', result);
}

/**
 * Example: Get account information
 */
async function exampleGetAccountInfo(client: any) {
  console.log('\n👤 Account Information...');

  const address = client.getAddress();
  console.log(`Wallet Address: ${address}`);

  const openOrders = await client.getOpenOrders();
  console.log(`Open Orders: ${openOrders.length}`);

  const tradeHistory = await client.getTradeHistory();
  console.log(`Trade History: ${tradeHistory.length} trades`);

  if (tradeHistory.length > 0) {
    console.log('\nRecent trades:');
    tradeHistory.slice(0, 3).forEach((trade: any, idx: number) => {
      console.log(`${idx + 1}. ${trade.side} ${trade.size} shares @ $${trade.price}`);
    });
  }
}

/**
 * Main function - demonstrates all features
 */
async function main() {
  try {
    console.log('='.repeat(70));
    console.log('Polymarket Trading Client - Example Usage');
    console.log('='.repeat(70));

    // Check for required environment variables
    const privateKey = process.env.POLYMARKET_PRIVATE_KEY;

    if (!privateKey) {
      console.error('\n❌ Error: POLYMARKET_PRIVATE_KEY not found in .env file');
      console.log('\nTo use this script:');
      console.log('1. Add your Polygon private key to .env:');
      console.log('   POLYMARKET_PRIVATE_KEY=0x...');
      console.log('2. Ensure you have funds on Polygon network');
      console.log('3. Review and uncomment actual trading code carefully');
      console.log('\n⚠️  WARNING: Trading involves real money. Test with small amounts first!');
      process.exit(1);
    }

    // Create and initialize the trading client
    console.log('\n🔧 Initializing Polymarket trading client...');
    const client = await createTradingClient(privateKey);
    console.log(`✓ Connected with address: ${client.getAddress()}\n`);

    // Run examples
    await exampleGetMarkets(client);

    // Get a token ID from the first market for pricing example
    const markets = await client.getMarkets();
    if (markets.length > 0 && markets[0].tokens.length > 0) {
      const sampleTokenId = markets[0].tokens[0].token_id;
      await exampleGetPricing(client, sampleTokenId);
    }

    await exampleGetAccountInfo(client);
    await examplePlaceLimitOrder(client);
    await examplePlaceMarketOrder(client);
    await exampleSimplifiedTrade(client);

    console.log('\n' + '='.repeat(70));
    console.log('✓ Examples completed successfully');
    console.log('='.repeat(70));
    console.log('\n⚠️  To place real trades, uncomment the trading code in the examples above');
    console.log('⚠️  Always test with small amounts first!');
    console.log('⚠️  Trading involves financial risk - use at your own discretion\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
