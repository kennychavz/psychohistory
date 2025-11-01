"""
Run Parallel Chronicler: 10 concurrent seeds with rate limiting
"""

import os
import sys
from pathlib import Path

print("🚀 Starting parallel chronicler...", flush=True)

# Load .env.local
env_path = Path(__file__).parent.parent.parent / ".env.local"
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key] = value
    print(f"✅ Environment loaded", flush=True)

# Load verified seeds
from config import config
import json

with open(config.CHECKPOINT_DIR + '/seeds_final_verified.json') as f:
    verified_seeds = json.load(f)

# Save as seeds_final.json
with open(config.CHECKPOINT_DIR + '/seeds_final.json', 'w') as f:
    json.dump(verified_seeds, f, indent=2)

print(f"✅ Loaded {len(verified_seeds)} verified seeds", flush=True)

# Import and run
from agents import chronicler_parallel

if __name__ == "__main__":
    print("\n🚀 PARALLEL CHRONICLER")
    print(f"   {len(verified_seeds)} seeds")
    print(f"   10 concurrent workers")
    print(f"   ~600 requests/min (within Exa limits)")
    print("="*80, flush=True)

    cases = chronicler_parallel.main()

    print(f"\n✅ Chronicle complete: {len(cases)} cases")
