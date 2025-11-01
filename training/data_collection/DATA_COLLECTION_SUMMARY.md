# Data Collection Summary

**Date:** October 31, 2025
**Status:** Phase 1 Complete (Seed Generation & Chronicling)

---

## Results

### Seeds Generated
- **Total:** 91 verified "resolved questions"
- **Post-cutoff (Jul 2024+):** 69 seeds (76%)
- **In-distribution (2019-2022):** 22 seeds (24%)

### Cases Chronicled
- **Total:** 29 cases with outcome chains
- **Success rate:** 32% (29/91)
- **Depth distribution:**
  - 1 level: 25 cases (86%)
  - 2 levels: 4 cases (14%)
  - 3 levels: 0 cases (0%)

### Key Files

**Final Outputs:**
- `checkpoints/seeds_final_verified.json` - 91 verified seed events
- `checkpoints/cases_chronicled.json` - 29 cases with partial outcome chains
- `checkpoints/seeds_clean.json` - 51 fact-checked seeds (98.1% verified)
- `checkpoints/seeds_additional.json` - 40 supplemental post-cutoff seeds

**Documentation:**
- `checkpoints/VERIFICATION_REPORT.md` - Fact-checking methodology
- `checkpoints/README_VERIFICATION.md` - Complete verification guide
- `checkpoints/FACT_CHECK_SUMMARY.md` - Executive summary

---

## Issues Encountered

### 1. Incomplete Chains
- Most cases (86%) only found 1 outcome level
- Exa searches not finding enough results for multi-level chains
- Date windows (+/- 2 weeks) may be too narrow

### 2. Search Result Quality
- Some irrelevant matches (e.g., "Qatar team in Kabul" for FTX search)
- DeepSeek R1 sometimes extracting wrong events from search results
- Need better search query construction

### 3. Low Success Rate
- Only 32% of seeds produced usable cases
- Many failed at first depth (no search results)
- Suggests need for better seed selection or search strategy

---

## Data Quality

### Good Examples (2-level chains)

**COVID-19 First Case → Remdesivir Trial**
- Seed: "First U.S. COVID-19 case confirmed" (2020-01-20)
- Level 1: Clinical trial for remdesivir starts
- Level 2: NIH announces preliminary trial results

**Hong Kong Security Law → Sanctions Escalation**
- Seed: "Hong Kong national security law enacted" (2020-06-30)
- Level 1: U.S. Treasury imposes sanctions
- Level 2: China retaliates with sanctions on U.S. citizens

---

## Next Steps

### Immediate
1. ✅ Clean up intermediate files
2. ⏳ Generate alternatives for 29 cases
3. ⏳ Export to training JSONL format

### Improvements Needed
1. **Better search strategy:** Wider date windows, better queries
2. **More seeds:** Need 50-100 cases, currently have 29
3. **Deeper chains:** Target 3 levels, currently getting 1-2
4. **Alternative sources:** Supplement Exa with other search APIs

### Long-term
1. Manual curation of high-quality cases
2. Focus on major historical events with known multi-level chains
3. Consider using Wikipedia timelines for outcome chains
4. Add human verification step

---

## Files Created

### Core Pipeline
```
training/data_collection/
├── config.py                      # Configuration
├── utils.py                       # LLM + search clients
├── requirements.txt               # Dependencies
├── agents/
│   ├── brainstormer.py           # Seed generation
│   ├── chronicler.py             # Sequential outcome finding
│   ├── chronicler_parallel.py    # Parallel outcome finding
│   └── alternative_gen.py        # Counterfactual generation
├── run_brainstorm.py             # Brainstorm runner
├── run_chronicle.py              # Chronicle runner
├── run_chronicle_parallel.py     # Parallel chronicle runner
└── checkpoints/                  # Intermediate/final data
    ├── seeds_final_verified.json # 91 verified seeds
    ├── cases_chronicled.json     # 29 chronicled cases
    └── [verification reports]
```

---

## Metrics

**API Usage:**
- DeepSeek calls: ~150 (seed generation + chronicling)
- Exa searches: ~273 attempts
- Success rate: 32%

**Time:**
- Brainstorming: ~10 minutes (100 seeds)
- Verification: ~5 minutes (52 seeds)
- Chronicling: ~8 minutes (91 seeds, parallel)
- **Total:** ~23 minutes

---

## Recommendation

**Current dataset (29 cases) is too small and shallow** for training.

**Options:**
A) **Manual curation** - Pick 20-30 major events, manually document outcome chains
B) **Improve search** - Use Wikipedia + news archives instead of just Exa
C) **Accept shallow chains** - Train on 1-2 level predictions instead of 3
D) **Combination** - Start with these 29, manually enrich to 50+ cases

Given time constraints and quality issues, **Option D** (manual enrichment) recommended.
