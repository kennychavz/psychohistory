"""
Run Chronicler on verified seeds to find 3-depth outcome chains
"""

import os
import sys
from pathlib import Path

print("🚀 Starting chronicler script...", flush=True)

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

# Update seed source
from config import config
import json

# Load the merged verified seeds
print("Loading verified seeds...", flush=True)
with open(config.CHECKPOINT_DIR + '/seeds_final_verified.json') as f:
    verified_seeds = json.load(f)

# Save as seeds_final.json so chronicler can find them
with open(config.CHECKPOINT_DIR + '/seeds_final.json', 'w') as f:
    json.dump(verified_seeds, f, indent=2)

print(f"✅ Loaded {len(verified_seeds)} verified seeds", flush=True)

# Import and run
print("Importing chronicler module...", flush=True)
from agents import chronicler
print("✅ Module imported", flush=True)

if __name__ == "__main__":
    print("\n🚀 STARTING CHRONICLER: Finding 3-depth outcome chains")
    print(f"   {len(verified_seeds)} verified seeds")
    print(f"   ~{len(verified_seeds) * 3} web searches expected")
    print(f"   Estimated time: 1-2 hours")
    print("="*80, flush=True)

    cases = chronicler.main()

    print(f"\n✅ Chronicle complete: {len(cases)} cases with outcome chains")
    print(f"\nNext step: Run alternative generator")
    print(f"   python training/data_collection/run_alternatives.py")
