'use client';

import { X, ExternalLink } from 'lucide-react';
import { EventNode } from '@/types/tree';
import { getSentimentColor } from '@/lib/layout/depth-layout';

interface Props {
  node: EventNode;
  onClose: () => void;
}

export default function NodeDetailsPanel({ node, onClose }: Props) {
  const sentimentColor = getSentimentColor(node.sentiment);

  return (
    <div className="absolute right-0 top-0 z-10 h-full w-96 overflow-y-auto border-l border-gray-800/30 shadow-xl" style={{ backgroundColor: '#0f172a' }}>
      {/* Header */}
      <div className="sticky top-0 border-b border-gray-800/30 px-6 py-4" style={{ backgroundColor: '#0f172a' }}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-200">Event Details</h2>
            <p className="mt-1 text-sm text-gray-400">Depth {node.depth}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 hover:bg-gray-800/50 border border-gray-700/50"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6 p-6">
        {/* Event */}
        <div>
          <h3 className="text-sm font-semibold text-gray-300">Event</h3>
          <p className="mt-2 text-sm text-gray-200">{node.event}</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-gray-800/30 border border-gray-700/50 p-3">
            <p className="text-xs font-medium text-gray-400">Probability</p>
            <p className="mt-1 text-2xl font-bold text-gray-300">
              {(node.probability * 100).toFixed(1)}%
            </p>
          </div>

          <div
            className="rounded-lg p-3"
            style={{ backgroundColor: `${sentimentColor}20` }}
          >
            <p className="text-xs font-medium" style={{ color: sentimentColor }}>
              Sentiment
            </p>
            <p
              className="mt-1 text-2xl font-bold"
              style={{ color: sentimentColor }}
            >
              {node.sentiment > 0 ? '+' : ''}
              {node.sentiment}
            </p>
          </div>
        </div>

        {/* Justification */}
        <div>
          <h3 className="text-sm font-semibold text-gray-300">Justification</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-300">
            {node.justification}
          </p>
        </div>

        {/* Sources */}
        {node.sources.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-300">
              Sources ({node.sources.length})
            </h3>
            <div className="mt-2 space-y-3">
              {node.sources.map((source, i) => (
                <a
                  key={i}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-gray-700/50 bg-gray-900/30 p-3 transition-all hover:border-gray-600/50 hover:bg-gray-800/40"
                >
                  <div className="flex items-start justify-between">
                    <p className="flex-1 text-sm font-medium text-gray-200">
                      {source.title}
                    </p>
                    <ExternalLink className="ml-2 h-4 w-4 flex-shrink-0 text-gray-400" />
                  </div>
                  {source.snippet && (
                    <p className="mt-1 text-xs text-gray-400 line-clamp-2">
                      {source.snippet}
                    </p>
                  )}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Children Summary */}
        {node.children.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-300">
              Possible Outcomes ({node.children.length})
            </h3>
            <div className="mt-2 space-y-2">
              {node.children.map((child, i) => (
                <div
                  key={child.id}
                  className="rounded border border-gray-700/50 bg-gray-900/30 p-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-300">
                      {child.event.substring(0, 60)}
                      {child.event.length > 60 ? '...' : ''}
                    </span>
                    <span className="ml-2 text-xs font-semibold text-gray-400">
                      {(child.probability * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
