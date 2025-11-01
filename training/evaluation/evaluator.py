"""
Evaluation pipeline for probability tree models.

Tracks both performance metrics (loss, perplexity) and match coverage
(how well the semantic matcher is working).
"""

import math
import json
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime


@dataclass
class MatchResult:
    """Result of matching an actual event to predicted nodes"""
    matched: bool
    match_type: str  # 'exact', 'semantic', 'llm', 'none'
    matched_event: Optional[str]
    probability: float
    similarity_score: float


@dataclass
class DepthMetrics:
    """Metrics for a single depth level"""
    depth: int
    loss: float
    perplexity: float
    match_rate: float
    total_events: int


@dataclass
class MatchCoverage:
    """Track how events are being matched"""
    exact_matches: int = 0
    semantic_matches: int = 0
    llm_matches: int = 0
    no_matches: int = 0

    @property
    def total_matches(self) -> int:
        return self.exact_matches + self.semantic_matches + self.llm_matches

    @property
    def total_events(self) -> int:
        return self.total_matches + self.no_matches

    @property
    def match_rate(self) -> float:
        if self.total_events == 0:
            return 0.0
        return self.total_matches / self.total_events


@dataclass
class EvaluationMetrics:
    """Complete evaluation results"""
    loss: float
    perplexity: float
    brier_score: float
    match_coverage: MatchCoverage
    depth_metrics: List[DepthMetrics]
    timestamp: str
    model_name: str
    num_cases: int


class EventMatcher:
    """Match actual events to predicted nodes with multiple strategies"""

    def __init__(self, use_llm: bool = False):
        self.use_llm = use_llm

    def find_best_match(
        self,
        actual_event: str,
        predicted_nodes: List[Dict[str, Any]]
    ) -> MatchResult:
        """
        Find best match using multiple strategies:
        1. Exact string match
        2. Semantic similarity (Jaccard for now, embeddings later)
        3. LLM judge (if enabled)
        """
        if not predicted_nodes:
            return MatchResult(
                matched=False,
                match_type='none',
                matched_event=None,
                probability=0.001,
                similarity_score=0.0
            )

        # Strategy 1: Exact match
        for node in predicted_nodes:
            if node['event'].lower() == actual_event.lower():
                return MatchResult(
                    matched=True,
                    match_type='exact',
                    matched_event=node['event'],
                    probability=node['probability'],
                    similarity_score=1.0
                )

        # Strategy 2: Semantic similarity (Jaccard on words)
        best_similarity = 0.0
        best_node = None

        for node in predicted_nodes:
            similarity = self._jaccard_similarity(actual_event, node['event'])
            if similarity > best_similarity:
                best_similarity = similarity
                best_node = node

        # Threshold for semantic match
        if best_similarity > 0.6:
            return MatchResult(
                matched=True,
                match_type='semantic',
                matched_event=best_node['event'],
                probability=best_node['probability'],
                similarity_score=best_similarity
            )

        # Strategy 3: LLM judge (placeholder for now)
        if self.use_llm and best_similarity > 0.3:
            # TODO: Implement LLM-based matching
            # For now, accept if similarity > 0.3
            return MatchResult(
                matched=True,
                match_type='llm',
                matched_event=best_node['event'],
                probability=best_node['probability'],
                similarity_score=best_similarity
            )

        # No match found
        return MatchResult(
            matched=False,
            match_type='none',
            matched_event=None,
            probability=0.001,
            similarity_score=best_similarity
        )

    def _jaccard_similarity(self, text1: str, text2: str) -> float:
        """Jaccard similarity on word sets"""
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())

        if not words1 or not words2:
            return 0.0

        intersection = words1.intersection(words2)
        union = words1.union(words2)

        return len(intersection) / len(union)


