"""
End-to-end training pipeline orchestration

Runs the complete training flow:
1. Generate synthetic data
2. Upload to Modal
3. Train SFT (rank 64)
4. Train GRPO (rank 4)
5. Evaluate all models
6. Generate comparison report
"""

import subprocess
import json
from pathlib import Path
from datetime import datetime


def run_command(cmd: str, description: str):
    """Run a shell command and handle errors"""
    print(f"\n{'='*60}")
    print(f"▶️  {description}")
    print(f"{'='*60}\n")

    result = subprocess.run(cmd, shell=True, capture_output=False)

    if result.returncode != 0:
        print(f"❌ Failed: {description}")
        raise RuntimeError(f"Command failed with code {result.returncode}")

    print(f"\n✅ Completed: {description}")


def generate_data(num_cases: int = 10):
    """Step 1: Generate synthetic training data"""
    print("\n📊 Step 1: Generating Synthetic Data")
    print("-" * 60)

    from scripts.generate_synthetic_data import generate_synthetic_dataset

    cases = generate_synthetic_dataset(
        num_cases=num_cases,
        output_path="training/data/synthetic_cases.jsonl"
    )

    return len(cases)


def train_sft(lora_rank: int = 64):
    """Step 2: Train SFT model"""
    print("\n🏋️  Step 2: Training SFT Model")
    print("-" * 60)

    run_command(
        f"modal run training/modal_sft.py --lora-rank={lora_rank}",
        f"SFT Training (rank {lora_rank})"
    )


def train_grpo(lora_rank: int = 4):
    """Step 3: Train GRPO model"""
    print("\n🏋️  Step 3: Training GRPO Model")
    print("-" * 60)

    run_command(
        f"modal run training/modal_grpo.py --lora-rank={lora_rank}",
        f"GRPO Training (rank {lora_rank})"
    )


def evaluate_models():
    """Step 4: Evaluate all models"""
    print("\n📈 Step 4: Evaluating Models")
    print("-" * 60)

    from evaluation.evaluator import TreeEvaluator, print_metrics, save_metrics
    from inference import ProbabilityTreeInference

    # Load test cases
    test_cases = []
    with open("training/data/synthetic_cases.jsonl") as f:
        for line in f:
            test_cases.append(json.loads(line))

    print(f"  Loaded {len(test_cases)} test cases")

    # Initialize inference engine
    inference = ProbabilityTreeInference()
    evaluator = TreeEvaluator(use_llm_matcher=False)

    results = {}

    # Evaluate baseline
    print("\n  Evaluating baseline...")
    inference.load_adapter(None)

    baseline_preds = []
    for case in test_cases:
        tree = inference.generate_tree(
            seed_event=case['seed_event'],
            context=case['context']
        )
        baseline_preds.append(tree)

    baseline_metrics = evaluator.evaluate_batch(
        baseline_preds,
        test_cases,
        model_name="baseline"
    )

    results['baseline'] = baseline_metrics
    print_metrics(baseline_metrics)
    save_metrics(baseline_metrics, "training/results/baseline_metrics.json")

    # Evaluate SFT
    print("\n  Evaluating SFT model...")
    inference.load_adapter("/data/models/sft/final", "sft")

    sft_preds = []
    for case in test_cases:
        tree = inference.generate_tree(
            seed_event=case['seed_event'],
            context=case['context']
        )
        sft_preds.append(tree)

    sft_metrics = evaluator.evaluate_batch(
        sft_preds,
        test_cases,
        model_name="sft"
    )

    results['sft'] = sft_metrics
    print_metrics(sft_metrics)
    save_metrics(sft_metrics, "training/results/sft_metrics.json")

    # Evaluate GRPO
    print("\n  Evaluating GRPO model...")
    inference.load_adapter("/data/models/grpo/final", "grpo")

    grpo_preds = []
    for case in test_cases:
        tree = inference.generate_tree(
            seed_event=case['seed_event'],
            context=case['context']
        )
        grpo_preds.append(tree)

    grpo_metrics = evaluator.evaluate_batch(
        grpo_preds,
        test_cases,
        model_name="grpo"
    )

    results['grpo'] = grpo_metrics
    print_metrics(grpo_metrics)
    save_metrics(grpo_metrics, "training/results/grpo_metrics.json")

    return results


def format_depth_metrics(depth_metrics):
    """Format depth metrics for report"""
    lines = []
    for dm in depth_metrics:
        lines.append(f"- Depth {dm.depth}: Perplexity {dm.perplexity:.2f}, Match Rate {dm.match_rate*100:.1f}%")
    return '\n'.join(lines)


