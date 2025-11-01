# Data Collection Pipeline

Automated pipeline for generating training data from historical events with verified outcome chains.

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Set environment variables (in /.env.local)
OPENROUTER_API_KEY=your_key_here
EXA_API_KEY=your_key_here

# 3. Generate seeds (done)
python run_brainstorm.py

# 4. Find outcome chains (done)
python run_chronicle_parallel.py
```

## Structure

```
data_collection/
├── agents/               # Core data collection agents
│   ├── brainstormer.py          # Generate seed events
│   ├── chronicler.py            # Find outcomes (sequential)
│   ├── chronicler_parallel.py   # Find outcomes (parallel, 10x faster)
│   └── alternative_gen.py       # Generate counterfactuals
├── checkpoints/          # Generated data
│   ├── seeds_final_verified.json  # 91 verified seed events
│   └── cases_chronicled.json      # 29 cases with outcome chains
├── config.py            # Configuration
├── utils.py             # LLM + search clients
└── README.md            # This file
```

## Output

**Training data:** `../data/real_historical_cases.jsonl` (29 cases)

## Results

- **91 verified seeds** (70% post-cutoff, 30% in-distribution)
- **29 chronicled cases** with partial outcome chains (1-2 levels avg)
- **15 post-cutoff cases** for true forecasting evaluation
- **14 in-distribution cases** for calibration training

See `DATA_COLLECTION_SUMMARY.md` for full analysis.
