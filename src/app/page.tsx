'use client';

import { useState } from 'react';
import { SeedInput } from '@/types/tree';
import SeedInputForm from '@/components/SeedInput/SeedForm';
import TreeVisualization from '@/components/TreeVisualization/TreeCanvas';
import { useTreeGeneration } from '@/hooks/useTreeGeneration';

interface MarketAnalysisResult {
  market: {
    question: string;
    currentProbability: number;
    url: string;
  };
  analysis: {
    analyzedProbability: number;
    sentiment: number;
    totalNodes: number;
  };
  trade?: {
    executed: boolean;
    recommendation: string;
    reason: string;
    betId?: string;
    shares?: number;
  };
}

export default function Home() {
  const {
    generateTree,
    cancelGeneration,
    isGenerating,
    root,
    currentDepth,
    totalNodes,
    completedNodes,
    error,
  } = useTreeGeneration();

  const [marketAnalysis, setMarketAnalysis] = useState<MarketAnalysisResult | null>(null);

  const handleGenerateTree = async (seed: SeedInput) => {
    // If this is a Manifold market analysis, call the market analysis API
    if (seed.marketUrl) {
      setMarketAnalysis(null);
      try {
        const response = await fetch('/api/analyze-market', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            marketUrl: seed.marketUrl,
            shouldTrade: seed.shouldTrade,
            betAmount: seed.betAmount,
            confidenceThreshold: seed.confidenceThreshold,
            maxDepth: seed.maxDepth,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to analyze market');
        }

        const result = await response.json();
        setMarketAnalysis(result);

        // Also generate the tree for visualization
        await generateTree(seed);
      } catch (err) {
        console.error('Market analysis error:', err);
        alert(err instanceof Error ? err.message : 'Failed to analyze market');
      }
    } else {
      // Regular tree generation
      setMarketAnalysis(null);
      await generateTree(seed);
    }
  };

  return (
    <main className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-gray-800/30" style={{ backgroundColor: '#0f172a' }}>
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-200">
            PsychoHistory
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Probabilistic event forecasting powered by historical research
          </p>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Sidebar */}
        <aside className="w-full border-b border-gray-800/30 lg:w-96 lg:border-b-0 lg:border-r" style={{ backgroundColor: '#0f172a' }}>
          <div className="p-6">
            <SeedInputForm
              onSubmit={handleGenerateTree}
              isLoading={isGenerating}
            />

            {error && (
              <div className="mt-4 rounded-md bg-red-900/20 border border-red-800 p-4">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
          </div>
        </aside>

        {/* Visualization */}
        <div className="flex-1" style={{ backgroundColor: '#0a0f1e' }}>
          {isGenerating && (
            <div className="absolute left-1/2 top-20 z-10 -translate-x-1/2 transform">
              <div className="rounded-lg border border-gray-700/50 px-6 py-4 shadow-lg" style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)' }}>
                <div className="flex items-center space-x-4">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-gray-400" />
                  <div className="text-sm">
                    <p className="font-semibold text-gray-100">
                      Generating tree...
                    </p>
                    <p className="text-gray-400">
                      Depth {currentDepth} • {completedNodes}/{totalNodes} nodes
                    </p>
                  </div>
                  <button
                    onClick={cancelGeneration}
                    className="rounded-md bg-red-900/30 border border-red-800 px-3 py-1 text-sm font-medium text-red-400 hover:bg-red-900/50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {root && (
            <>
              <TreeVisualization tree={root} />

              {/* Market Analysis Results Overlay */}
              {marketAnalysis && (
                <div className="absolute bottom-4 right-4 z-10 w-96 rounded-lg border border-gray-700/50 shadow-2xl" style={{ backgroundColor: 'rgba(15, 23, 42, 0.98)' }}>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                      <h3 className="text-sm font-semibold text-gray-200">🔮 Market Analysis</h3>
                      <button
                        onClick={() => setMarketAnalysis(null)}
                        className="text-gray-500 hover:text-gray-300 text-xs"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Market Probability</p>
                        <p className="text-lg font-bold text-gray-200">
                          {(marketAnalysis.market.currentProbability * 100).toFixed(1)}%
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">Analyzed Probability</p>
                        <p className="text-lg font-bold text-blue-400">
                          {(marketAnalysis.analysis.analyzedProbability * 100).toFixed(1)}%
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">Difference</p>
                        <p className={`text-lg font-bold ${
                          marketAnalysis.analysis.analyzedProbability > marketAnalysis.market.currentProbability
                            ? 'text-green-400'
                            : marketAnalysis.analysis.analyzedProbability < marketAnalysis.market.currentProbability
                            ? 'text-red-400'
                            : 'text-gray-400'
                        }`}>
                          {((marketAnalysis.analysis.analyzedProbability - marketAnalysis.market.currentProbability) * 100).toFixed(1)}%
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">Sentiment</p>
                        <p className="text-sm text-gray-300">
                          {marketAnalysis.analysis.sentiment.toFixed(1)}
                        </p>
                      </div>

                      {marketAnalysis.trade && (
                        <div className="border-t border-gray-800 pt-2 mt-2">
                          <p className="text-xs text-gray-500">Trading Recommendation</p>
                          <p className={`text-sm font-semibold ${
                            marketAnalysis.trade.recommendation === 'BUY_YES'
                              ? 'text-green-400'
                              : marketAnalysis.trade.recommendation === 'BUY_NO'
                              ? 'text-red-400'
                              : 'text-gray-400'
                          }`}>
                            {marketAnalysis.trade.recommendation}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {marketAnalysis.trade.reason}
                          </p>

                          {marketAnalysis.trade.executed && marketAnalysis.trade.betId && (
                            <div className="mt-2 rounded bg-green-900/20 border border-green-800/50 p-2">
                              <p className="text-xs text-green-400 font-semibold">✓ Trade Executed</p>
                              <p className="text-xs text-gray-400 mt-1">
                                Bet ID: {marketAnalysis.trade.betId}
                              </p>
                              {marketAnalysis.trade.shares && (
                                <p className="text-xs text-gray-400">
                                  Shares: {marketAnalysis.trade.shares.toFixed(2)}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <a
                        href={marketAnalysis.market.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-blue-400 hover:text-blue-300 mt-2"
                      >
                        View Market →
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {!isGenerating && !root && !error && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-gray-500">
                <p className="text-lg">Enter a seed event to begin</p>
                <p className="mt-2 text-sm">
                  The system will generate a probability tree of possible outcomes
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Watch as nodes appear in real-time!
                </p>
                <p className="mt-4 text-sm text-blue-400">
                  💡 Try the Manifold Market tab to analyze prediction markets!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
