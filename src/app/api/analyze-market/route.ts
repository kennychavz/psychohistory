import { config } from 'dotenv';
import { resolve } from 'path';

// Force load .env file ONLY (override system env)
config({ path: resolve(process.cwd(), '.env'), override: true });

import { NextRequest, NextResponse } from 'next/server';
import { TreeBuilder } from '@/lib/tree/tree-builder';
import { createManifoldClient } from '@/lib/manifold/trading-client';
import { EventNode } from '@/types/tree';

/**
 * API endpoint to analyze a prediction market and optionally place a bet
 *
 * POST /api/analyze-market
 * Body: {
 *   marketUrl: string,           // Manifold market URL
 *   shouldTrade?: boolean,        // Whether to actually place a bet (default: false)
 *   betAmount?: number,           // Amount to bet in Mana (default: 10)
 *   confidenceThreshold?: number, // Minimum confidence to bet (0-1, default: 0.7)
 *   maxDepth?: number             // Tree depth for analysis (default: 3)
 * }
 */

interface AnalyzeMarketRequest {
  marketUrl: string;
  shouldTrade?: boolean;
  betAmount?: number;
  confidenceThreshold?: number;
  maxDepth?: number;
}

interface AnalyzeMarketResponse {
  market: {
    id: string;
    question: string;
    currentProbability: number;
    url: string;
  };
  analysis: {
    analyzedProbability: number;
    sentiment: number;
    totalNodes: number;
    mostProbablePath: {
      event: string;
      probability: number;
      depth: number;
    }[];
    justification: string;
  };
  trade?: {
    executed: boolean;
    recommendation: 'BUY_YES' | 'BUY_NO' | 'SKIP';
    reason: string;
    outcome?: 'YES' | 'NO';
    amount?: number;
    betId?: string;
    shares?: number;
  };
  error?: string;
}

/**
 * Extract market slug from Manifold URL
 * Examples:
 * - https://manifold.markets/username/market-slug
 * - https://manifold.markets/username/market-slug-abc123
 */
function extractMarketSlug(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    if (pathParts.length >= 2) {
      // Return the market slug (last part of path)
      return pathParts[pathParts.length - 1];
    }

    throw new Error('Invalid Manifold market URL format');
  } catch (error) {
    throw new Error(`Failed to parse market URL: ${error}`);
  }
}

/**
 * Calculate the analyzed probability from the tree
 * Uses the root node's children probabilities (weighted average)
 */
function calculateAnalyzedProbability(root: EventNode): number {
  if (root.children.length === 0) {
    return root.probability;
  }

  // Weight probabilities by sentiment and depth
  let weightedSum = 0;
  let totalWeight = 0;

  root.children.forEach(child => {
    const weight = Math.abs(child.sentiment) / 100; // Convert sentiment to weight
    weightedSum += child.probability * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
}

/**
 * Find the most probable path through the tree
 */
function findMostProbablePath(root: EventNode): EventNode[] {
  const path: EventNode[] = [root];
  let current = root;

  while (current.children.length > 0) {
    // Find child with highest probability
    const mostProbableChild = current.children.reduce((max, child) =>
      child.probability > max.probability ? child : max
    , current.children[0]);

    path.push(mostProbableChild);
    current = mostProbableChild;
  }

  return path;
}

/**
 * Calculate average sentiment across the tree
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
 * Determine trading recommendation based on analysis
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

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeMarketRequest = await request.json();

    const {
      marketUrl,
      shouldTrade = false,
      betAmount = 10,
      confidenceThreshold = 0.7,
      maxDepth = 3
    } = body;

    // Validate input
    if (!marketUrl) {
      return NextResponse.json(
        { error: 'Market URL is required' },
        { status: 400 }
      );
    }

    // Step 1: Parse market URL and fetch market details
    console.log('📊 Fetching market details...');
    const marketSlug = extractMarketSlug(marketUrl);

    const manifoldApiKey = process.env.MANIFOLD_API_KEY;
    if (!manifoldApiKey) {
      return NextResponse.json(
        { error: 'MANIFOLD_API_KEY not configured' },
        { status: 500 }
      );
    }

    const manifold = createManifoldClient(manifoldApiKey);
    const market = await manifold.getMarket(marketSlug);

    if (market.isResolved) {
      return NextResponse.json(
        { error: 'Market is already resolved' },
        { status: 400 }
      );
    }

    if (market.outcomeType !== 'BINARY') {
      return NextResponse.json(
        { error: 'Only binary markets are supported' },
        { status: 400 }
      );
    }

    console.log(`✓ Found market: ${market.question}`);

    // Step 2: Generate probability tree analysis
    console.log('🌳 Generating probability tree...');
    const builder = new TreeBuilder(maxDepth, 20);
    const tree = await builder.buildTree({
      event: market.question,
      maxDepth,
      domain: 'general'
    });

    // Step 3: Analyze tree results
    console.log('🔍 Analyzing tree results...');
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

    // Step 4: Determine trading recommendation
    const tradeRecommendation = determineTradingRecommendation(
      market.probability || 0.5,
      analyzedProb,
      confidenceThreshold,
      avgSentiment
    );

    // Step 5: Execute trade if requested
    let tradeResult: AnalyzeMarketResponse['trade'] = {
      executed: false,
      recommendation: tradeRecommendation.recommendation,
      reason: tradeRecommendation.reason,
      outcome: tradeRecommendation.outcome
    };

    if (shouldTrade && tradeRecommendation.recommendation !== 'SKIP') {
      try {
        console.log(`💸 Placing ${tradeRecommendation.outcome} bet of M$${betAmount}...`);

        const betResult = await manifold.placeBet({
          contractId: market.id,
          outcome: tradeRecommendation.outcome!,
          amount: betAmount
        });

        tradeResult = {
          executed: true,
          recommendation: tradeRecommendation.recommendation,
          reason: tradeRecommendation.reason,
          outcome: tradeRecommendation.outcome,
          amount: betAmount,
          betId: betResult.betId,
          shares: betResult.shares
        };

        console.log(`✓ Bet placed successfully: ${betResult.betId}`);
      } catch (error) {
        console.error('Failed to place bet:', error);
        tradeResult.reason += ` (Trade failed: ${error})`;
      }
    }

    // Step 6: Return comprehensive response
    const response: AnalyzeMarketResponse = {
      market: {
        id: market.id,
        question: market.question,
        currentProbability: market.probability || 0,
        url: market.url
      },
      analysis: {
        analyzedProbability: analyzedProb,
        sentiment: avgSentiment,
        totalNodes,
        mostProbablePath: mostProbablePath.map(node => ({
          event: node.event,
          probability: node.probability,
          depth: node.depth
        })),
        justification: tree.justification
      },
      trade: tradeResult
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Market analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
