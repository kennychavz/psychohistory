'use client';

import { useState } from 'react';
import { SeedInput } from '@/types/tree';

interface Props {
  onSubmit: (seed: SeedInput) => void;
  isLoading: boolean;
}

export default function SeedInputForm({ onSubmit, isLoading }: Props) {
  const [event, setEvent] = useState('');
  const [context, setContext] = useState('');
  const [timeframe, setTimeframe] = useState('');
  const [maxDepth, setMaxDepth] = useState(3);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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
    setEvent(template.event);
    setContext(template.context);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Seed Event *
        </label>
        <textarea
          value={event}
          onChange={e => setEvent(e.target.value)}
          placeholder="e.g., New York implements rent control policy"
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          disabled={isLoading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Context (Optional)
        </label>
        <textarea
          value={context}
          onChange={e => setContext(e.target.value)}
          placeholder="Additional background information..."
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          disabled={isLoading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Timeframe (Optional)
        </label>
        <input
          type="text"
          value={timeframe}
          onChange={e => setTimeframe(e.target.value)}
          placeholder="e.g., next 6 months"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          disabled={isLoading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Max Depth: {maxDepth}
        </label>
        <input
          type="range"
          min={1}
          max={5}
          value={maxDepth}
          onChange={e => setMaxDepth(parseInt(e.target.value))}
          className="mt-1 block w-full"
          disabled={isLoading}
        />
        <p className="mt-1 text-xs text-gray-500">
          Deeper = more detailed but slower
        </p>
      </div>

      <button
        type="submit"
        disabled={isLoading || !event.trim()}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? 'Generating...' : 'Generate Tree'}
      </button>

      <div className="border-t border-gray-200 pt-4">
        <p className="mb-2 text-sm font-medium text-gray-700">Templates</p>
        <div className="space-y-2">
          {templates.map((template, i) => (
            <button
              key={i}
              type="button"
              onClick={() => loadTemplate(template)}
              disabled={isLoading}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {template.name}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
