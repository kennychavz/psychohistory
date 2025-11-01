"""Test the new candidate-based training format"""
import json

# Load one case
with open('training/data/historical_cases.jsonl') as f:
    case = json.loads(f.readline())

print("=" * 70)
print("TRAINING EXAMPLE (what model will see)")
print("=" * 70)

# Simulate format_example function
level = case['levels'][0]

prompt = f"""Event: {case['seed']['event']}
Date: {case['seed']['date']}
Context: {case['seed']['context']}
Depth: {level['depth']}
Timeframe: next {level['timeframe_months']} months

Research summary:
{level['research_summary']}

Candidate outcomes:
"""

for i, cand in enumerate(level['candidates']):
    prompt += f"{i+1}. {cand['event']}\n"

prompt += "\nAssign probability to each candidate (must sum to 1.0). Return JSON:"

# Target distribution
prob_map = {}
for cand in level['candidates']:
    prob_map[cand['event']] = 1.0 if cand['label'] == 1 else 0.0

completion = json.dumps(prob_map, indent=2)

full_text = prompt + "\n" + completion

print(full_text)
print()
print("=" * 70)

# Count labels
positives = sum(1 for c in level['candidates'] if c['label'] == 1)
negatives = sum(1 for c in level['candidates'] if c['label'] == 0)
print(f"Candidates: {len(level['candidates'])} (✓ {positives}, ✗ {negatives})")
print("=" * 70)
