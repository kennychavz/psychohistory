'use client';

import { memo } from 'react';
import { EdgeProps, getBezierPath } from 'reactflow';
import { getEdgeWidth, getEdgeColor, getSentimentColor } from '@/lib/d3/color-scales';

interface ProbabilityEdgeData {
  probability: number;
  sentiment?: number;
  isOnMostProbablePath?: boolean;
}

function ProbabilityEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<ProbabilityEdgeData>) {
  const probability = data?.probability || 0.5;
  const sentiment = data?.sentiment || 0;
  const isOnPath = data?.isOnMostProbablePath || false;

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const strokeWidth = getEdgeWidth(probability);
  const baseColor = getEdgeColor(probability, sentiment);
  const sentimentColor = getSentimentColor(sentiment);

  // Most probable path gets golden color
  const color = isOnPath ? '#fbbf24' : baseColor;
  const glowColor = isOnPath ? '#fbbf24' : sentimentColor;

  // High probability edges get a glow effect
  const shouldGlow = probability > 0.5 || isOnPath;
  const glowIntensity = isOnPath ? 'path' : probability > 0.7 ? 'strong' : probability > 0.5 ? 'medium' : 'none';

  return (
    <g className="react-flow__edge">
      {/* Outer glow for high-probability edges */}
      {shouldGlow && (
        <>
          <path
            d={edgePath}
            fill="none"
            stroke={glowColor}
            strokeWidth={strokeWidth + (isOnPath ? 12 : 8)}
            strokeOpacity={isOnPath ? 0.3 : probability * 0.15}
            className="transition-all duration-300"
          />
          <path
            d={edgePath}
            fill="none"
            stroke={glowColor}
            strokeWidth={strokeWidth + (isOnPath ? 6 : 4)}
            strokeOpacity={isOnPath ? 0.5 : probability * 0.25}
            className="transition-all duration-300"
          />
        </>
      )}

      {/* Main edge path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        className="transition-all duration-300"
        markerEnd={markerEnd}
        style={{
          filter: glowIntensity === 'path'
            ? `drop-shadow(0 0 6px ${glowColor})`
            : glowIntensity === 'strong'
            ? `drop-shadow(0 0 4px ${glowColor})`
            : undefined,
        }}
      />

      {/* Animated particles for very high probability paths */}
      {probability > 0.8 && (
        <>
          <circle r="2" fill={sentimentColor} opacity="0.8">
            <animateMotion
              dur="2s"
              repeatCount="indefinite"
              path={edgePath}
            />
          </circle>
          <circle r="2" fill={sentimentColor} opacity="0.6">
            <animateMotion
              dur="2s"
              begin="0.5s"
              repeatCount="indefinite"
              path={edgePath}
            />
          </circle>
        </>
      )}
    </g>
  );
}

export default memo(ProbabilityEdge);
