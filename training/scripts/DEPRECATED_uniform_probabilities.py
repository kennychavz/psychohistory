"""
Generate synthetic historical case studies for testing the training pipeline.

This creates realistic training data in the correct format without needing
to call external APIs or do actual historical research.
"""

import json
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any
from dataclasses import dataclass, asdict


@dataclass
class OutcomeEvent:
    """Single event in an outcome chain"""
    depth: int
    event: str
    date: str
    timeframe_months: int


@dataclass
class HistoricalCase:
    """Complete historical case study"""
    case_id: str
    seed_event: str
    seed_date: str
    context: str
    domain: str
    outcome_chain: List[Dict[str, Any]]


# Synthetic case templates (based on real patterns)
SYNTHETIC_CASES = [
    {
        "seed_event": "Major tech company announces layoffs of 10,000 employees",
        "seed_date": "2023-01-15",
        "context": "Tech downturn, rising interest rates, over-hiring during pandemic",
        "domain": "Technology",
        "outcomes": [
            (3, "Stock price drops 15% in initial trading", 0),
            (6, "CEO announces restructuring plan", 5),
            (12, "Company returns to profitability", 11),
            (18, "Announces modest hiring for AI roles", 17),
        ]
    },
    {
        "seed_event": "Central bank raises interest rates by 75 basis points",
        "seed_date": "2022-09-21",
        "context": "Inflation at 8.2%, highest in 40 years, unemployment at 3.7%",
        "domain": "Economics",
        "outcomes": [
            (1, "Mortgage rates surge to 7% for 30-year fixed", 0),
            (3, "Housing market sees 20% decline in sales volume", 2),
            (6, "Inflation shows signs of cooling to 6.5%", 5),
            (12, "Recession fears ease as economy stabilizes", 11),
        ]
    },
    {
        "seed_event": "Country announces universal basic income pilot program",
        "seed_date": "2021-03-10",
        "context": "Post-pandemic economic recovery, 12% unemployment, $500/month to 5000 citizens",
        "domain": "Social Policy",
        "outcomes": [
            (6, "Initial study shows 15% reduction in poverty rate", 5),
            (12, "Critics raise concerns about inflation in local markets", 11),
            (18, "Government votes to expand program to 50,000 citizens", 17),
            (24, "Long-term study reveals mixed employment effects", 23),
        ]
    },
    {
        "seed_event": "Major social media platform banned in country of 200M users",
        "seed_date": "2022-06-15",
        "context": "Government cites national security, platform refuses data localization",
        "domain": "Geopolitics",
        "outcomes": [
            (1, "VPN downloads surge 300% as users seek workarounds", 0),
            (3, "Platform loses $2B in market cap, announces job cuts", 2),
            (9, "Competing local platform gains 50M users", 8),
            (18, "Platform reaches data-sharing compromise with government", 17),
        ]
    },
    {
        "seed_event": "Breakthrough AI model achieves human-level performance on coding",
        "seed_date": "2023-03-20",
        "context": "Model scores 85% on HumanEval benchmark, open-sourced by research lab",
        "domain": "Technology",
        "outcomes": [
            (2, "10,000+ GitHub repos integrate model within weeks", 1),
            (6, "Major tech companies announce AI-assisted development tools", 5),
            (12, "Developer survey shows 70% using AI coding assistants daily", 11),
            (24, "Industry reports 40% productivity gains in software development", 23),
        ]
    },
    {
        "seed_event": "Climate summit results in binding emissions reduction treaty",
        "seed_date": "2021-11-13",
        "context": "195 countries agree to 50% reduction by 2030, legally binding",
        "domain": "Geopolitics",
        "outcomes": [
            (6, "EU announces carbon border tax on high-emission imports", 5),
            (12, "Major oil companies commit to net-zero by 2040", 11),
            (24, "Renewable energy investment reaches $500B annually", 23),
            (36, "Global emissions show first sustained decline since 1990", 35),
        ]
    },
    {
        "seed_event": "Major cryptocurrency exchange collapses, $8B in user funds frozen",
        "seed_date": "2022-11-08",
        "context": "CEO arrested for fraud, regulatory oversight lacking, 2M affected users",
        "domain": "Economics",
        "outcomes": [
            (1, "Bitcoin drops 25%, broader crypto market loses $200B", 0),
            (3, "Regulators announce emergency hearings on crypto oversight", 2),
            (9, "Congress passes strict cryptocurrency regulation bill", 8),
            (18, "Users recover 30% of funds through bankruptcy proceedings", 17),
        ]
    },
    {
        "seed_event": "Pandemic vaccine receives emergency approval for widespread use",
        "seed_date": "2020-12-11",
        "context": "Phase 3 trials show 95% efficacy, first vaccine approved in Western countries",
        "domain": "Social Policy",
        "outcomes": [
            (2, "Healthcare workers begin receiving first doses", 1),
            (6, "Vaccination sites open in all 50 states", 5),
            (12, "50% of population receives at least one dose", 11),
            (24, "Life expectancy shows first increase since pandemic began", 23),
        ]
    },
    {
        "seed_event": "Major company announces full transition to remote work permanently",
        "seed_date": "2021-05-20",
        "context": "5,000 employee tech company, closes 3 offices, cites productivity gains",
        "domain": "Technology",
        "outcomes": [
            (6, "Real estate holdings sold for $450M", 5),
            (12, "Employee retention improves by 30%", 11),
            (18, "100+ companies in same industry follow suit", 17),
            (30, "Urban office vacancy rates reach 25% in major cities", 29),
        ]
    },
    {
        "seed_event": "Trade agreement signed between two major economic powers",
        "seed_date": "2020-01-15",
        "context": "Ends 18-month trade war, reduces tariffs on $200B in goods",
        "domain": "Geopolitics",
        "outcomes": [
            (3, "Stock markets surge 5% on optimism", 2),
            (9, "Agricultural exports increase 40% year-over-year", 8),
            (18, "Supply chain disruptions ease as manufacturing ramps up", 17),
            (36, "Trade balance shows largest improvement in a decade", 35),
        ]
    },
]


