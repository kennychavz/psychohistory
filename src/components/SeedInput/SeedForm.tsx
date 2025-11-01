'use client';

import { useState } from 'react';
import { SeedInput } from '@/types/tree';

interface Props {
  onSubmit: (seed: SeedInput) => void;
  isLoading: boolean;
}

type InputMode = 'custom' | 'manifold';

export default function SeedInputForm({ onSubmit, isLoading }: Props) {
  const [inputMode, setInputMode] = useState<InputMode>('custom');

  // Custom event fields
  const [event, setEvent] = useState('');
  const [context, setContext] = useState('');
  const [timeframe, setTimeframe] = useState('');
  const [maxDepth, setMaxDepth] = useState(3);

  // Manifold market fields
  const [marketUrl, setMarketUrl] = useState('');
  const [shouldTrade, setShouldTrade] = useState(false);
  const [betAmount, setBetAmount] = useState(10);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.7);
  const [isFetchingMarket, setIsFetchingMarket] = useState(false);
  const [marketInfo, setMarketInfo] = useState<{
    question: string;
    probability: number;
    volume: number;
  } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (inputMode === 'custom') {
      if (!event.trim()) {
        alert('Please enter an event');
        return;
      }

      onSubmit({
        event: event.trim(),
        context: context.trim() || undefined,
        timeframe: timeframe.trim() || undefined,
        maxDepth,
      });
    } else {
      // Manifold mode
      if (!marketUrl.trim()) {
        alert('Please enter a Manifold market URL');
        return;
      }

      onSubmit({
        event: marketInfo?.question || marketUrl, // Use fetched question or URL as fallback
        maxDepth,
        marketUrl: marketUrl.trim(),
        shouldTrade,
        betAmount,
        confidenceThreshold,
      });
    }
  };

  const fetchMarketInfo = async () => {
    if (!marketUrl.trim()) return;

    setIsFetchingMarket(true);
    try {
      // Extract market slug from URL
      const urlObj = new URL(marketUrl);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      const marketSlug = pathParts[pathParts.length - 1];

      // Fetch market details via our API route (server-side, no CORS issues)
      const response = await fetch(`/api/manifold/market?slug=${marketSlug}`);

      if (!response.ok) {
        throw new Error('Failed to fetch market');
      }

      const market = await response.json();

      // Validate response
      if (!market || !market.question) {
        throw new Error('Invalid market data received');
      }

      // Check if binary market
      if (market.outcomeType !== 'BINARY') {
        alert(`This is a ${market.outcomeType} market. Currently only binary YES/NO markets are supported.`);
        setMarketUrl('');
        return;
      }

      setMarketInfo({
        question: market.question,
        probability: market.probability || 0,
        volume: market.volume || 0,
      });

      // Auto-fill the event field with market question
      setEvent(market.question);
    } catch (error) {
      console.error('Error fetching market:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to fetch market: ${errorMessage}`);
    } finally {
      setIsFetchingMarket(false);
    }
  };

  const templates = [
    {
      name: 'Rent Control Policy',
      event: 'New York City implements strict rent control on 50% of apartments',
      context: 'Population: 8.3M, Current median rent: $3,500/month, Housing shortage',
    },
    {
      name: 'Geopolitical Event',
      event: 'Major trade agreement signed between US and China',
      context: 'Current tensions high, $500B annual trade volume',
    },
    {
      name: 'Tech Regulation',
      event: 'EU passes comprehensive AI regulation with strict compliance rules',
      context: 'Affects all AI companies operating in EU market',
    },
  ];

  const loadTemplate = (template: typeof templates[0]) => {
    setInputMode('custom');
    setEvent(template.event);
    setContext(template.context);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Mode Selector Tabs */}
      <div className="flex space-x-2 border-b border-gray-800/30">
        <button
          type="button"
          onClick={() => setInputMode('custom')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            inputMode === 'custom'
              ? 'border-b-2 border-gray-400 text-gray-200'
              : 'text-gray-500 hover:text-gray-300'
          }`}
          disabled={isLoading}
        >
          Custom Event
        </button>
        <button
          type="button"
          onClick={() => setInputMode('manifold')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            inputMode === 'manifold'
              ? 'border-b-2 border-gray-400 text-gray-200'
              : 'text-gray-500 hover:text-gray-300'
          }`}
          disabled={isLoading}
        >
          🔮 Manifold Market
        </button>
      </div>

      {/* Custom Event Form */}
      {inputMode === 'custom' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-300">
              Seed Event *
            </label>
            <textarea
              value={event}
              onChange={e => setEvent(e.target.value)}
              placeholder="e.g., New York implements rent control policy"
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-700/50 bg-gray-900/30 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">
              Context (Optional)
            </label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Additional background information..."
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-700/50 bg-gray-900/30 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">
              Timeframe (Optional)
            </label>
            <input
              type="text"
              value={timeframe}
              onChange={e => setTimeframe(e.target.value)}
              placeholder="e.g., next 6 months"
              className="mt-1 block w-full rounded-md border border-gray-700/50 bg-gray-900/30 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
              disabled={isLoading}
            />
          </div>
        </>
      )}

      {/* Manifold Market Form */}
      {inputMode === 'manifold' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-300">
              Manifold Market URL *
            </label>
            <div className="mt-1 flex space-x-2">
              <input
                type="url"
                value={marketUrl}
                onChange={e => setMarketUrl(e.target.value)}
                placeholder="https://manifold.markets/user/market-slug"
                className="flex-1 block w-full rounded-md border border-gray-700/50 bg-gray-900/30 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
                disabled={isLoading || isFetchingMarket}
              />
              <button
                type="button"
                onClick={fetchMarketInfo}
                disabled={isLoading || isFetchingMarket || !marketUrl.trim()}
                className="px-4 py-2 text-sm font-medium text-gray-200 bg-gray-700 rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isFetchingMarket ? 'Loading...' : 'Fetch'}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Paste a Manifold Markets URL and click "Fetch" to load the market question
            </p>
          </div>

          {/* Market Info Display */}
          {marketInfo && (
            <div className="rounded-md border border-gray-700/50 bg-gray-900/30 p-3 space-y-2">
              <div>
                <p className="text-xs text-gray-500">Market Question</p>
                <p className="text-sm text-gray-200 font-medium">{marketInfo.question}</p>
              </div>
              <div className="flex space-x-4 text-xs">
                <div>
                  <span className="text-gray-500">Current Probability: </span>
                  <span className="text-gray-300 font-medium">
                    {(marketInfo.probability * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Volume: </span>
                  <span className="text-gray-300 font-medium">
                    M${marketInfo.volume.toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Trading Options */}
          <div className="rounded-md border border-gray-700/50 bg-gray-900/30 p-4 space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="shouldTrade"
                checked={shouldTrade}
                onChange={e => setShouldTrade(e.target.checked)}
                className="rounded border-gray-700 bg-gray-900 text-gray-600 focus:ring-gray-600"
                disabled={isLoading}
              />
              <label htmlFor="shouldTrade" className="text-sm font-medium text-gray-300">
                Execute trade automatically
              </label>
            </div>

            {shouldTrade && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Bet Amount (Mana)
                  </label>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={e => setBetAmount(Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                    max={1000}
                    className="block w-full rounded-md border border-gray-700/50 bg-gray-900/30 px-3 py-2 text-sm text-gray-200 focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Confidence Threshold: {(confidenceThreshold * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min={0.5}
                    max={0.95}
                    step={0.05}
                    value={confidenceThreshold}
                    onChange={e => setConfidenceThreshold(parseFloat(e.target.value))}
                    className="block w-full accent-gray-500"
                    disabled={isLoading}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Only trade if analysis confidence exceeds this threshold
                  </p>
                </div>
              </>
            )}

            {!shouldTrade && (
              <p className="text-xs text-gray-500">
                ℹ️ Analysis will run without placing any bets (dry run mode)
              </p>
            )}
          </div>
        </>
      )}

      {/* Common: Max Depth */}
      <div>
        <label className="block text-sm font-medium text-gray-300">
          Max Depth: {maxDepth}
        </label>
        <input
          type="range"
          min={1}
          max={5}
          value={maxDepth}
          onChange={e => setMaxDepth(parseInt(e.target.value))}
          className="mt-1 block w-full accent-gray-500"
          disabled={isLoading}
        />
        <p className="mt-1 text-xs text-gray-500">
          Deeper = more detailed but slower
        </p>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={
          isLoading ||
          (inputMode === 'custom' && !event.trim()) ||
          (inputMode === 'manifold' && !marketInfo)
        }
        className="w-full rounded-md bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-100 hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50 shadow-lg shadow-gray-900/30"
      >
        {isLoading
          ? 'Generating...'
          : inputMode === 'manifold'
          ? '🔮 Analyze & Generate Tree'
          : 'Generate Tree'}
      </button>

      {/* Templates (only in custom mode) */}
      {inputMode === 'custom' && (
        <div className="border-t border-gray-800/30 pt-4">
          <p className="mb-2 text-sm font-medium text-gray-300">Templates</p>
          <div className="space-y-2">
            {templates.map((template, i) => (
              <button
                key={i}
                type="button"
                onClick={() => loadTemplate(template)}
                disabled={isLoading}
                className="w-full rounded border border-gray-700/50 bg-gray-900/30 px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-800/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {template.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