class TreeEvaluator:
    """Evaluate probability trees against ground truth"""

    def __init__(self, use_llm_matcher: bool = False):
        self.matcher = EventMatcher(use_llm=use_llm_matcher)

    def evaluate(
        self,
        predicted_tree: Dict[str, Any],
        ground_truth: Dict[str, Any],
        model_name: str = "unknown"
    ) -> EvaluationMetrics:
        """
        Evaluate a predicted tree against ground truth

        Args:
            predicted_tree: Model's probability tree
            ground_truth: Actual outcome chain
            model_name: Name/identifier of the model

        Returns:
            Complete evaluation metrics
        """
        actual_chain = ground_truth['outcome_chain']

        total_loss = 0.0
        match_coverage = MatchCoverage()
        depth_metrics_list = []

        # Track per-depth
        depths = {}

        for actual_event_data in actual_chain:
            depth = actual_event_data['depth']
            actual_event = actual_event_data['event']

            # Get nodes at this depth
            predicted_nodes = self._get_nodes_at_depth(predicted_tree, depth)

            # Find match
            match = self.matcher.find_best_match(actual_event, predicted_nodes)

            # Calculate loss for this event
            event_loss = -math.log(max(match.probability, 0.001))
            total_loss += event_loss

            # Update match coverage
            if match.match_type == 'exact':
                match_coverage.exact_matches += 1
            elif match.match_type == 'semantic':
                match_coverage.semantic_matches += 1
            elif match.match_type == 'llm':
                match_coverage.llm_matches += 1
            else:
                match_coverage.no_matches += 1

            # Track per-depth
            if depth not in depths:
                depths[depth] = {
                    'losses': [],
                    'matches': 0,
                    'total': 0
                }
            depths[depth]['losses'].append(event_loss)
            depths[depth]['total'] += 1
            if match.matched:
                depths[depth]['matches'] += 1

        # Calculate aggregate metrics
        avg_loss = total_loss / len(actual_chain) if actual_chain else 0
        perplexity = math.exp(avg_loss)

        # Brier score (simplified for now)
        brier_score = self._calculate_brier_score(predicted_tree, actual_chain)

        # Per-depth metrics
        for depth, stats in sorted(depths.items()):
            depth_loss = sum(stats['losses']) / len(stats['losses'])
            depth_metrics_list.append(DepthMetrics(
                depth=depth,
                loss=depth_loss,
                perplexity=math.exp(depth_loss),
                match_rate=stats['matches'] / stats['total'],
                total_events=stats['total']
            ))

        return EvaluationMetrics(
            loss=avg_loss,
            perplexity=perplexity,
            brier_score=brier_score,
            match_coverage=match_coverage,
            depth_metrics=depth_metrics_list,
            timestamp=datetime.now().isoformat(),
            model_name=model_name,
            num_cases=1
        )

    def evaluate_batch(
        self,
        predictions: List[Dict[str, Any]],
        ground_truths: List[Dict[str, Any]],
        model_name: str = "unknown"
    ) -> EvaluationMetrics:
        """Evaluate multiple cases and aggregate"""
        all_metrics = [
            self.evaluate(pred, gt, model_name)
            for pred, gt in zip(predictions, ground_truths)
        ]

        # Aggregate
        total_loss = sum(m.loss for m in all_metrics)
        total_brier = sum(m.brier_score for m in all_metrics)

        # Aggregate match coverage
        agg_coverage = MatchCoverage()
        for m in all_metrics:
            agg_coverage.exact_matches += m.match_coverage.exact_matches
            agg_coverage.semantic_matches += m.match_coverage.semantic_matches
            agg_coverage.llm_matches += m.match_coverage.llm_matches
            agg_coverage.no_matches += m.match_coverage.no_matches

        # Aggregate depth metrics
        depth_agg = {}
        for m in all_metrics:
            for dm in m.depth_metrics:
                if dm.depth not in depth_agg:
                    depth_agg[dm.depth] = {'losses': [], 'match_rates': [], 'totals': []}
                depth_agg[dm.depth]['losses'].append(dm.loss)
                depth_agg[dm.depth]['match_rates'].append(dm.match_rate)
                depth_agg[dm.depth]['totals'].append(dm.total_events)

        agg_depth_metrics = []
        for depth, stats in sorted(depth_agg.items()):
            avg_loss = sum(stats['losses']) / len(stats['losses'])
            agg_depth_metrics.append(DepthMetrics(
                depth=depth,
                loss=avg_loss,
                perplexity=math.exp(avg_loss),
                match_rate=sum(stats['match_rates']) / len(stats['match_rates']),
                total_events=sum(stats['totals'])
            ))

        avg_loss = total_loss / len(all_metrics)
        avg_brier = total_brier / len(all_metrics)

        return EvaluationMetrics(
            loss=avg_loss,
            perplexity=math.exp(avg_loss),
            brier_score=avg_brier,
            match_coverage=agg_coverage,
            depth_metrics=agg_depth_metrics,
            timestamp=datetime.now().isoformat(),
            model_name=model_name,
            num_cases=len(all_metrics)
        )

    def _get_nodes_at_depth(
        self,
        tree: Dict[str, Any],
        target_depth: int,
        current_depth: int = 0
    ) -> List[Dict[str, Any]]:
        """Recursively get all nodes at a specific depth"""
        if current_depth == target_depth:
            return [tree]

        nodes = []
        for child in tree.get('children', []):
            nodes.extend(self._get_nodes_at_depth(child, target_depth, current_depth + 1))

        return nodes

    def _calculate_brier_score(
        self,
        tree: Dict[str, Any],
        actual_chain: List[Dict[str, Any]]
    ) -> float:
        """
        Calculate Brier score: average of (forecast - outcome)^2

        Simplified: for each actual event, score = (1 - P(event))^2
        """
        scores = []
        for actual_event_data in actual_chain:
            depth = actual_event_data['depth']
            actual_event = actual_event_data['event']

            nodes = self._get_nodes_at_depth(tree, depth)
            match = self.matcher.find_best_match(actual_event, nodes)

            # Brier: (forecast - actual)^2, where actual = 1 (it happened)
            score = (match.probability - 1.0) ** 2
            scores.append(score)

        return sum(scores) / len(scores) if scores else 0.0