def generate_report(results: dict):
    """Step 5: Generate comparison report"""
    print("\n📊 Step 5: Generating Comparison Report")
    print("-" * 60)

    report = f"""# PsychoHistory Training Results
Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

## Summary

| Model    | Perplexity | Loss  | Brier | Match Rate |
|----------|------------|-------|-------|------------|
| Baseline | {results['baseline'].perplexity:8.2f} | {results['baseline'].loss:.3f} | {results['baseline'].brier_score:.3f} | {results['baseline'].match_coverage.match_rate*100:6.1f}% |
| SFT      | {results['sft'].perplexity:8.2f} | {results['sft'].loss:.3f} | {results['sft'].brier_score:.3f} | {results['sft'].match_coverage.match_rate*100:6.1f}% |
| GRPO     | {results['grpo'].perplexity:8.2f} | {results['grpo'].loss:.3f} | {results['grpo'].brier_score:.3f} | {results['grpo'].match_coverage.match_rate*100:6.1f}% |

## Improvement vs Baseline

- **SFT:** {(1 - results['sft'].perplexity / results['baseline'].perplexity) * 100:.1f}% perplexity reduction
- **GRPO:** {(1 - results['grpo'].perplexity / results['baseline'].perplexity) * 100:.1f}% perplexity reduction

## Match Coverage Analysis

### Baseline
- Exact: {results['baseline'].match_coverage.exact_matches}
- Semantic: {results['baseline'].match_coverage.semantic_matches}
- LLM: {results['baseline'].match_coverage.llm_matches}
- None: {results['baseline'].match_coverage.no_matches}

### SFT
- Exact: {results['sft'].match_coverage.exact_matches}
- Semantic: {results['sft'].match_coverage.semantic_matches}
- LLM: {results['sft'].match_coverage.llm_matches}
- None: {results['sft'].match_coverage.no_matches}

### GRPO
- Exact: {results['grpo'].match_coverage.exact_matches}
- Semantic: {results['grpo'].match_coverage.semantic_matches}
- LLM: {results['grpo'].match_coverage.llm_matches}
- None: {results['grpo'].match_coverage.no_matches}

## Per-Depth Performance

### Baseline
{format_depth_metrics(results['baseline'].depth_metrics)}

### SFT
{format_depth_metrics(results['sft'].depth_metrics)}

### GRPO
{format_depth_metrics(results['grpo'].depth_metrics)}

## Conclusions

{get_conclusions(results)}
"""

    # Save report
    Path("training/results").mkdir(parents=True, exist_ok=True)
    with open("training/results/REPORT.md", 'w') as f:
        f.write(report)

    print(report)
    print(f"\n✅ Report saved to: training/results/REPORT.md")


def get_conclusions(results: dict) -> str:
    """Generate conclusions based on results"""
    baseline_ppl = results['baseline'].perplexity
    sft_ppl = results['sft'].perplexity
    grpo_ppl = results['grpo'].perplexity

    conclusions = []

    if sft_ppl < baseline_ppl * 0.5:
        conclusions.append("✅ SFT shows strong improvement (>50% perplexity reduction)")
    elif sft_ppl < baseline_ppl * 0.8:
        conclusions.append("⚠️  SFT shows moderate improvement (20-50% perplexity reduction)")
    else:
        conclusions.append("❌ SFT shows minimal improvement (<20% perplexity reduction)")

    if grpo_ppl < sft_ppl:
        conclusions.append("✅ GRPO further improves upon SFT")
    else:
        conclusions.append("⚠️  GRPO did not improve upon SFT (may need more epochs or tuning)")

    if results['baseline'].match_coverage.no_matches > results['baseline'].match_coverage.total_events * 0.3:
        conclusions.append("⚠️  High no-match rate suggests matcher needs improvement")

    return '\n'.join(f"- {c}" for c in conclusions)


def main():
    """Run full pipeline"""
    print("\n" + "="*60)
    print("🎯 PsychoHistory Training Pipeline")
    print("="*60)

    start_time = datetime.now()

    try:
        # Step 1: Generate data
        num_cases = generate_data(num_cases=10)
        print(f"\n✅ Generated {num_cases} training cases")

        # Step 2: Train SFT
        # NOTE: Commented out for now - requires Modal setup
        # train_sft(lora_rank=64)

        # Step 3: Train GRPO
        # NOTE: Commented out for now - requires Modal setup
        # train_grpo(lora_rank=4)

        # Step 4: Evaluate
        # NOTE: Commented out for now - requires trained models
        # results = evaluate_models()

        # Step 5: Report
        # NOTE: Commented out for now - requires evaluation results
        # generate_report(results)

        print("\n" + "="*60)
        print("✅ Pipeline Complete!")
        print(f"  Duration: {datetime.now() - start_time}")
        print("="*60 + "\n")

        print("\n📝 Next Steps:")
        print("  1. Set up Modal account and secrets")
        print("  2. Uncomment training steps in this script")
        print("  3. Run: python training/run_pipeline.py")
        print("  4. Review results in training/results/REPORT.md")

    except Exception as e:
        print(f"\n❌ Pipeline failed: {e}")
        raise


if __name__ == "__main__":
    main()
