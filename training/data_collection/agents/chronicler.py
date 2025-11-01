"""
Chronicler Agent: Find actual 3-depth outcome chains

For each seed event, search for what ACTUALLY happened in the months
following the event. Build a causal chain of real outcomes.
"""

import sys
sys.path.append('..')

from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from config import config
from utils import llm_client, search_client, parse_json_response, save_checkpoint, load_checkpoint


CHRONICLE_RESEARCH_PROMPT = """You are researching what happened AFTER this historical event:

SEED EVENT:
Event: {event}
Date: {date}
Context: {context}

CURRENT PATH:
{path}

TASK: Find what actually happened {timeframe_months} months after "{parent_event}".

SEARCH RESULTS:
{search_results}

Based on the search results, identify ONE specific event that:
1. Happened approximately {timeframe_months} months after the parent event
2. Was a DIRECT consequence of the parent event
3. Is specific, measurable, and well-documented
4. Has a clear date

OUTPUT FORMAT (JSON):
```json
{{
  "event": "30-year mortgage rates exceed 7% for first time in 20 years",
  "date": "2022-10-27",
  "timeframe_months": 1,
  "research_summary": "Multiple sources confirm that 30-year fixed mortgage rates crossed 7% threshold in late October 2022, direct result of Fed rate hikes.",
  "sources": ["https://...", "https://..."]
}}
```

If no clear event found, return:
```json
{{
  "event": null,
  "reason": "Could not find documented outcome at this timeframe"
}}
```
"""


def calculate_search_dates(seed_date: str, timeframe_months: int) -> Tuple[str, str]:
    """
    Calculate search date range

    Returns: (start_date, end_date) in YYYY-MM-DD format
    """
    seed_dt = datetime.strptime(seed_date, "%Y-%m-%d")

    # Search window: +/- 2 weeks around target timeframe
    target_dt = seed_dt + timedelta(days=30 * timeframe_months)
    start_dt = target_dt - timedelta(days=14)
    end_dt = target_dt + timedelta(days=14)

    return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")


def search_for_outcome(
    seed_event: str,
    seed_date: str,
    parent_event: str,
    path: List[str],
    timeframe_months: int
) -> Optional[Dict]:
    """
    Search web for actual outcome at specified timeframe

    Args:
        seed_event: Original seed event
        seed_date: Date of seed event
        parent_event: Most recent event in chain
        path: Full path of events so far
        timeframe_months: Months after seed to search

    Returns:
        Outcome dict or None if not found
    """
    print(f"\n  📡 Searching for outcome {timeframe_months} months after seed...")

    # Calculate search date range
    start_date, end_date = calculate_search_dates(seed_date, timeframe_months)
    print(f"     Date range: {start_date} to {end_date}")

    # Build search query
    # Focus on consequences of the parent event
    search_query = f"{parent_event} outcome consequence result {start_date}"

    try:
        # Search with date constraints
        search_results = search_client.search_with_date_range(
            query=search_query,
            start_date=start_date,
            end_date=end_date,
            max_results=8
        )

        if not search_results:
            print(f"     ⚠️  No search results found")
            return None

        # Format search results for LLM
        formatted_results = "\n\n".join([
            f"[{i+1}] {r['title']}\nURL: {r['url']}\n{r['content'][:500]}..."
            for i, r in enumerate(search_results)
        ])

        print(f"     📚 Found {len(search_results)} search results")

        # Use reasoning model to analyze results
        prompt = CHRONICLE_RESEARCH_PROMPT.format(
            event=seed_event,
            date=seed_date,
            context="",  # Can add context if needed
            path=" → ".join(path),
            parent_event=parent_event,
            timeframe_months=timeframe_months,
            search_results=formatted_results
        )

        response = llm_client.call_reasoning_model(
            prompt=prompt,
            system_prompt="You are a factual historical researcher. Only report events that are clearly documented in the sources.",
            temperature=0.3  # Lower temperature for factual extraction
        )

        outcome = parse_json_response(response)

        if not outcome:
            print(f"     ❌ Failed to parse LLM response")
            return None

        if outcome.get("event") is None:
            reason = outcome.get("reason", "Unknown")
            print(f"     ⚠️  No outcome found: {reason}")
            return None

        print(f"     ✅ Found: {outcome['event'][:60]}...")
        return outcome

    except Exception as e:
        print(f"     ❌ Search failed: {e}")
        return None


