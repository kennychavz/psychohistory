"""
Brainstormer Agent: Generate 100 seed events

70% Post-Cutoff (July 2024 - June 2025): Out-of-distribution, true forecasting
30% In-Distribution (2019-2022): Supplement for calibration learning
"""

import sys
sys.path.append('..')

from typing import List, Dict
from config import config
from utils import llm_client, parse_json_response, save_checkpoint, load_checkpoint


POST_CUTOFF_PROMPT = """You are generating RECENT historical events (July 2024 - June 2025) for a forecasting AI training dataset.

CRITICAL CONSTRAINTS:
- Events from {start_date} to {end_date} ONLY
- These are AFTER GPT-OSS-20B's June 2024 knowledge cutoff
- Seed must allow 3-month outcome chain to complete by October 31, 2025
- Focus on well-documented events with clear causal chains

REQUIREMENTS:
1. **Specific & Measurable**: Exact date, concrete description
2. **Causal**: Must have clear downstream consequences
3. **Well-Documented**: Multiple reliable news sources
4. **Non-Deterministic**: Multiple plausible outcomes were possible
5. **Recent Impact**: Effects visible within 4 months

DOMAINS (distribute evenly):
- Politics: Elections, policy changes, appointments, legislation
- Economics: Fed decisions, inflation data, market events, earnings
- Technology: Product launches, regulations, AI developments, acquisitions
- Geopolitics: Conflicts, summits, sanctions, elections
- Business: Layoffs, mergers, bankruptcies, leadership changes

AVOID:
- Events before July 2024 (in training data)
- Events after June 2025 (chain won't complete)
- Natural disasters
- Celebrity/sports news
- Overly deterministic outcomes

OUTPUT FORMAT (JSON array):
```json
[
  {{
    "event": "Trump assassination attempt at Pennsylvania rally",
    "date": "2024-07-13",
    "context": "First assassination attempt on former president in decades. Rally in Butler, PA. Secret Service response questioned.",
    "domain": "Politics",
    "why_significant": "Major security event, impacts 2024 election dynamics, Secret Service reform, political rhetoric debates",
    "post_cutoff": true
  }}
]
```

Generate EXACTLY {count} events from {start_date} to {end_date}.
"""

IN_DIST_PROMPT = """You are generating historical events (2019-2022) for a forecasting AI training dataset.

These events are IN the model's training data, but teach probability calibration skills.

REQUIREMENTS:
1. **Specific & Measurable**: Exact date, concrete description
2. **Causal**: Clear downstream consequences
3. **Well-Documented**: Multiple sources
4. **Complex**: Not obvious outcomes

DOMAINS (distribute evenly):
- Politics, Economics, Technology, Geopolitics, Business

OUTPUT FORMAT (JSON array - same fields as post-cutoff):
```json
[
  {{
    "event": "COVID-19 pandemic declared by WHO",
    "date": "2020-03-11",
    "context": "WHO declares COVID-19 a pandemic as cases surge globally, 118,000 cases across 114 countries.",
    "domain": "Geopolitics",
    "why_significant": "Triggers global lockdowns, economic recession, vaccine development race",
    "post_cutoff": false
  }}
]
```

Generate EXACTLY {count} events from {start_year}-{end_year}.
"""


