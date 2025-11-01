"""
Hot-swappable inference layer for probability tree models.

Allows comparing baseline vs SFT vs GRPO models apples-to-apples by swapping
LoRA adapters without reloading the base model.
"""

from typing import Optional, Dict, Any, List
from pathlib import Path
import json


class ProbabilityTreeInference:
    """
    Inference engine with hot-swappable LoRA adapters

    Supports:
    - Baseline (no adapter)
    - SFT adapter (rank 64)
    - GRPO adapter (rank 4)
    """

    def __init__(
        self,
        base_model_name: str = "openai/gpt-oss-20b",
        device: str = "auto",
    ):
        """
        Initialize inference engine

        Args:
            base_model_name: HuggingFace model ID
            device: Device to load model on
        """
        self.base_model_name = base_model_name
        self.device = device
        self.base_model = None
        self.tokenizer = None
        self.current_adapter = None
        self.current_adapter_name = "baseline"

    def _load_base_model(self):
        """Lazy load base model (only once)"""
        if self.base_model is not None:
            return

        print(f"📥 Loading base model: {self.base_model_name}")

        from transformers import AutoModelForCausalLM, AutoTokenizer
        import torch

        self.tokenizer = AutoTokenizer.from_pretrained(self.base_model_name)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        self.base_model = AutoModelForCausalLM.from_pretrained(
            self.base_model_name,
            torch_dtype=torch.bfloat16,
            device_map=self.device,
            trust_remote_code=True,
        )

        print("✅ Base model loaded")

    def load_adapter(self, adapter_path: Optional[str] = None, adapter_name: str = "custom"):
        """
        Load LoRA adapter weights

        Args:
            adapter_path: Path to adapter checkpoint (None for baseline)
            adapter_name: Name for this adapter (for tracking)
        """
        self._load_base_model()

        if adapter_path is None:
            # Baseline: no adapter
            self.current_adapter = None
            self.current_adapter_name = "baseline"
            print("🔄 Switched to baseline (no adapter)")
            return

        print(f"🔄 Loading adapter from {adapter_path}...")

        from peft import PeftModel

        # Load adapter on top of base model
        self.current_adapter = PeftModel.from_pretrained(
            self.base_model,
            adapter_path,
            is_trainable=False,
        )

        self.current_adapter_name = adapter_name
        print(f"✅ Adapter '{adapter_name}' loaded")

    def generate_tree(
        self,
        seed_event: str,
        context: str = "",
        max_depth: int = 3,
        use_baseline: bool = False,
    ) -> Dict[str, Any]:
        """
        Generate probability tree for a seed event

        Args:
            seed_event: The initial event
            context: Additional context
            max_depth: Maximum tree depth
            use_baseline: Force using baseline (ignore current adapter)

        Returns:
            Probability tree structure
        """
        self._load_base_model()

        # Choose model
        if use_baseline:
            model = self.base_model
            model_name = "baseline"
        elif self.current_adapter is not None:
            model = self.current_adapter
            model_name = self.current_adapter_name
        else:
            model = self.base_model
            model_name = "baseline"

        print(f"\n🌲 Generating tree with '{model_name}' model...")

        # Build prompt
        prompt = self._build_prompt(seed_event, context, depth=1)

        # Generate
        outputs = self._generate(model, prompt)

        # Parse into tree structure
        tree = self._parse_to_tree(seed_event, outputs)

        return tree

    def compare_models(
        self,
        seed_event: str,
        context: str = "",
        adapters: List[str] = None,
    ) -> Dict[str, Dict[str, Any]]:
        """
        Generate trees with multiple models for comparison

        Args:
            seed_event: The initial event
            context: Additional context
            adapters: List of adapter paths to compare (None = just baseline)

        Returns:
            Dict mapping model name to generated tree
        """
        results = {}

        # Baseline
        self.load_adapter(None)
        results["baseline"] = self.generate_tree(seed_event, context)

        # Each adapter
        if adapters:
            for i, adapter_path in enumerate(adapters):
                adapter_name = f"adapter_{i}"
                self.load_adapter(adapter_path, adapter_name)
                results[adapter_name] = self.generate_tree(seed_event, context)

        return results

    def _build_prompt(self, seed_event: str, context: str, depth: int) -> str:
        """Build prompt for tree generation"""
        prompt = f"""Given this historical event:

Event: {seed_event}
{f"Context: {context}" if context else ""}

Predict the most likely outcomes over the next 12-24 months. For each outcome, provide:
- event: A specific, concrete event description
- probability: Likelihood (all probabilities should sum to 1.0)
- timeframe_months: Expected time until this event occurs

Output a JSON array of outcomes, ordered by probability (highest first).

Outcomes:"""

        return prompt

    def _generate(self, model, prompt: str, max_new_tokens: int = 512) -> str:
        """Generate completion from model"""
        import torch

        inputs = self.tokenizer(prompt, return_tensors="pt").to(model.device)

        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                temperature=0.7,
                do_sample=True,
                pad_token_id=self.tokenizer.pad_token_id,
            )

        generated_text = self.tokenizer.decode(outputs[0], skip_special_tokens=True)

        # Extract just the completion (after prompt)
        completion = generated_text[len(prompt):]

        return completion

    def _parse_to_tree(self, seed_event: str, generation: str) -> Dict[str, Any]:
        """
        Parse generated JSON into tree structure

        For now, simplified to depth 1 (just immediate outcomes)
        """
        try:
            # Try to extract JSON from generation
            json_str = generation.strip()

            # Handle markdown code blocks
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0].strip()
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0].strip()

            outcomes = json.loads(json_str)

            # Build tree structure
            children = []
            for outcome in outcomes:
                children.append({
                    "event": outcome.get("event", "Unknown event"),
                    "probability": outcome.get("probability", 0.0),
                    "timeframe_months": outcome.get("timeframe_months", 0),
                    "children": [],  # Depth 1 only for now
                })

            tree = {
                "event": seed_event,
                "probability": 1.0,
                "children": children,
            }

            return tree

        except Exception as e:
            print(f"⚠️  Failed to parse generation: {e}")
            print(f"Raw generation:\n{generation}")

            # Fallback: return minimal tree
            return {
                "event": seed_event,
                "probability": 1.0,
                "children": [],
            }


