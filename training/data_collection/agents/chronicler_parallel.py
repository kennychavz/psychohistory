"""
Parallel Chronicler: Process multiple seeds concurrently with rate limiting

Respects Exa API rate limits while maximizing throughput.
"""

import sys
sys.path.append('..')

import asyncio
import json
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from config import config
from utils import llm_client, search_client, parse_json_response, save_checkpoint, load_checkpoint


# Import sync chronicler functions
from agents.chronicler import (
    calculate_search_dates,
    search_for_outcome,
    CHRONICLE_RESEARCH_PROMPT
)


async def chronicle_seed_async(seed: Dict, semaphore: asyncio.Semaphore, seed_idx: int, total: int) -> Optional[Dict]:
    """
    Chronicle a single seed with async/await

    Uses semaphore to limit concurrent API calls
    """
    async with semaphore:
        # Run sync version in executor
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            chronicle_seed_sync,
            seed,
            seed_idx,
            total
        )
        return result


def chronicle_seed_sync(seed: Dict, seed_idx: int, total: int) -> Optional[Dict]:
    """Synchronous version of chronicle_seed (from original chronicler.py)"""
    case_id = f"{seed['date']}_{seed['event'][:30].lower().replace(' ', '_')}"
    print(f"\n[{seed_idx}/{total}] 📖 {seed['event'][:60]}...", flush=True)

    case = {
        "case_id": case_id,
        "seed": {
            "event": seed["event"],
            "date": seed["date"],
            "context": seed.get("context", "")
        },
        "domain": seed["domain"],
        "knowledge_cutoff": seed["date"],
        "levels": []
    }

    path = [seed["event"]]
    current_event = seed["event"]

    # Build 3-depth chain
    for depth in range(1, config.MAX_DEPTH + 1):
        timeframe = depth

        outcome = search_for_outcome(
            seed_event=seed["event"],
            seed_date=seed["date"],
            parent_event=current_event,
            path=path,
            timeframe_months=timeframe
        )

        if not outcome:
            if depth == 1:
                return None  # Can't even find first outcome
            else:
                break  # Partial chain is OK

        path.append(outcome["event"])
        current_event = outcome["event"]

        level = {
            "depth": depth,
            "parent_event": path[-2],
            "path": path.copy(),
            "timeframe_months": timeframe,
            "date": outcome["date"],
            "research_summary": outcome.get("research_summary", ""),
            "candidates": [{"event": outcome["event"], "label": 1}]
        }

        case["levels"].append(level)

    if case["levels"]:
        print(f"   ✅ {len(case['levels'])} levels", flush=True)
        return case
    else:
        return None


async def chronicle_all_parallel(seeds: List[Dict], max_concurrent: int = 10) -> List[Dict]:
    """
    Chronicle all seeds in parallel with rate limiting

    Args:
        seeds: List of seed events
        max_concurrent: Max concurrent API calls (respect Exa limits)

    Returns:
        List of cases with outcome chains
    """
    print(f"\n🚀 Parallel Chronicle: {len(seeds)} seeds, max {max_concurrent} concurrent")
    print(f"   Exa rate limit: ~{max_concurrent * 60} requests/min\n")

    semaphore = asyncio.Semaphore(max_concurrent)

    # Create tasks
    tasks = [
        chronicle_seed_async(seed, semaphore, i+1, len(seeds))
        for i, seed in enumerate(seeds)
    ]

    # Run all concurrently
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Filter out failures
    cases = []
    for result in results:
        if isinstance(result, Exception):
            print(f"   ⚠️  Seed failed: {result}")
        elif result is not None:
            cases.append(result)

    return cases


def main():
    """Main entry point"""
    print("=" * 80)
    print("📖 PARALLEL CHRONICLER AGENT")
    print("=" * 80)

    # Load seeds
    seeds = load_checkpoint("seeds_final.json")
    if not seeds:
        print("❌ No seeds found")
        return

    print(f"\n📚 Loaded {len(seeds)} seeds")

    # Check checkpoint
    cases = load_checkpoint("cases_partial.json")
    if cases:
        print(f"  ✅ Resuming: {len(cases)} cases already done")
    else:
        cases = []

    # Run parallel chronicle
    new_cases = asyncio.run(chronicle_all_parallel(seeds, max_concurrent=10))

    # Merge with existing
    all_cases = cases + new_cases

    # Save
    save_checkpoint(all_cases, "cases_chronicled.json")

    print(f"\n" + "=" * 80)
    print(f"✅ COMPLETE: {len(all_cases)} cases chronicled")
    print("=" * 80)

    return all_cases


if __name__ == "__main__":
    main()
