"""
Generate synthetic training data with candidate sets (label=1 for actual, label=0 for alternatives)
"""

import json
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any

# Domain-specific alternative generators
ALTERNATIVE_TEMPLATES = {
    "Technology": [
        "Stock price {action}",
        "CEO {action}",
        "Product {action}",
        "Competitors {action}",
        "Market share {action}",
        "Regulatory investigation {action}",
        "Partnership announced",
        "Acquisition attempt",
        "Bankruptcy filing",
        "IPO delayed"
    ],
    "Economics": [
        "Inflation {action}",
        "Interest rates {action}",
        "Unemployment {action}",
        "Stock market {action}",
        "GDP growth {action}",
        "Consumer spending {action}",
        "Recession declared",
        "Emergency stimulus package",
        "Trade deficit widens",
        "Currency devaluation"
    ],
    "Geopolitics": [
        "Trade deal {action}",
        "Sanctions imposed",
        "Military action",
        "Diplomatic relations {action}",
        "Alliance formed",
        "Treaty signed",
        "Border dispute",
        "Leadership change",
        "Protests escalate",
        "Peace talks initiated"
    ],
    "Social Policy": [
        "Public support {action}",
        "Opposition grows",
        "Court challenge filed",
        "Program expanded",
        "Funding cut",
        "Referendum called",
        "Implementation delayed",
        "Pilot results released",
        "Legislative changes",
        "Protests organized"
    ]
}

ACTIONS = ["increases", "decreases", "stabilizes", "announced", "suspended", "revised"]

# Actual historical outcomes (what happened)
CASE_TEMPLATES = [
    {
        "seed_event": "Major tech company announces layoffs of 10,000 employees",
        "seed_date": "2023-01-15",
        "context": "Tech downturn, rising interest rates, over-hiring during pandemic",
        "domain": "Technology",
        "actual_outcomes": [
            {"months": 3, "event": "Stock price drops 15% in initial trading"},
            {"months": 6, "event": "CEO announces restructuring plan"},
            {"months": 12, "event": "Company returns to profitability"},
        ]
    },
    {
        "seed_event": "Central bank raises interest rates by 75 basis points",
        "seed_date": "2022-09-21",
        "context": "Inflation at 8.2%, highest in 40 years, unemployment at 3.7%",
        "domain": "Economics",
        "actual_outcomes": [
            {"months": 1, "event": "Mortgage rates surge to 7% for 30-year fixed"},
            {"months": 3, "event": "Housing market sees 20% decline in sales volume"},
            {"months": 6, "event": "Inflation shows signs of cooling to 6.5%"},
        ]
    },
    {
        "seed_event": "Country announces universal basic income pilot program",
        "seed_date": "2021-03-10",
        "context": "Post-pandemic economic recovery, 12% unemployment, $500/month to 5000 citizens",
        "domain": "Social Policy",
        "actual_outcomes": [
            {"months": 6, "event": "Initial study shows 15% reduction in poverty rate"},
            {"months": 12, "event": "Critics raise concerns about inflation in local markets"},
            {"months": 18, "event": "Government votes to expand program to 50,000 citizens"},
        ]
    },
    {
        "seed_event": "Major social media platform banned in country of 200M users",
        "seed_date": "2022-06-15",
        "context": "Government cites national security, platform refuses data localization",
        "domain": "Geopolitics",
        "actual_outcomes": [
            {"months": 1, "event": "VPN downloads surge 300% as users seek workarounds"},
            {"months": 3, "event": "Platform loses $2B in market cap, announces job cuts"},
            {"months": 9, "event": "Competing local platform gains 50M users"},
        ]
    },
    {
        "seed_event": "Breakthrough AI model achieves human-level performance on coding",
        "seed_date": "2023-03-20",
        "context": "Model scores 85% on HumanEval benchmark, open-sourced by research lab",
        "domain": "Technology",
        "actual_outcomes": [
            {"months": 2, "event": "10,000+ GitHub repos integrate model within weeks"},
            {"months": 6, "event": "Major tech companies announce AI-assisted development tools"},
            {"months": 12, "event": "Developer survey shows 70% using AI coding assistants daily"},
        ]
    },
]


