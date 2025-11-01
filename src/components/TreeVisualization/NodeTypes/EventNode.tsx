'use client';

import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import {
  getSentimentColor,
  getSentimentGradient,
  getProbabilityGlowShadow,
  getNodeBorderColor,
} from '@/lib/d3/color-scales';

interface EventNodeData {
  event: string;
  probability: number;
  sentiment: number;
  depth: number;
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  isOnMostProbablePath?: boolean;
  iconUrl?: string;
}

function EventNode({ data }: { data: EventNodeData }) {
  const { event, probability, sentiment, depth, processingStatus = 'completed', isOnMostProbablePath = false, iconUrl } = data;

  const sentimentColor = getSentimentColor(sentiment);
  const sentimentGradient = getSentimentGradient(sentiment);
  const probabilityGlow = getProbabilityGlowShadow(probability, sentiment);
  const borderColor = getNodeBorderColor(processingStatus, sentiment);
  const probabilityPercent = (probability * 100).toFixed(1);

  // Calculate opacity based on probability (higher prob = more opaque)
  const bgOpacity = 0.85 + (probability * 0.15);

  // Special styling for most probable path
  const pathBorderStyle = isOnMostProbablePath
    ? {
        borderWidth: '4px',
        borderColor: '#fbbf24', // amber-400
        boxShadow: `${probabilityGlow}, 0 0 20px rgba(251, 191, 36, 0.6), inset 0 0 20px rgba(251, 191, 36, 0.1)`,
      }
    : {
        borderWidth: '2px',
        borderColor,
        boxShadow: probabilityGlow,
      };

  return (
    <div
      className="relative rounded-lg p-3 transition-all hover:scale-105"
      style={{
        background: sentimentGradient,
        ...pathBorderStyle,
        minWidth: 200,
        maxWidth: 250,
        opacity: bgOpacity,
        marginTop: iconUrl ? '40px' : '0', // Add space for icon
      }}
    >
      {/* Icon positioned on top center */}
      {iconUrl && (
        <div
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            top: 0,
            zIndex: 10,
          }}
        >
          <img
            src={iconUrl}
            alt="Category icon"
            className="h-20 w-20 rounded-full border-4 border-white object-cover shadow-lg"
          />
        </div>
      )}

      <Handle
        type="target"
        position={Position.Top}
        className="!bg-gray-400"
        style={{ opacity: 0.8 }}
      />

      <div className="space-y-2">
        {/* Probability Badge with Glow */}
        <div className="flex items-center justify-between">
          <span
            className="rounded-full px-2.5 py-1 text-xs font-bold shadow-sm"
            style={{
              background: probability > 0.5
                ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                : 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: 'white',
              boxShadow: probability > 0.7
                ? '0 0 10px rgba(59, 130, 246, 0.5)'
                : undefined,
            }}
          >
            {probabilityPercent}%
          </span>
          <span className="text-xs font-medium text-gray-700">
            L{depth}
          </span>
        </div>

        {/* Event Text */}
        <p
          className="text-sm font-semibold leading-tight"
          style={{
            color: sentiment < -50 ? '#7f1d1d' : sentiment > 50 ? '#14532d' : '#1f2937',
            textShadow: probability > 0.7 ? '0 1px 2px rgba(0,0,0,0.1)' : undefined,
          }}
        >
          {event.length > 80 ? `${event.substring(0, 80)}...` : event}
        </p>

        {/* Sentiment Indicator with Gradient Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-gray-600">
            <span>Impact</span>
            <span
              className="font-bold"
              style={{ color: sentimentColor }}
            >
              {sentiment > 0 ? '+' : ''}{sentiment}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200/80 shadow-inner">
            <div
              className="h-2.5 rounded-full transition-all duration-300"
              style={{
                width: `${((sentiment + 100) / 200) * 100}%`,
                background: `linear-gradient(90deg, ${sentimentColor}, ${getSentimentColor(sentiment * 1.2)})`,
                boxShadow: probability > 0.6 ? `0 0 8px ${sentimentColor}40` : undefined,
              }}
            />
          </div>
        </div>

        {/* Probability Indicator (visual flourish) */}
        {probability > 0.7 && (
          <div className="flex justify-center">
            <div className="flex space-x-1">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-1 w-1 animate-pulse rounded-full"
                  style={{
                    backgroundColor: sentimentColor,
                    animationDelay: `${i * 0.2}s`,
                    opacity: 0.7,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-400"
        style={{ opacity: 0.8 }}
      />
    </div>
  );
}

export default memo(EventNode);