def save_metrics(metrics: EvaluationMetrics, output_path: str):
    """Save metrics to JSON file"""
    with open(output_path, 'w') as f:
        json.dump(asdict(metrics), f, indent=2)


def load_metrics(input_path: str) -> EvaluationMetrics:
    """Load metrics from JSON file"""
    with open(input_path) as f:
        data = json.load(f)

    # Reconstruct dataclasses
    data['match_coverage'] = MatchCoverage(**data['match_coverage'])
    data['depth_metrics'] = [DepthMetrics(**dm) for dm in data['depth_metrics']]

    return EvaluationMetrics(**data)


def print_metrics(metrics: EvaluationMetrics):
    """Pretty print evaluation metrics"""
    print(f"\n{'='*60}")
    print(f"Evaluation Results: {metrics.model_name}")
    print(f"{'='*60}")
    print(f"\n📊 Core Metrics:")
    print(f"  Loss:       {metrics.loss:.3f}")
    print(f"  Perplexity: {metrics.perplexity:.2f}")
    print(f"  Brier:      {metrics.brier_score:.3f}")
    print(f"  Cases:      {metrics.num_cases}")

    print(f"\n🎯 Match Coverage:")
    mc = metrics.match_coverage
    print(f"  Exact matches:    {mc.exact_matches:3d} ({mc.exact_matches/mc.total_events*100:5.1f}%)")
    print(f"  Semantic matches: {mc.semantic_matches:3d} ({mc.semantic_matches/mc.total_events*100:5.1f}%)")
    print(f"  LLM matches:      {mc.llm_matches:3d} ({mc.llm_matches/mc.total_events*100:5.1f}%)")
    print(f"  No matches:       {mc.no_matches:3d} ({mc.no_matches/mc.total_events*100:5.1f}%)")
    print(f"  {'─'*40}")
    print(f"  Total match rate: {mc.match_rate*100:.1f}%")

    print(f"\n📏 Per-Depth Breakdown:")
    print(f"  {'Depth':<8} {'Loss':<8} {'Perplexity':<12} {'Match Rate':<12} {'Events':<8}")
    print(f"  {'-'*60}")
    for dm in metrics.depth_metrics:
        print(f"  {dm.depth:<8} {dm.loss:<8.3f} {dm.perplexity:<12.2f} {dm.match_rate*100:<11.1f}% {dm.total_events:<8}")

    print(f"\n{'='*60}\n")


if __name__ == "__main__":
    # Test with dummy data
    predicted_tree = {
        "event": "Major tech company announces layoffs of 10,000 employees",
        "probability": 1.0,
        "children": [
            {
                "event": "Stock price drops sharply",
                "probability": 0.4,
                "children": [
                    {"event": "CEO announces restructuring", "probability": 0.5, "children": []},
                    {"event": "Board replaces leadership", "probability": 0.3, "children": []},
                ]
            },
            {
                "event": "Competitors gain market share",
                "probability": 0.35,
                "children": []
            },
            {
                "event": "Employee morale declines",
                "probability": 0.25,
                "children": []
            }
        ]
    }

    ground_truth = {
        "case_id": "test_001",
        "seed_event": "Major tech company announces layoffs of 10,000 employees",
        "outcome_chain": [
            {"depth": 1, "event": "Stock price drops 15% in initial trading", "date": "2023-04-15"},
            {"depth": 2, "event": "CEO announces restructuring plan", "date": "2023-07-14"},
        ]
    }

    evaluator = TreeEvaluator(use_llm_matcher=False)
    metrics = evaluator.evaluate(predicted_tree, ground_truth, model_name="test-model")

    print_metrics(metrics)
