import * as dotenv from 'dotenv';
import * as path from 'path';
import { createManifoldClient } from '../src/lib/manifold/trading-client';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Example: Get account information
 */
async function exampleGetAccountInfo(client: any) {
  console.log('\n👤 Account Information...');

  const user = await client.getMe();
  console.log(`Username: ${user.username}`);
  console.log(`Name: ${user.name}`);
  console.log(`Balance: M$${user.balance.toFixed(2)}`);
  console.log(`Total Deposits: M$${user.totalDeposits.toFixed(2)}`);

  if (user.profitCached) {
    console.log('\nProfit Statistics:');
    console.log(`  Daily: M$${user.profitCached.daily?.toFixed(2) || '0.00'}`);
    console.log(`  Weekly: M$${user.profitCached.weekly?.toFixed(2) || '0.00'}`);
    console.log(`  Monthly: M$${user.profitCached.monthly?.toFixed(2) || '0.00'}`);
    console.log(`  All Time: M$${user.profitCached.allTime?.toFixed(2) || '0.00'}`);
  }

  console.log(`\nProfile URL: ${user.url}`);
}

/**
 * Example: Browse available markets
 */
async function exampleBrowseMarkets(client: any) {
  console.log('\n📊 Browsing Markets...');

  // Get recent markets
  const markets = await client.getMarkets({ limit: 5 });

  console.log(`\nShowing ${markets.length} recent markets:\n`);

  markets.forEach((market: any, idx: number) => {
    console.log(`${idx + 1}. ${market.question}`);
    console.log(`   Type: ${market.outcomeType}`);

    if (market.probability !== undefined) {
      console.log(`   Current Probability: ${(market.probability * 100).toFixed(1)}%`);
    }

    console.log(`   Volume: M$${market.volume.toFixed(2)}`);
    console.log(`   24h Volume: M$${market.volume24Hours.toFixed(2)}`);
    console.log(`   Status: ${market.isResolved ? 'Resolved' : 'Open'}`);
    console.log(`   URL: ${market.url}`);
    console.log(`   ID: ${market.id}`);
    console.log();
  });
}

/**
 * Example: Search for specific markets
 */
async function exampleSearchMarkets(client: any) {
  console.log('\n🔍 Searching Markets...');

  const searchQuery = 'Trump 2024';
  console.log(`Searching for: "${searchQuery}"`);

  const results = await client.searchMarkets(searchQuery, {
    limit: 3,
    filter: 'open',
    sort: 'volume',
  });

  console.log(`\nFound ${results.length} results:\n`);

  results.forEach((market: any, idx: number) => {
    console.log(`${idx + 1}. ${market.question}`);
    if (market.probability !== undefined) {
      console.log(`   Probability: ${(market.probability * 100).toFixed(1)}%`);
    }
    console.log(`   Volume: M$${market.volume.toFixed(2)}`);
    console.log(`   URL: ${market.url}`);
    console.log();
  });
}

/**
 * Example: Get market details
 */
async function exampleGetMarketDetails(client: any, marketId: string) {
  console.log('\n📈 Market Details...');

  const market = await client.getMarket(marketId);

  console.log(`Question: ${market.question}`);
  console.log(`Creator: ${market.creatorName} (@${market.creatorUsername})`);
  console.log(`Created: ${new Date(market.createdTime).toLocaleDateString()}`);

  if (market.closeTime) {
    console.log(`Closes: ${new Date(market.closeTime).toLocaleDateString()}`);
  }

  console.log(`Type: ${market.outcomeType}`);

  if (market.probability !== undefined) {
    console.log(`Current Probability: ${(market.probability * 100).toFixed(2)}%`);
  }

  console.log(`Volume: M$${market.volume.toFixed(2)}`);
  console.log(`24h Volume: M$${market.volume24Hours.toFixed(2)}`);
  console.log(`Tags: ${market.tags.join(', ')}`);
  console.log(`Status: ${market.isResolved ? `Resolved: ${market.resolution}` : 'Open'}`);

  if (market.pool) {
    console.log('\nLiquidity Pool:');
    Object.entries(market.pool).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
  }
}

