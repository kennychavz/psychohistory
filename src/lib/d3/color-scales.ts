/**
 * D3 color scales and utilities for probability and sentiment visualization
 */

import * as d3 from 'd3';

/**
 * Sentiment color scale (-100 to +100)
 * Returns smooth gradient: red → yellow → green
 */
export const sentimentColorScale = d3
  .scaleSequential()
  .domain([-100, 100])
  .interpolator(d3.interpolateRdYlGn);

/**
 * Get RGB color for sentiment value
 */
export function getSentimentColor(sentiment: number): string {
  return sentimentColorScale(sentiment);
}

/**
 * Get sentiment gradient CSS for backgrounds
 * Creates subtle radial gradient effect
 */
export function getSentimentGradient(sentiment: number): string {
  const color = getSentimentColor(sentiment);
  const lighter = d3.color(color)?.brighter(0.5).toString() || color;
  return `radial-gradient(circle at 30% 30%, ${lighter}, ${color})`;
}

/**
 * Probability-based opacity scale (0 to 1)
 * Higher probability = more opaque
 */
export const probabilityOpacityScale = d3
  .scaleLinear()
  .domain([0, 1])
  .range([0.3, 1.0])
  .clamp(true);

/**
 * Get opacity for given probability
 */
export function getProbabilityOpacity(probability: number): number {
  return probabilityOpacityScale(probability);
}

/**
 * Probability-based glow intensity (0 to 1)
 * Higher probability = stronger glow
 */
export const probabilityGlowScale = d3
  .scaleLinear()
  .domain([0, 0.2, 0.5, 1])
  .range([0, 5, 15, 30])
  .clamp(true);

/**
 * Get glow blur radius for probability
 */
export function getProbabilityGlow(probability: number): number {
  return probabilityGlowScale(probability);
}

/**
 * Get box-shadow CSS for probability-based glow
 */
export function getProbabilityGlowShadow(
  probability: number,
  sentiment: number
): string {
  const glowRadius = getProbabilityGlow(probability);
  const color = getSentimentColor(sentiment);
  const glowColor = d3.color(color)?.copy({ opacity: 0.6 }).toString() || color;

  if (probability > 0.7) {
    // High probability: strong glow
    return `0 0 ${glowRadius}px ${glowRadius / 2}px ${glowColor}, 0 0 ${glowRadius * 2}px ${glowRadius}px ${glowColor}40`;
  } else if (probability > 0.4) {
    // Medium probability: moderate glow
    return `0 0 ${glowRadius}px ${glowRadius / 3}px ${glowColor}`;
  } else {
    // Low probability: subtle shadow
    return `0 2px 4px rgba(0,0,0,0.1)`;
  }
}

/**
 * Get edge width based on probability
 * Exponential scale for better visual hierarchy
 */
export const edgeWidthScale = d3
  .scalePow()
  .exponent(2)
  .domain([0, 1])
  .range([1, 8])
  .clamp(true);

/**
 * Get edge width for probability
 */
export function getEdgeWidth(probability: number): number {
  return edgeWidthScale(probability);
}

/**
 * Get edge color with probability-based opacity
 */
export function getEdgeColor(probability: number, sentiment: number): string {
  const baseColor = getSentimentColor(sentiment);
  const opacity = probabilityOpacityScale(probability);
  const color = d3.color(baseColor);

  if (color) {
    color.opacity = opacity;
    return color.toString();
  }

  return baseColor;
}

/**
 * Get cumulative probability color for path highlighting
 */
export function getCumulativeProbabilityColor(cumulativeProb: number): string {
  // Blue gradient for cumulative probability
  return d3.interpolateBlues(cumulativeProb);
}

/**
 * Get node border color based on processing status
 */
export function getNodeBorderColor(
  status: 'pending' | 'processing' | 'completed' | 'failed',
  sentiment: number
): string {
  switch (status) {
    case 'processing':
      return '#3b82f6'; // blue-500
    case 'failed':
      return '#ef4444'; // red-500
    case 'completed':
      return getSentimentColor(sentiment);
    default:
      return '#9ca3af'; // gray-400
  }
}

/**
 * Interpolate between two colors for smooth transitions
 */
export function interpolateColors(
  color1: string,
  color2: string,
  t: number
): string {
  return d3.interpolate(color1, color2)(t);
}

/**
 * Create color scale for discrete categories
 */
export const categoryColorScale = d3.scaleOrdinal(d3.schemeCategory10);

/**
 * Get distinct color for category
 */
export function getCategoryColor(category: string | number): string {
  return categoryColorScale(category.toString());
}