def generate_case(template: Dict, case_index: int) -> HistoricalCase:
    """Generate a single historical case from a template"""
    seed_date = datetime.strptime(template["seed_date"], "%Y-%m-%d")

    outcome_chain = []
    prev_date = seed_date

    for months_offset, event, prev_months in template["outcomes"]:
        event_date = seed_date + timedelta(days=months_offset * 30)

        outcome_chain.append({
            "depth": len(outcome_chain) + 1,
            "event": event,
            "date": event_date.strftime("%Y-%m-%d"),
            "timeframe_months": months_offset - prev_months
        })

    return HistoricalCase(
        case_id=f"synthetic_{case_index:03d}",
        seed_event=template["seed_event"],
        seed_date=template["seed_date"],
        context=template["context"],
        domain=template["domain"],
        outcome_chain=[asdict(oc) if isinstance(oc, OutcomeEvent) else oc for oc in outcome_chain]
    )


def generate_synthetic_dataset(
    num_cases: int = 10,
    output_path: str = "training/data/synthetic_cases.jsonl"
) -> List[HistoricalCase]:
    """
    Generate synthetic training dataset

    Args:
        num_cases: Number of cases to generate
        output_path: Where to save the JSONL file

    Returns:
        List of generated cases
    """
    # Use templates, repeating if needed
    cases = []
    for i in range(num_cases):
        template = SYNTHETIC_CASES[i % len(SYNTHETIC_CASES)]
        case = generate_case(template, i)
        cases.append(case)

    # Write to JSONL
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, 'w') as f:
        for case in cases:
            f.write(json.dumps(asdict(case)) + '\n')

    print(f"✅ Generated {num_cases} synthetic cases")
    print(f"📁 Saved to: {output_file}")
    print(f"\nSample case:")
    print(json.dumps(asdict(cases[0]), indent=2))

    return cases


def load_cases(path: str = "training/data/synthetic_cases.jsonl") -> List[Dict]:
    """Load cases from JSONL file"""
    cases = []
    with open(path) as f:
        for line in f:
            cases.append(json.loads(line))
    return cases


if __name__ == "__main__":
    # Generate default dataset
    cases = generate_synthetic_dataset(num_cases=10)

    # Print statistics
    print(f"\n📊 Dataset Statistics:")
    print(f"  Total cases: {len(cases)}")

    domains = {}
    chain_lengths = []
    for case in cases:
        domain = case.domain
        domains[domain] = domains.get(domain, 0) + 1
        chain_lengths.append(len(case.outcome_chain))

    print(f"  Domains: {domains}")
    print(f"  Avg chain length: {sum(chain_lengths) / len(chain_lengths):.1f}")
    print(f"  Min/Max chain length: {min(chain_lengths)}/{max(chain_lengths)}")
