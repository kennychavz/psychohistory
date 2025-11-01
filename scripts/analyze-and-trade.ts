import * as dotenv from 'dotenv';
import * as path from 'path';
import { TreeBuilder } from '../src/lib/tree/tree-builder';
import { createManifoldClient } from '../src/lib/manifold/trading-client';
import { EventNode } from '../src/types/tree';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Extract market slug from Manifold URL
 */
function extractMarketSlug(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      return pathParts[pathParts.length - 1];
    }
    throw new Error('Invalid URL format');
  } catch (error) {
    throw new Error(`Failed to parse market URL: ${error}`);
  }
}

/**
 * Calculate analyzed probability from tree
 */
function calculateAnalyzedProbability(root: EventNode): number {
  if (root.children.length === 0) {
    return root.probability;
  }

  let weightedSum = 0;
  let totalWeight = 0;

  root.children.forEach(child => {
    const weight = Math.abs(child.sentiment) / 100;
    weightedSum += child.probability * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
}

/**
 * Find most probable path through tree
 */
function findMostProbablePath(root: EventNode): EventNode[] {
  const path: EventNode[] = [root];
  let current = root;

  while (current.children.length > 0) {
    const mostProbableChild = current.children.reduce((max, child) =>
      child.probability > max.probability ? child : max
    );
    path.push(mostProbableChild);
    current = mostProbableChild;
  }

  return path;
}

/**
 * Calculate average sentiment
 */
function calculateAverageSentiment(root: EventNode): number {
  const allNodes: EventNode[] = [];

  function traverse(node: EventNode) {
    allNodes.push(node);
    node.children.forEach(traverse);
  }

  traverse(root);

  const totalSentiment = allNodes.reduce((sum, node) => sum + node.sentiment, 0);
  return allNodes.length > 0 ? totalSentiment / allNodes.length : 0;
}

/**
 * Determine trading recommendation
 * ALWAYS returns a trade (never SKIP)
 */
function determineTradingRecommendation(
  currentProb: number,
  analyzedProb: number,
  confidenceThreshold: number,
  sentiment: number
): { recommendation: 'BUY_YES' | 'BUY_NO' | 'SKIP'; reason: string; outcome?: 'YES' | 'NO' } {
  const difference = Math.abs(currentProb - analyzedProb);

  // If analyzed probability is higher than current market price → BUY YES
  if (analyzedProb > currentProb) {
    return {
      recommendation: 'BUY_YES',
      outcome: 'YES',
      reason: `Analysis suggests higher probability: current ${(currentProb * 100).toFixed(1)}% vs analyzed ${(analyzedProb * 100).toFixed(1)}% (diff: ${(difference * 100).toFixed(1)}%, sentiment: ${sentiment.toFixed(1)})`
    };
  }

  // If analyzed probability is lower than current market price → BUY NO
  if (analyzedProb < currentProb) {
    return {
      recommendation: 'BUY_NO',
      outcome: 'NO',
      reason: `Analysis suggests lower probability: current ${(currentProb * 100).toFixed(1)}% vs analyzed ${(analyzedProb * 100).toFixed(1)}% (diff: ${(difference * 100).toFixed(1)}%, sentiment: ${sentiment.toFixed(1)})`
    };
  }

  // Probabilities are equal → Use sentiment as tiebreaker
  if (sentiment >= 0) {
    return {
      recommendation: 'BUY_YES',
      outcome: 'YES',
      reason: `Probabilities equal (${(currentProb * 100).toFixed(1)}%), positive sentiment (${sentiment.toFixed(1)}) → betting YES`
    };
  } else {
    return {
      recommendation: 'BUY_NO',
      outcome: 'NO',
      reason: `Probabilities equal (${(currentProb * 100).toFixed(1)}%), negative sentiment (${sentiment.toFixed(1)}) → betting NO`
    };
  }
}

async function main() {
  try {
    console.log('='.repeat(80));
    console.log('🔮 Psychohistory Market Analyzer');
    console.log('='.repeat(80));

    // Parse command line arguments
    const args = process.argv.slice(2);
    const marketUrl = args[0];
    const shouldTrade = args.includes('--trade');
    const betAmount = parseFloat(args.find(arg => arg.startsWith('--amount='))?.split('=')[1] || '10');
    const maxDepth = parseInt(args.find(arg => arg.startsWith('--depth='))?.split('=')[1] || '3');
    const confidenceThreshold = parseFloat(args.find(arg => arg.startsWith('--threshold='))?.split('=')[1] || '0.7');

    if (!marketUrl) {
      console.error('\n❌ Error: Market URL is required\n');
      console.log('Usage: npm run analyze-market <market_url> [options]');
      console.log('\nOptions:');
      console.log('  --trade              Actually place a bet (default: dry run)');
      console.log('  --amount=<number>    Bet amount in Mana (default: 10)');
      console.log('  --depth=<number>     Tree depth for analysis (default: 3)');
      console.log('  --threshold=<number> Confidence threshold (default: 0.7)');
      console.log('\nExamples:');
      console.log('  npm run analyze-market https://manifold.markets/user/market-slug');
      console.log('  npm run analyze-market https://manifold.markets/user/market-slug --trade --amount=20');
      process.exit(1);
    }

    // Check for API key
    const apiKey = process.env.MANIFOLD_API_KEY;
    if (!apiKey) {
      console.error('\n❌ Error: MANIFOLD_API_KEY not found in .env file');
      process.exit(1);
    }

    console.log('\n📊 Step 1: Fetching market details...');
    const marketSlug = extractMarketSlug(marketUrl);
    const manifold = createManifoldClient(apiKey);
    const market = await manifold.getMarket(marketSlug);

    console.log(`✓ Market found: ${market.question}`);
    console.log(`  Current probability: ${(market.probability! * 100).toFixed(1)}%`);
    console.log(`  Volume: M$${market.volume.toFixed(2)}`);
    console.log(`  Status: ${market.isResolved ? 'Resolved' : 'Open'}`);
    console.log(`  URL: ${market.url}`);

    if (market.isResolved) {
      console.error('\n❌ Error: Market is already resolved');
      process.exit(1);
    }

    if (market.outcomeType !== 'BINARY') {
      console.error('\n❌ Error: Only binary markets are supported');
      process.exit(1);
    }

    console.log('\n🌳 Step 2: Generating probability tree...');
    console.log(`  Max depth: ${maxDepth}`);
    console.log(`  This may take a few minutes...`);

    const builder = new TreeBuilder(maxDepth, 20);
    const tree = await builder.buildTree({
      event: market.question,
      maxDepth,
      domain: 'general'
    });

    console.log('✓ Tree generated successfully');

    console.log('\n🔍 Step 3: Analyzing results...');
    const analyzedProb = calculateAnalyzedProbability(tree);
    const avgSentiment = calculateAverageSentiment(tree);
    const mostProbablePath = findMostProbablePath(tree);

    // Count total nodes
    let totalNodes = 0;
    function countNodes(node: EventNode): void {
      totalNodes++;
      node.children.forEach(countNodes);
    }
    countNodes(tree);

    console.log('\n' + '='.repeat(80));
    console.log('📈 ANALYSIS RESULTS');
    console.log('='.repeat(80));
    console.log(`\nMarket Question: ${market.question}`);
    console.log(`\nCurrent Market Price: ${(market.probability! * 100).toFixed(1)}%`);
    console.log(`Analyzed Probability: ${(analyzedProb * 100).toFixed(1)}%`);
    console.log(`Difference: ${((analyzedProb - market.probability!) * 100).toFixed(1)}%`);
    console.log(`Average Sentiment: ${avgSentiment.toFixed(1)}`);
    console.log(`Total Nodes Analyzed: ${totalNodes}`);

    console.log('\n🛤️  Most Probable Path:');
    mostProbablePath.forEach((node, idx) => {
      console.log(`  ${idx}. [${(node.probability * 100).toFixed(1)}%] ${node.event}`);
      if (idx < mostProbablePath.length - 1) {
        console.log(`     Sentiment: ${node.sentiment.toFixed(1)}`);
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log('💡 TRADING RECOMMENDATION');
    console.log('='.repeat(80));

    const recommendation = determineTradingRecommendation(
      market.probability!,
      analyzedProb,
      confidenceThreshold,
      avgSentiment
    );

    console.log(`\nRecommendation: ${recommendation.recommendation}`);
    console.log(`Reason: ${recommendation.reason}`);

    if (recommendation.outcome) {
      console.log(`Suggested Outcome: ${recommendation.outcome}`);
      console.log(`Suggested Amount: M$${betAmount}`);
    }

    if (shouldTrade && recommendation.recommendation !== 'SKIP') {
      console.log('\n💸 Step 4: Placing bet...');

      const betResult = await manifold.placeBet({
        contractId: market.id,
        outcome: recommendation.outcome!,
        amount: betAmount
      });

      console.log('\n🎉 SUCCESS! Bet placed successfully!');
      console.log('='.repeat(80));
      console.log(`\nBet ID: ${betResult.betId}`);
      console.log(`Outcome: ${recommendation.outcome}`);
      console.log(`Amount: M$${betAmount}`);
      console.log(`Shares Received: ${betResult.shares.toFixed(4)}`);
      console.log(`Probability Before: ${(betResult.probBefore * 100).toFixed(2)}%`);
      console.log(`Probability After: ${(betResult.probAfter * 100).toFixed(2)}%`);

      const updatedBalance = await manifold.getBalance();
      console.log(`\nUpdated Balance: M$${updatedBalance.toFixed(2)}`);
    } else if (shouldTrade && recommendation.recommendation === 'SKIP') {
      console.log('\n⏭️  Skipping trade based on recommendation');
    } else {
      console.log('\n🧪 DRY RUN: No bet placed (use --trade to execute)');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✓ Analysis complete!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
