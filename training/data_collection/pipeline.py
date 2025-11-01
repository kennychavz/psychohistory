"""
Main Data Collection Pipeline

Orchestrates all agents to generate 100 training cases.

Usage:
    python pipeline.py --stage all         # Run full pipeline
    python pipeline.py --stage brainstorm  # Just generate seeds
    python pipeline.py --stage chronicle   # Just chronicle seeds
    python pipeline.py --stage verify      # Verify and output JSONL
"""

import sys
import os
import json
import argparse
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from agents import brainstormer, chronicler, alternative_gen
from config import config


def run_brainstorm():
    """Stage 1: Generate seed events"""
    print("\n" + "=" * 80)
    print("STAGE 1: BRAINSTORM - Generate Seed Events")
    print("=" * 80)
    seeds = brainstormer.main()
    print(f"\n✅ Stage 1 complete: {len(seeds)} seeds generated\n")
    return seeds


def run_chronicle():
    """Stage 2: Find actual outcomes"""
    print("\n" + "=" * 80)
    print("STAGE 2: CHRONICLE - Find Actual Outcomes")
    print("=" * 80)
    cases = chronicler.main()
    print(f"\n✅ Stage 2 complete: {len(cases)} cases chronicled\n")
    return cases


def run_alternatives():
    """Stage 3: Generate counterfactuals"""
    print("\n" + "=" * 80)
    print("STAGE 3: ALTERNATIVES - Generate Counterfactuals")
    print("=" * 80)
    cases = alternative_gen.main()
    print(f"\n✅ Stage 3 complete: {len(cases)} cases with alternatives\n")
    return cases


def export_to_jsonl(cases, output_path):
    """Stage 4: Export to JSONL format for training"""
    print("\n" + "=" * 80)
    print("STAGE 4: EXPORT - Convert to Training Format")
    print("=" * 80)

    print(f"\n📝 Exporting {len(cases)} cases to {output_path}...")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, 'w') as f:
        for case in cases:
            # Write each case as a JSON line
            f.write(json.dumps(case) + '\n')

    print(f"✅ Exported to: {output_path}")
    print(f"   Format: {len(cases)} lines, one case per line")

    # Print stats
    total_levels = sum(len(c["levels"]) for c in cases)
    total_candidates = sum(
        len(level["candidates"])
        for c in cases
        for level in c["levels"]
    )
    total_positives = sum(
        sum(1 for cand in level["candidates"] if cand["label"] == 1)
        for c in cases
        for level in c["levels"]
    )
    total_negatives = total_candidates - total_positives

    print(f"\n📊 Statistics:")
    print(f"   Cases: {len(cases)}")
    print(f"   Total levels: {total_levels}")
    print(f"   Total candidates: {total_candidates}")
    print(f"   Positive examples (label=1): {total_positives}")
    print(f"   Negative examples (label=0): {total_negatives}")
    print(f"   Avg depth per case: {total_levels / len(cases):.1f}")

    return output_path


def main():
    parser = argparse.ArgumentParser(description="Run data collection pipeline")
    parser.add_argument(
        "--stage",
        choices=["all", "brainstorm", "chronicle", "alternatives", "export"],
        default="all",
        help="Which stage to run"
    )
    parser.add_argument(
        "--output",
        default=config.OUTPUT_PATH,
        help="Output path for final JSONL"
    )

    args = parser.parse_args()

    print("\n" + "="*80)
    print("🏭 PSYCHOHISTORY DATA COLLECTION PIPELINE")
    print("="*80)
    print(f"\nConfiguration:")
    print(f"  Target: {config.NUM_SEEDS} cases")
    print(f"  Years: {config.SEED_START_YEAR}-{config.SEED_END_YEAR}")
    print(f"  Depth: {config.MAX_DEPTH} levels")
    print(f"  Alternatives: {config.ALTERNATIVES_PER_DEPTH} per level")
    print(f"  Output: {args.output}")

    try:
        if args.stage == "all":
            # Run full pipeline
            run_brainstorm()
            run_chronicle()
            run_alternatives()

            # Load completed cases and export
            from utils import load_checkpoint
            cases = load_checkpoint("cases_complete.json")
            if cases:
                export_to_jsonl(cases, args.output)
            else:
                print("❌ No completed cases found")

        elif args.stage == "brainstorm":
            run_brainstorm()

        elif args.stage == "chronicle":
            run_chronicle()

        elif args.stage == "alternatives":
            run_alternatives()

        elif args.stage == "export":
            from utils import load_checkpoint
            cases = load_checkpoint("cases_complete.json")
            if cases:
                export_to_jsonl(cases, args.output)
            else:
                print("❌ No completed cases found")

        print("\n" + "="*80)
        print("✅ PIPELINE COMPLETE")
        print("="*80)

    except KeyboardInterrupt:
        print("\n\n⚠️  Pipeline interrupted by user")
        print("   Checkpoints saved, you can resume later")
    except Exception as e:
        print(f"\n\n❌ Pipeline failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