def generate_post_cutoff_seeds(num_seeds: int) -> List[Dict]:
    """Generate post-cutoff seeds (July 2024 - June 2025)"""
    print(f"\n🔮 Generating {num_seeds} POST-CUTOFF seeds (Jul 2024 - Jun 2025)...", flush=True)
    print(f"   These are outside GPT-OSS-20B's training data", flush=True)

    seeds = []
    batch_size = 10

    for batch_num in range((num_seeds + batch_size - 1) // batch_size):
        batch_count = min(batch_size, num_seeds - len(seeds))
        if batch_count <= 0:
            break

        print(f"\n  📦 Batch {batch_num + 1}: Generating {batch_count} seeds...", flush=True)
        print(f"     Calling DeepSeek API (may take 30-60 seconds)...", flush=True)

        prompt = POST_CUTOFF_PROMPT.format(
            count=batch_count,
            start_date=config.POST_CUTOFF_START,
            end_date=config.POST_CUTOFF_END
        )

        try:
            print(f"     🔄 Waiting for LLM response...", flush=True)
            response = llm_client.call_research_model(
                prompt=prompt,
                system_prompt="You are a current events researcher focused on 2024-2025 events.",
                temperature=0.9,
                max_tokens=4000
            )
            print(f"     ✅ LLM response received ({len(response)} chars)", flush=True)

            batch_seeds = parse_json_response(response)

            if batch_seeds and isinstance(batch_seeds, list):
                # Mark as post-cutoff
                for seed in batch_seeds:
                    seed["post_cutoff"] = True
                seeds.extend(batch_seeds)
                print(f"     ✅ {len(batch_seeds)} seeds generated")
            else:
                print(f"     ❌ Parse failed, retrying...")

        except Exception as e:
            print(f"     ❌ Batch failed: {e}")

    return seeds


def generate_in_dist_seeds(num_seeds: int) -> List[Dict]:
    """Generate in-distribution seeds (2019-2022)"""
    print(f"\n📚 Generating {num_seeds} IN-DISTRIBUTION seeds (2019-2022)...")
    print(f"   These supplement with calibration examples")

    seeds = []
    batch_size = 10

    for batch_num in range((num_seeds + batch_size - 1) // batch_size):
        batch_count = min(batch_size, num_seeds - len(seeds))
        if batch_count <= 0:
            break

        print(f"\n  📦 Batch {batch_num + 1}: {batch_count} seeds...")

        prompt = IN_DIST_PROMPT.format(
            count=batch_count,
            start_year=config.IN_DIST_START_YEAR,
            end_year=config.IN_DIST_END_YEAR
        )

        try:
            response = llm_client.call_research_model(
                prompt=prompt,
                temperature=0.9,
                max_tokens=4000
            )

            batch_seeds = parse_json_response(response)

            if batch_seeds and isinstance(batch_seeds, list):
                # Mark as in-dist
                for seed in batch_seeds:
                    seed["post_cutoff"] = False
                seeds.extend(batch_seeds)
                print(f"     ✅ {len(batch_seeds)} seeds generated")

        except Exception as e:
            print(f"     ❌ Batch failed: {e}")

    return seeds


def main():
    """Main entry point"""
    print("=" * 80)
    print("🧠 BRAINSTORMER AGENT")
    print("=" * 80)
    print(f"\nTarget Distribution:")
    print(f"  {config.NUM_SEEDS_POST_CUTOFF} post-cutoff (Jul 2024 - Jun 2025)")
    print(f"  {config.NUM_SEEDS_IN_DISTRIBUTION} in-distribution (2019-2022)")
    print(f"  {config.NUM_SEEDS_POST_CUTOFF + config.NUM_SEEDS_IN_DISTRIBUTION} total")

    # Check checkpoint
    checkpoint = load_checkpoint("seeds_final.json")
    if checkpoint and len(checkpoint) >= (config.NUM_SEEDS_POST_CUTOFF + config.NUM_SEEDS_IN_DISTRIBUTION):
        print(f"\n✅ Checkpoint found: {len(checkpoint)} seeds already generated")
        return checkpoint

    # Generate post-cutoff (priority)
    post_cutoff_seeds = generate_post_cutoff_seeds(config.NUM_SEEDS_POST_CUTOFF)

    # Generate in-distribution (supplement)
    in_dist_seeds = generate_in_dist_seeds(config.NUM_SEEDS_IN_DISTRIBUTION)

    # Combine
    all_seeds = post_cutoff_seeds + in_dist_seeds

    print(f"\n📊 Final Distribution:")
    print(f"   Post-cutoff: {len([s for s in all_seeds if s.get('post_cutoff')])} seeds")
    print(f"   In-distribution: {len([s for s in all_seeds if not s.get('post_cutoff')])} seeds")
    print(f"   Total: {len(all_seeds)} seeds")

    # Sort by date
    all_seeds.sort(key=lambda x: x["date"])

    # Save
    save_checkpoint(all_seeds, "seeds_final.json")

    print(f"\n" + "=" * 80)
    print(f"✅ COMPLETE: {len(all_seeds)} seeds ready")
    print("=" * 80)

    return all_seeds


if __name__ == "__main__":
    main()
