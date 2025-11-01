# Data Collection Checkpoints

## Files

### `seeds_final_verified.json` (119 KB)
**91 verified seed events** ready for chronicling
- 69 post-cutoff (Jul 2024 - Jun 2025)
- 22 in-distribution (2019-2022)
- All fact-checked with 98.1% verification rate

### `cases_chronicled.json` (39 KB)
**29 cases with documented outcome chains**
- 33 total outcome levels
- Average 1.1 levels per case
- 15 post-cutoff, 14 in-distribution
- Exported to `training/data/real_historical_cases.jsonl`

## Stats

**Generation:** 100 → 91 verified seeds → 29 chronicled cases
**Success Rate:** 32% (limited by search result availability)
**Depth:** Mostly 1-2 levels (target was 3)

## Usage

These checkpoints allow resuming data collection:
- Brainstormer: Reads/writes seeds files
- Chronicler: Reads seeds, writes cases
- Alternative Gen: Reads cases, adds counterfactuals
