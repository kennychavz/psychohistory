'use client';

import { SeedInput } from '@/types/tree';
import SeedInputForm from '@/components/SeedInput/SeedForm';
import TreeVisualization from '@/components/TreeVisualization/TreeCanvas';
import { useTreeGeneration } from '@/hooks/useTreeGeneration';

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

  const handleGenerateTree = async (seed: SeedInput) => {
    await generateTree(seed);
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
            <TreeVisualization tree={root} />
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
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
