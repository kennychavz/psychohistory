"""
Test the SFT training format to verify it matches inference
"""

import json

# Load one example
with open('training/training/data/historical_cases.jsonl') as f:
    case = json.loads(f.readline())

print("="*80)
print("CASE ID:", case['case_id'])
print("="*80)

# Format like modal_sft.py does
for level in case['levels']:
    path_str = ' → '.join(level['path']) if level.get('path') else case['seed']['event']

    prompt = f"""Initial Event: {case['seed']['event']}
Path so far: {path_str}
Current Event: {level['parent_event']}
Depth: {level['depth']}/3
Timeframe: next {level['timeframe_months']} months

Research:
{level['research_summary']}

Predict 1-5 possible next events following from the current situation.

Requirements:
- Probabilities sum to 1.0
- Specific, measurable outcomes
- Base predictions on research evidence

Output JSON only:
[{{"event": "...", "probability": 0.3}}]
"""

    # Build target
    target = []
    num_alternatives = sum(1 for c in level['candidates'] if c['label'] == 0)
    alt_prob = 0.3 / num_alternatives if num_alternatives > 0 else 0.0

    for cand in level['candidates']:
        target.append({
            "event": cand['event'],
            "probability": 0.7 if cand['label'] == 1 else alt_prob
        })

    completion = json.dumps(target, indent=2)

    print(f"\n{'='*80}")
    print(f"DEPTH {level['depth']} TRAINING EXAMPLE:")
    print(f"{'='*80}")
    print("\nPROMPT:")
    print(prompt)
    print("\nTARGET:")
    print(completion)

    # Verify probabilities sum to 1.0
    total_prob = sum(item['probability'] for item in target)
    print(f"\nProbability sum: {total_prob:.3f} (should be ~1.0)")
    print(f"Actual event: {[c['event'] for c in level['candidates'] if c['label'] == 1][0]}")
    print(f"Alternatives: {[c['event'] for c in level['candidates'] if c['label'] == 0]}")