/**
 * Example: View your positions
 */
async function exampleViewPositions(client: any) {
  console.log('\n💼 Your Positions...');

  const user = await client.getMe();
  const positions = await client.getUserPositions(user.id);

  if (positions.length === 0) {
    console.log('No active positions.');
    return;
  }

  console.log(`You have ${positions.length} active positions:\n`);

  positions.slice(0, 5).forEach((position: any, idx: number) => {
    console.log(`${idx + 1}. ${position.question || 'Market ' + position.contractId}`);
    console.log(`   Investment: M$${position.invested?.toFixed(2) || 'N/A'}`);
    console.log(`   Current Value: M$${position.value?.toFixed(2) || 'N/A'}`);
    console.log(`   P&L: M$${position.profit?.toFixed(2) || 'N/A'}`);
    console.log();
  });
}

/**
 * Example: Get recent bets on a market
 */
async function exampleGetBets(client: any, marketId: string) {
  console.log('\n📜 Recent Bets...');

  const bets = await client.getBets(marketId, { limit: 5 });

  console.log(`Showing ${bets.length} recent bets:\n`);

  bets.forEach((bet: any, idx: number) => {
    console.log(`${idx + 1}. ${bet.outcome} - M$${bet.amount.toFixed(2)}`);
    console.log(`   User: ${bet.userName || bet.userId}`);
    console.log(`   Shares: ${bet.shares?.toFixed(2)}`);
    console.log(`   Time: ${new Date(bet.createdTime).toLocaleString()}`);
    console.log();
  });
}

/**
 * Example: Place a bet (SIMULATION - COMMENTED OUT)
 */
async function examplePlaceBet(client: any) {
  console.log('\n💸 Example: Placing a Bet...');
  console.log('⚠️  THIS IS A SIMULATION - ACTUAL BET PLACEMENT IS COMMENTED OUT');

  const betParams = {
    contractId: 'MARKET_ID_HERE',
    outcome: 'YES' as const,
    amount: 10, // M$10
  };

  console.log('\nBet parameters:');
  console.log(`  Market ID: ${betParams.contractId}`);
  console.log(`  Outcome: ${betParams.outcome}`);
  console.log(`  Amount: M$${betParams.amount}`);

  console.log('\nTo place real bets, uncomment the following line:');
  console.log('// const result = await client.placeBet(betParams);');

  // Uncomment to place real bet:
  // const result = await client.placeBet(betParams);
  // console.log('\n✓ Bet placed successfully!');
  // console.log(`  Bet ID: ${result.betId}`);
  // console.log(`  Shares: ${result.shares.toFixed(2)}`);
  // console.log(`  Probability before: ${(result.probBefore * 100).toFixed(2)}%`);
  // console.log(`  Probability after: ${(result.probAfter * 100).toFixed(2)}%`);
}

/**
 * Example: Place a limit order (SIMULATION - COMMENTED OUT)
 */
async function examplePlaceLimitOrder(client: any) {
  console.log('\n📝 Example: Placing a Limit Order...');
  console.log('⚠️  THIS IS A SIMULATION - ACTUAL ORDER PLACEMENT IS COMMENTED OUT');

  const limitOrderParams = {
    contractId: 'MARKET_ID_HERE',
    outcome: 'YES' as const,
    amount: 10, // M$10
    limitProb: 0.65, // Execute only if probability reaches 65%
  };

  console.log('\nLimit order parameters:');
  console.log(`  Market ID: ${limitOrderParams.contractId}`);
  console.log(`  Outcome: ${limitOrderParams.outcome}`);
  console.log(`  Amount: M$${limitOrderParams.amount}`);
  console.log(`  Limit Probability: ${(limitOrderParams.limitProb * 100).toFixed(0)}%`);

  console.log('\nTo place real limit orders, uncomment the following line:');
  console.log('// const result = await client.placeBet(limitOrderParams);');

  // Uncomment to place real limit order:
  // const result = await client.placeBet(limitOrderParams);
  // console.log('\n✓ Limit order placed successfully!');
}

