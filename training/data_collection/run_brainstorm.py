"""
Run full brainstorming: 70 post-cutoff + 30 in-distribution = 100 seeds
"""

import os
import sys
from pathlib import Path

print("🚀 Starting brainstorm script...", flush=True)

# Load .env.local
env_path = Path(__file__).parent.parent.parent / ".env.local"
print(f"Loading environment from {env_path}...", flush=True)
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key] = value
    print(f"✅ Environment loaded", flush=True)
else:
    print(f"❌ .env.local not found!", flush=True)
    sys.exit(1)

# Import and run
print("Importing brainstormer module...", flush=True)
from agents import brainstormer
print("✅ Module imported", flush=True)

if __name__ == "__main__":
    print("\n🚀 STARTING FULL BRAINSTORM: 100 SEEDS")
    print("   70 post-cutoff (Jul 2024 - Jun 2025)")
    print("   30 in-distribution (2019-2022)")
    print("="*80)

    seeds = brainstormer.main()

    print(f"\n✅ Brainstorm complete: {len(seeds)} seeds generated")
    print(f"\nNext step: Run chronicler to find outcome chains")
    print(f"   python training/data_collection/run_chronicle.py")
