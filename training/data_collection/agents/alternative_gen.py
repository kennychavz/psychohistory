"""
Alternative Generator: Create counterfactual events

For each depth level, generate 3 plausible alternatives that COULD have
happened but didn't.
"""

import sys
sys.path.append('..')

from typing import List, Dict
from config import config
from utils import llm_client, parse_json_response, save_checkpoint, load_checkpoint


ALTERNATIVE_PROMPT = """You are generating counterfactual events that COULD have happened but DIDN'T.

CONTEXT:
Seed Event: {seed_event} ({seed_date})
Current Path: {path}
What Actually Happened: {actual_event} (label=1)
Timeframe: {timeframe_months} months

TASK: Generate {count} plausible ALTERNATIVE events that:
1. COULD have happened at this timeframe
2. Are similar in magnitude/impact to the actual event
3. Are specific and measurable
4. Did NOT actually happen (we've verified via search)
5. Are diverse (different types of outcomes)

REQUIREMENTS:
- Be realistic given the context
- Similar timeframe as actual event
- Match the domain/theme
- NOT repeat the actual event

OUTPUT FORMAT (JSON array):
```json
[
  {{
    "event": "Fed announces pause in rate hikes citing recession concerns",
    "label": 0
  }},
  {{
    "event": "Mortgage rates stabilize at 6.5% as investors flee to bonds",
    "label": 0
  }},
  {{
    "event": "Housing market crashes 30% triggering emergency Fed action",
    "label": 0
  }}
]
```

Generate EXACTLY {count} alternatives.
"""


def generate_alternatives(case: Dict) -> Dict:
    """Add alternatives to each level in the case"""

    print(f"\n🎲 Generating alternatives for: {case['case_id'][:50]}...")

    for level in case["levels"]:
        depth = level["depth"]
        actual_event = level["candidates"][0]["event"]  # The one with label=1

        print(f"  Depth {depth}: Generating {config.ALTERNATIVES_PER_DEPTH} alternatives...")

        prompt = ALTERNATIVE_PROMPT.format(
            seed_event=case["seed"]["event"],
            seed_date=case["seed"]["date"],
            path=" → ".join(level["path"]),
            actual_event=actual_event,
            timeframe_months=level["timeframe_months"],
            count=config.ALTERNATIVES_PER_DEPTH
        )

        try:
            response = llm_client.call_research_model(
                prompt=prompt,
                temperature=0.9,  # Higher for creativity
                max_tokens=1000
            )

            alternatives = parse_json_response(response)

            if not alternatives or len(alternatives) < config.ALTERNATIVES_PER_DEPTH:
                print(f"    ⚠️  Only got {len(alternatives) if alternatives else 0} alternatives")
                # Retry once
                response = llm_client.call_research_model(prompt=prompt, temperature=0.95)
                alternatives = parse_json_response(response)

            if alternatives:
                # Add to candidates
                level["candidates"].extend(alternatives[:config.ALTERNATIVES_PER_DEPTH])
                print(f"    ✅ Added {len(alternatives[:config.ALTERNATIVES_PER_DEPTH])} alternatives")
            else:
                print(f"    ❌ Failed to generate alternatives")

        except Exception as e:
            print(f"    ❌ Error: {e}")
            continue

    return case


def main():
    """Main entry point"""
    print("=" * 80)
    print("🎲 ALTERNATIVE GENERATOR")
    print("=" * 80)

    # Load chronicled cases
    cases = load_checkpoint("cases_chronicled.json")
    if not cases:
        print("❌ No cases found. Run chronicler.py first.")
        return

    print(f"\n📚 Loaded {len(cases)} cases")

    # Add alternatives to each
    for i, case in enumerate(cases):
        print(f"\n[{i+1}/{len(cases)}]")
        generate_alternatives(case)

        # Save checkpoint every 10 cases
        if (i + 1) % 10 == 0:
            save_checkpoint(cases, "cases_with_alternatives.json")

    # Save final
    save_checkpoint(cases, "cases_complete.json")

    print(f"\n" + "=" * 80)
    print(f"✅ COMPLETE: {len(cases)} cases with alternatives")
    print(f"   Next: Run verifier.py for multi-source validation")
    print("=" * 80)

    return cases


if __name__ == "__main__":
    main()