def demo_hot_swap():
    """Demonstrate hot-swapping between models"""
    print("🔥 Hot-Swap Demo")
    print("=" * 60)

    # NOTE: This is a demo - won't actually work without real models
    # But shows the API usage

    inference = ProbabilityTreeInference()

    seed_event = "Major tech company announces 10,000 layoffs"
    context = "Economic downturn, rising interest rates"

    # Generate with baseline
    print("\n1️⃣ Generating with baseline model...")
    inference.load_adapter(None)
    baseline_tree = inference.generate_tree(seed_event, context)

    # Generate with SFT adapter
    print("\n2️⃣ Generating with SFT adapter...")
    inference.load_adapter("/data/models/sft/final", "sft")
    sft_tree = inference.generate_tree(seed_event, context)

    # Generate with GRPO adapter
    print("\n3️⃣ Generating with GRPO adapter...")
    inference.load_adapter("/data/models/grpo/final", "grpo")
    grpo_tree = inference.generate_tree(seed_event, context)

    # Compare all three
    print("\n📊 Comparison:")
    print(f"  Baseline: {len(baseline_tree['children'])} outcomes")
    print(f"  SFT:      {len(sft_tree['children'])} outcomes")
    print(f"  GRPO:     {len(grpo_tree['children'])} outcomes")

    return baseline_tree, sft_tree, grpo_tree


if __name__ == "__main__":
    print("This module provides the ProbabilityTreeInference class.")
    print("Import it to use in your evaluation pipeline.")
    print("\nExample usage:")
    print("""
from inference import ProbabilityTreeInference

# Initialize
inference = ProbabilityTreeInference()

# Load adapter
inference.load_adapter("/path/to/adapter", "my-model")

# Generate tree
tree = inference.generate_tree(
    "Brexit vote passes",
    context="52% leave, 48% remain"
)
    """)