/**
 * Example: Simplified bet method (SIMULATION - COMMENTED OUT)
 */
async function exampleSimplifiedBet(client: any) {
  console.log('\n🎯 Example: Simplified Bet Method...');
  console.log('⚠️  THIS IS A SIMULATION - ACTUAL BETTING IS COMMENTED OUT');

  const betParams = {
    marketSlug: 'will-trump-win-2024', // Can use slug or search query
    outcome: 'YES' as const,
    amount: 10,
  };

  console.log('\nSimplified bet parameters:');
  console.log(`  Market: ${betParams.marketSlug}`);
  console.log(`  Outcome: ${betParams.outcome}`);
  console.log(`  Amount: M$${betParams.amount}`);

  console.log('\nTo place real bets, uncomment the following line:');
  console.log('// const result = await client.bet(marketSlug, outcome, amount);');

  // Uncomment to place real bet:
  // const result = await client.bet(
  //   betParams.marketSlug,
  //   betParams.outcome,
  //   betParams.amount
  // );
  // console.log('\n✓ Bet placed successfully!');
}

/**
 * Example: Dry run (simulate bet without placing)
 */
async function exampleDryRun(client: any, marketId: string) {
  console.log('\n🧪 Dry Run (Simulation)...');

  try {
    const dryRunParams = {
      contractId: marketId,
      outcome: 'YES' as const,
      amount: 10,
      dryRun: true,
    };

    const result = await client.placeBet(dryRunParams);

    console.log('\nDry run completed (no bet placed):');
    console.log(`  Would receive: ${result.shares?.toFixed(2)} shares`);
    console.log(`  Probability would change: ${(result.probBefore * 100).toFixed(2)}% → ${(result.probAfter * 100).toFixed(2)}%`);
    console.log(`  Fees: M$${(result.fees?.creatorFee + result.fees?.platformFee + result.fees?.liquidityFee).toFixed(2)}`);
  } catch (error) {
    console.log('Dry run not available or failed:', error);
  }
}

/**
 * Main function - demonstrates all features
 */
async function main() {
  try {
    console.log('='.repeat(70));
    console.log('Manifold Markets Trading Client - Example Usage');
    console.log('='.repeat(70));

    // Check for required environment variables
    const apiKey = process.env.MANIFOLD_API_KEY;

    if (!apiKey) {
      console.error('\n❌ Error: MANIFOLD_API_KEY not found in .env file');
      console.log('\nTo use this script:');
      console.log('1. Create an account on https://manifold.markets');
      console.log('2. Go to your profile settings');
      console.log('3. Generate an API key');
      console.log('4. Add it to .env: MANIFOLD_API_KEY=your_key_here');
      console.log('\n💡 Note: Manifold uses play money (Mana) - no real money involved!');
      process.exit(1);
    }

    // Create the trading client
    console.log('\n🔧 Initializing Manifold trading client...');
    const client = createManifoldClient(apiKey);

    // Run examples
    await exampleGetAccountInfo(client);
    await exampleBrowseMarkets(client);
    await exampleSearchMarkets(client);

    // Get a sample market for detailed examples
    const markets = await client.getMarkets({ limit: 1 });
    if (markets.length > 0) {
      const sampleMarket = markets[0];
      await exampleGetMarketDetails(client, sampleMarket.id);
      await exampleGetBets(client, sampleMarket.id);

      // Only try dry run if market is open
      if (!sampleMarket.isResolved) {
        await exampleDryRun(client, sampleMarket.id);
      }
    }

    await exampleViewPositions(client);
    await examplePlaceBet(client);
    await examplePlaceLimitOrder(client);
    await exampleSimplifiedBet(client);

    console.log('\n' + '='.repeat(70));
    console.log('✓ Examples completed successfully');
    console.log('='.repeat(70));
    console.log('\n💡 To place real bets, uncomment the trading code in the examples above');
    console.log('💰 Remember: Manifold uses play money (Mana) - practice without risk!');
    console.log('🎮 Everyone starts with M$1000 free to trade\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