def generate_alternatives(domain: str, actual_event: str, num_alternatives: int = 3) -> List[str]:
    """Generate plausible alternative events that didn't happen"""
    templates = ALTERNATIVE_TEMPLATES.get(domain, ALTERNATIVE_TEMPLATES["Technology"])
    alternatives = []

    for _ in range(num_alternatives):
        template = random.choice(templates)
        if "{action}" in template:
            action = random.choice(ACTIONS)
            alt = template.replace("{action}", action)
        else:
            alt = template

        # Don't include the actual event
        if alt.lower() not in actual_event.lower() and alt not in alternatives:
            alternatives.append(alt)

    return alternatives[:num_alternatives]


def generate_case_with_candidates(template: Dict, case_index: int) -> Dict:
    """Generate a case with candidate sets at each depth"""
    seed_date = datetime.strptime(template["seed_date"], "%Y-%m-%d")

    levels = []
    cumulative_months = 0
    path = [template["seed_event"]]  # Start with seed

    for depth_idx, outcome in enumerate(template["actual_outcomes"]):
        # Generate alternatives (label=0)
        alternatives = generate_alternatives(
            template["domain"],
            outcome["event"],
            num_alternatives=3
        )

        # Build candidate set
        candidates = [
            {"event": outcome["event"], "label": 1}  # What actually happened
        ]

        for alt in alternatives:
            candidates.append({"event": alt, "label": 0})  # What didn't happen

        # Shuffle so label=1 isn't always first
        random.shuffle(candidates)

        # Calculate date
        event_date = seed_date + timedelta(days=outcome["months"] * 30)

        # Parent is last event in path (for depth 1, it's the seed)
        parent_event = path[-1] if path else template["seed_event"]

        levels.append({
            "depth": depth_idx + 1,
            "parent_event": parent_event,
            "path": path.copy(),  # Path UP TO this depth (not including current)
            "timeframe_months": outcome["months"] - cumulative_months,
            "date": event_date.strftime("%Y-%m-%d"),
            "research_summary": f"Research period: {cumulative_months}-{outcome['months']} months after seed event",
            "candidates": candidates
        })

        # Add this outcome to path for next depth
        path.append(outcome["event"])
        cumulative_months = outcome["months"]

    return {
        "case_id": f"synthetic_{case_index:03d}",
        "seed": {
            "event": template["seed_event"],
            "date": template["seed_date"],
            "context": template["context"]
        },
        "domain": template["domain"],
        "knowledge_cutoff": template["seed_date"],
        "levels": levels
    }


def generate_dataset(num_cases: int = 30, output_path: str = "data/historical_cases.jsonl"):
    """Generate dataset with candidate sets"""
    cases = []

    for i in range(num_cases):
        template = CASE_TEMPLATES[i % len(CASE_TEMPLATES)]
        case = generate_case_with_candidates(template, i)
        cases.append(case)

    # Write to JSONL
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, 'w') as f:
        for case in cases:
            f.write(json.dumps(case) + '\n')

    print(f"✅ Generated {num_cases} cases with candidate sets")
    print(f"📁 Saved to: {output_file}")

    # Print sample
    print(f"\n📝 Sample case:")
    print(json.dumps(cases[0], indent=2))

    # Stats
    total_candidates = sum(len(level["candidates"]) for case in cases for level in case["levels"])
    total_positives = sum(
        sum(1 for c in level["candidates"] if c["label"] == 1)
        for case in cases for level in case["levels"]
    )

    print(f"\n📊 Statistics:")
    print(f"  Total cases: {num_cases}")
    print(f"  Total levels: {sum(len(case['levels']) for case in cases)}")
    print(f"  Total candidates: {total_candidates}")
    print(f"  Positive labels: {total_positives}")
    print(f"  Negative labels: {total_candidates - total_positives}")

    return cases


if __name__ == "__main__":
    generate_dataset(num_cases=30)
