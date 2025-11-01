"""
Test script for brainstormer - generates just 5 seeds to verify everything works
"""

import os
import sys

# Load .env.local
from pathlib import Path
env_path = Path(__file__).parent.parent.parent / ".env.local"
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key] = value
    print(f"✅ Loaded environment from {env_path}")

# Now import config (will read env vars)
from config import config

# Override to generate only 5 seeds for testing
config.NUM_SEEDS_POST_CUTOFF = 3
config.NUM_SEEDS_IN_DISTRIBUTION = 2

from agents import brainstormer

if __name__ == "__main__":
    print("🧪 TESTING BRAINSTORMER (5 seeds)")
    print("="*80)

    seeds = brainstormer.main()

    print(f"\n📋 Generated Seeds:")
    for i, seed in enumerate(seeds):
        cutoff_marker = "🔮" if seed.get("post_cutoff") else "📚"
        print(f"\n{i+1}. {cutoff_marker} [{seed['domain']}] {seed['event'][:70]}...")
        print(f"   Date: {seed['date']}")
        print(f"   Post-cutoff: {seed.get('post_cutoff', False)}")

    print(f"\n✅ Test complete!")
