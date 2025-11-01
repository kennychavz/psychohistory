import * as dotenv from 'dotenv';
import * as path from 'path';
import { createManifoldClient } from '../src/lib/manifold/trading-client';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testTrade() {
  try {
    console.log('='.repeat(70));
    console.log('Manifold Markets - Test Trade');
    console.log('='.repeat(70));

    // Check for API key
    const apiKey = process.env.MANIFOLD_API_KEY;
    if (!apiKey) {
      console.error('\n❌ Error: MANIFOLD_API_KEY not found in .env file');
      process.exit(1);
    }

    // Initialize client
    console.log('\n🔧 Initializing Manifold client...');
    const client = createManifoldClient(apiKey);

    // Get account info
    console.log('\n👤 Getting account information...');
    const user = await client.getMe();
    console.log(`✓ Connected as: ${user.name} (@${user.username})`);
    console.log(`  Current balance: M$${user.balance.toFixed(2)}`);

    if (user.balance < 1) {
      console.error('\n❌ Insufficient balance. You need at least M$1 to place a test bet.');
      process.exit(1);
    }

    // Find an open binary market with decent volume
    console.log('\n🔍 Finding a suitable market for testing...');
    const markets = await client.getMarkets({ limit: 50 });

    // Filter for open binary markets
    const openBinaryMarkets = markets.filter(m =>
      !m.isResolved &&
      m.outcomeType === 'BINARY' &&
      m.volume > 10 && // Has some activity
      (!m.closeTime || m.closeTime > Date.now())
    );

    if (openBinaryMarkets.length === 0) {
      console.error('\n❌ No suitable markets found for testing');
      process.exit(1);
    }

    // Pick the first suitable market
    const testMarket = openBinaryMarkets[0];
    console.log(`✓ Selected market: ${testMarket.question}`);
    console.log(`  Current probability: ${(testMarket.probability! * 100).toFixed(1)}%`);
    console.log(`  Volume: M$${testMarket.volume.toFixed(2)}`);
    console.log(`  Market ID: ${testMarket.id}`);
    console.log(`  URL: ${testMarket.url}`);

    // Decide which side to bet on (bet on the less likely outcome for fun)
    const outcome = testMarket.probability! > 0.5 ? 'NO' : 'YES';
    const betAmount = 1; // Minimum bet

    console.log(`\n💸 Placing test bet...`);
    console.log(`  Outcome: ${outcome}`);
    console.log(`  Amount: M$${betAmount}`);

    // First do a dry run to see what would happen
    console.log('\n🧪 Running simulation (dry run)...');
    try {
      const dryRunResult = await client.placeBet({
        contractId: testMarket.id,
        outcome: outcome as 'YES' | 'NO',
        amount: betAmount,
        dryRun: true,
      });

      console.log('✓ Dry run successful:');
      console.log(`  Would receive: ${dryRunResult.shares?.toFixed(4)} shares`);
      console.log(`  Probability would change: ${(dryRunResult.probBefore * 100).toFixed(2)}% → ${(dryRunResult.probAfter * 100).toFixed(2)}%`);

      if (dryRunResult.fees) {
        const totalFees = dryRunResult.fees.creatorFee + dryRunResult.fees.platformFee + dryRunResult.fees.liquidityFee;
        console.log(`  Total fees: M$${totalFees.toFixed(4)}`);
      }
    } catch (error) {
      console.log('  Note: Dry run not available, proceeding with real bet...');
    }

    // Now place the actual bet
    console.log('\n✅ Placing REAL bet...');
    const result = await client.placeBet({
      contractId: testMarket.id,
      outcome: outcome as 'YES' | 'NO',
      amount: betAmount,
    });

    console.log('\n🎉 SUCCESS! Bet placed successfully!');
    console.log('='.repeat(70));
    console.log('\nBet Details:');
    console.log(`  Bet ID: ${result.betId}`);
    console.log(`  Market: ${testMarket.question}`);
    console.log(`  Outcome: ${outcome}`);
    console.log(`  Amount: M$${betAmount}`);
    console.log(`  Shares received: ${result.shares.toFixed(4)}`);
    console.log(`  Probability before: ${(result.probBefore * 100).toFixed(2)}%`);
    console.log(`  Probability after: ${(result.probAfter * 100).toFixed(2)}%`);

    if (result.fees) {
      console.log(`\nFees:`);
      console.log(`  Creator fee: M$${result.fees.creatorFee.toFixed(4)}`);
      console.log(`  Platform fee: M$${result.fees.platformFee.toFixed(4)}`);
      console.log(`  Liquidity fee: M$${result.fees.liquidityFee.toFixed(4)}`);
    }

    // Get updated balance
    const updatedBalance = await client.getBalance();
    console.log(`\nUpdated balance: M$${updatedBalance.toFixed(2)}`);
    console.log(`Change: M$${(updatedBalance - user.balance).toFixed(2)}`);

    console.log('\n' + '='.repeat(70));
    console.log('✓ Test trade completed successfully!');
    console.log(`\nView your bet: ${testMarket.url}`);
    console.log('='.repeat(70));

  } catch (error: any) {
    console.error('\n❌ Error during test trade:', error.message);
    if (error.response?.data) {
      console.error('API Error:', error.response.data);
    }
    process.exit(1);
  }
}

testTrade();
