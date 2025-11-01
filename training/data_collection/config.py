"""
Configuration for data collection pipeline.
"""

import os
from dataclasses import dataclass
from typing import List

@dataclass
class Config:
    """Configuration for data collection agents"""

    # API Keys
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    EXA_API_KEY: str = os.getenv("EXA_API_KEY", "")

    # Model Settings (via OpenRouter)
    RESEARCH_MODEL: str = "deepseek/deepseek-chat"  # DeepSeek V3.1
    REASONING_MODEL: str = "deepseek/deepseek-reasoner"  # DeepSeek R1
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"

    # GPT-OSS Training Data Cutoff
    MODEL_KNOWLEDGE_CUTOFF: str = "2024-06-30"  # GPT-OSS-20B cutoff

    # Data Collection Settings - POST-CUTOFF EMPHASIS
    NUM_SEEDS_POST_CUTOFF: int = 70  # 70% post-cutoff (Jul 2024 - Jun 2025)
    POST_CUTOFF_START: str = "2024-07-01"  # After model cutoff
    POST_CUTOFF_END: str = "2025-06-30"    # Seeds that allow 4-month chains by Oct 2025

    NUM_SEEDS_IN_DISTRIBUTION: int = 30  # 30% in-dist (2019-2022) for calibration
    IN_DIST_START_YEAR: int = 2019
    IN_DIST_END_YEAR: int = 2022

    # Event Categories
    DOMAINS: List[str] = None

    # Tree Structure
    MAX_DEPTH: int = 3  # 3 levels deep (matches SFT training depth)
    ALTERNATIVES_PER_DEPTH: int = 3  # 3 counterfactuals per level

    # Output (use absolute paths to avoid doubling)
    OUTPUT_PATH: str = None
    CHECKPOINT_DIR: str = None

    # Rate Limiting
    REQUESTS_PER_MINUTE: int = 60
    RETRY_ATTEMPTS: int = 3
    RETRY_DELAY: int = 2  # seconds

    def __post_init__(self):
        if self.DOMAINS is None:
            self.DOMAINS = [
                "Politics",
                "Economics",
                "Technology",
                "Geopolitics",
                "Business"
            ]

        # Set absolute paths
        from pathlib import Path
        project_root = Path(__file__).parent.parent.parent
        if self.OUTPUT_PATH is None:
            self.OUTPUT_PATH = str(project_root / "training/data/real_historical_cases.jsonl")
        if self.CHECKPOINT_DIR is None:
            self.CHECKPOINT_DIR = str(project_root / "training/data_collection/checkpoints")

        # Validation
        if not self.OPENROUTER_API_KEY:
            raise ValueError("OPENROUTER_API_KEY environment variable not set")
        if not self.EXA_API_KEY:
            print("⚠️  EXA_API_KEY not set - web search will be limited")

        # Create directories
        os.makedirs(os.path.dirname(self.OUTPUT_PATH), exist_ok=True)
        os.makedirs(self.CHECKPOINT_DIR, exist_ok=True)


# Global config instance
config = Config()