def chronicle_seed(seed: Dict) -> Optional[Dict]:
    """
    Chronicle a single seed: find 3-depth outcome chain

    Args:
        seed: Seed event dict

    Returns:
        Full case dict with levels, or None if failed
    """
    case_id = f"{seed['date']}_{seed['event'][:30].lower().replace(' ', '_')}"
    print(f"\n📖 Chronicling: {seed['event'][:70]}...")
    print(f"   Date: {seed['date']} | Domain: {seed['domain']}")

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

    # Track path through tree
    path = [seed["event"]]
    current_event = seed["event"]

    # Build 3-depth chain
    for depth in range(1, config.MAX_DEPTH + 1):
        timeframe = depth  # 1, 2, 3 months

        print(f"\n  🔍 Depth {depth} (t+{timeframe} months)...")

        outcome = search_for_outcome(
            seed_event=seed["event"],
            seed_date=seed["date"],
            parent_event=current_event,
            path=path,
            timeframe_months=timeframe
        )

        if not outcome:
            print(f"  ⚠️  Chain broken at depth {depth}")
            # Can't continue without outcome
            if depth == 1:
                # If we can't even find first outcome, skip this seed
                return None
            else:
                # Partial chain is ok
                break

        # Add to path
        path.append(outcome["event"])
        current_event = outcome["event"]

        # Create level entry (candidates will be added later by Alternative Generator)
        level = {
            "depth": depth,
            "parent_event": path[-2],  # Previous event
            "path": path.copy(),
            "timeframe_months": timeframe,
            "date": outcome["date"],
            "research_summary": outcome.get("research_summary", ""),
            "candidates": [
                {
                    "event": outcome["event"],
                    "label": 1  # This actually happened
                }
                # Alternatives will be added by next agent
            ]
        }

        case["levels"].append(level)

    if not case["levels"]:
        print(f"  ❌ No outcomes found for this seed")
        return None

    print(f"\n  ✅ Chronicle complete: {len(case['levels'])} levels")
    return case


def main():
    """Main entry point"""
    print("=" * 80)
    print("📖 CHRONICLER AGENT")
    print("=" * 80)

    # Load seeds
    seeds = load_checkpoint("seeds_final.json")
    if not seeds:
        print("❌ No seeds found. Run brainstormer.py first.")
        return

    print(f"\n📚 Loaded {len(seeds)} seeds")

    # Check for existing cases
    cases = load_checkpoint("cases_partial.json")
    if cases:
        completed_ids = {c["case_id"] for c in cases}
        print(f"  ✅ Resuming from checkpoint: {len(cases)} cases complete")
    else:
        cases = []
        completed_ids = set()

    # Chronicle each seed
    for i, seed in enumerate(seeds):
        case_id = f"{seed['date']}_{seed['event'][:30].lower().replace(' ', '_')}"

        if case_id in completed_ids:
            print(f"\n[{i+1}/{len(seeds)}] ⏭️  Skipping (already done): {seed['event'][:50]}...")
            continue

        print(f"\n{'='*80}")
        print(f"[{i+1}/{len(seeds)}]")

        case = chronicle_seed(seed)

        if case:
            cases.append(case)
            completed_ids.add(case_id)

            # Save checkpoint every 5 cases
            if len(cases) % 5 == 0:
                save_checkpoint(cases, "cases_partial.json")

        else:
            print(f"  ⚠️  Skipping seed (could not chronicle)")

    # Save final
    save_checkpoint(cases, "cases_chronicled.json")

    print(f"\n" + "=" * 80)
    print(f"✅ COMPLETE: {len(cases)} cases chronicled")
    print(f"   Next: Run alternative_gen.py to add counterfactuals")
    print("=" * 80)

    return cases


if __name__ == "__main__":
    main()
