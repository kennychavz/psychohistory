"""
Modal GRPO (Group Relative Policy Optimization) for Probability Tree Models

This script implements Phase 2 training: multi-objective optimization using RL.
Uses ultra-low rank LoRA (rank 4) as RL needs minimal capacity.
"""

import modal
import json
from pathlib import Path

# Modal app
app = modal.App("psychohistory-grpo")

# Shared volume
volume = modal.Volume.from_name("psychohistory-data", create_if_missing=True)

# GPU image (same as SFT)
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch>=2.0.0",
        "transformers>=4.36.0",
        "peft>=0.7.0",
        "datasets>=2.16.0",
        "accelerate>=0.25.0",
        "bitsandbytes>=0.41.0",
        "wandb>=0.16.0",
        "trl>=0.7.0",
    )
)


@app.function(
    image=image,
    gpu="H100",  # H100 GPU (80GB) for GPT OSS 20B
    timeout=10800,  # 3 hours
    volumes={"/data": volume},
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
def train_grpo(
    sft_checkpoint: str = "/data/models/sft/final",
    data_path: str = "/data/synthetic_cases.jsonl",
    output_dir: str = "/data/models/grpo",
    lora_rank: int = 4,
    learning_rate: float = 5e-4,
    num_epochs: int = 3,
    group_size: int = 4,
):
    """
    Train GRPO model with ultra-low rank LoRA

    Args:
        sft_checkpoint: Path to SFT model checkpoint
        data_path: Path to training data (JSONL)
        output_dir: Where to save checkpoints
        lora_rank: LoRA rank (4 for GRPO per Thinking Machines)
        learning_rate: Learning rate for RL
        num_epochs: Number of training epochs
        group_size: Number of trees to generate per seed (for group comparison)
    """
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import PeftModel, LoraConfig, get_peft_model, TaskType
    import wandb

    print(f"🚀 Starting GRPO training")
    print(f"  SFT Checkpoint: {sft_checkpoint}")
    print(f"  LoRA Rank: {lora_rank}")
    print(f"  Group Size: {group_size}")
    print(f"  Learning Rate: {learning_rate}")

    # Initialize wandb
    try:
        wandb.init(
            project="psychohistory-training",
            name=f"grpo-rank{lora_rank}",
            config={
                "lora_rank": lora_rank,
                "learning_rate": learning_rate,
                "group_size": group_size,
            }
        )
    except:
        print("⚠️  WandB not configured, skipping logging")

    # Load tokenizer
    print("\n📥 Loading tokenizer...")
    # Extract base model name from SFT checkpoint
    base_model_name = "openai/gpt-oss-20b"
    tokenizer = AutoTokenizer.from_pretrained(base_model_name)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # Load SFT model
    print(f"\n📥 Loading SFT checkpoint from {sft_checkpoint}...")
    base_model = AutoModelForCausalLM.from_pretrained(
        base_model_name,
        torch_dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True,
    )

    # Load SFT adapter
    model = PeftModel.from_pretrained(base_model, sft_checkpoint)
    model = model.merge_and_unload()  # Merge SFT adapter into base

    print("✅ SFT model loaded and merged")

    # Add NEW LoRA adapter for GRPO (rank 4)
    print(f"\n🔧 Adding GRPO LoRA adapter (rank {lora_rank})...")
    grpo_lora_config = LoraConfig(
        r=lora_rank,
        lora_alpha=lora_rank * 2,
        target_modules="all-linear",
        lora_dropout=0.0,  # No dropout for RL
        bias="none",
        task_type=TaskType.CAUSAL_LM,
    )

    model = get_peft_model(model, grpo_lora_config)
    model.print_trainable_parameters()

    # Load dataset
    print(f"\n📚 Loading training data from {data_path}...")
    cases = []
    with open(data_path) as f:
        for line in f:
            cases.append(json.loads(line))

    print(f"  Loaded {len(cases)} cases")

    # GRPO Training Loop
    print(f"\n🏋️  Starting GRPO training...")
    print(f"  Strategy: Generate {group_size} trees per seed, rank by composite score\n")

    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate)

    for epoch in range(num_epochs):
        print(f"\n{'='*60}")
        print(f"Epoch {epoch + 1}/{num_epochs}")
        print(f"{'='*60}\n")

        epoch_loss = 0.0

        for i, case in enumerate(cases):
            # Generate group of trees
            trees = []
            for g in range(group_size):
                tree = generate_tree_sample(
                    model,
                    tokenizer,
                    case['seed_event'],
                    case['context']
                )
                trees.append(tree)

            # Score each tree
            scores = []
            for tree in trees:
                score = compute_composite_score(tree, case)
                scores.append(score)

            # GRPO: Compute advantages relative to group mean
            baseline_score = sum(scores) / len(scores)
            advantages = [s - baseline_score for s in scores]

            # Update policy to favor high-advantage trees
            # (Simplified: use cross-entropy weighted by advantage)
            for tree, advantage in zip(trees, advantages):
                if advantage > 0:  # Only learn from above-average trees
                    loss = compute_policy_loss(model, tokenizer, tree, advantage)
                    loss.backward()
                    epoch_loss += loss.item()

            optimizer.step()
            optimizer.zero_grad()

            if (i + 1) % 5 == 0:
                print(f"  Case {i+1}/{len(cases)}: Avg score = {baseline_score:.3f}")

        avg_epoch_loss = epoch_loss / len(cases)
        print(f"\n  Epoch {epoch + 1} Loss: {avg_epoch_loss:.4f}")

        if wandb.run:
            wandb.log({"epoch": epoch + 1, "loss": avg_epoch_loss})

        # Save checkpoint
        checkpoint_dir = f"{output_dir}/epoch-{epoch+1}"
        model.save_pretrained(checkpoint_dir)
        print(f"  💾 Saved checkpoint: {checkpoint_dir}")

    # Save final model
    print(f"\n💾 Saving final model to {output_dir}/final...")
    model.save_pretrained(f"{output_dir}/final")

    # Commit volume
    volume.commit()

    print(f"\n✅ GRPO training complete!")
    print(f"  Final model: {output_dir}/final")

    return {
        "output_dir": f"{output_dir}/final",
        "num_cases": len(cases),
        "num_epochs": num_epochs,
    }


def generate_tree_sample(model, tokenizer, seed_event: str, context: str) -> dict:
    """
    Generate a single tree sample

    Returns simplified tree structure with outcomes
    """
    import torch

    prompt = f"""Given this historical event:

Event: {seed_event}
Context: {context}

Predict the most likely outcomes. Output a JSON array of outcomes with:
- event: Description
- probability: Likelihood (sum to 1.0)

Outcomes:"""

    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=256,
            temperature=0.8,
            do_sample=True,
        )

    generated = tokenizer.decode(outputs[0], skip_special_tokens=True)
    completion = generated[len(prompt):]

    # Parse (simplified)
    try:
        # Extract JSON
        json_str = completion.strip()
        if "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0]
            if json_str.startswith("json"):
                json_str = json_str[4:].strip()

        outcomes = json.loads(json_str)

        return {
            "seed_event": seed_event,
            "outcomes": outcomes
        }
    except:
        # Fallback
        return {
            "seed_event": seed_event,
            "outcomes": []
        }


def compute_composite_score(tree: dict, ground_truth: dict) -> float:
    """
    Compute composite score for a tree

    Combines:
    - Calibration: Did it predict what happened?
    - Sharpness: Confident probabilities?
    - Diversity: Different scenarios?
    """
    import math

    outcomes = tree.get('outcomes', [])
    actual_events = [e['event'] for e in ground_truth['outcome_chain']]

    if not outcomes:
        return 0.0

    # 1. Calibration: Did we predict actual events?
    calibration_score = 0.0
    for actual in actual_events:
        # Simple match: check if any predicted event is similar
        for outcome in outcomes:
            if jaccard_similarity(actual, outcome.get('event', '')) > 0.5:
                prob = outcome.get('probability', 0.0)
                calibration_score += prob

    calibration_score /= max(len(actual_events), 1)

    # 2. Sharpness: Entropy (lower is sharper)
    probs = [o.get('probability', 0.0) for o in outcomes]
    probs = [p for p in probs if p > 0]

    if probs:
        entropy = -sum(p * math.log(p + 1e-10) for p in probs)
        sharpness_score = 1.0 / (1.0 + entropy)
    else:
        sharpness_score = 0.0

    # 3. Diversity: Number of distinct outcomes
    diversity_score = min(len(outcomes) / 4.0, 1.0)  # Normalize to max 4

    # Composite (weights from pipeline doc)
    score = (
        0.4 * calibration_score +
        0.3 * sharpness_score +
        0.3 * diversity_score
    )

    return score


def jaccard_similarity(text1: str, text2: str) -> float:
    """Jaccard similarity between two strings"""
    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())

    if not words1 or not words2:
        return 0.0

    intersection = words1.intersection(words2)
    union = words1.union(words2)

    return len(intersection) / len(union)


def compute_policy_loss(model, tokenizer, tree: dict, advantage: float):
    """
    Compute policy gradient loss weighted by advantage

    Simplified: treat as supervised learning weighted by advantage
    """
    import torch

    # Build training example from tree
    prompt = f"Event: {tree['seed_event']}\n\nOutcomes:"
    completion = json.dumps(tree['outcomes'])

    full_text = prompt + "\n" + completion

    inputs = tokenizer(full_text, return_tensors="pt").to(model.device)

    # Forward pass
    outputs = model(**inputs, labels=inputs['input_ids'])

    # Weight loss by advantage
    loss = outputs.loss * abs(advantage)

    return loss


@app.local_entrypoint()
def main(
    sft_checkpoint: str = "/data/models/sft/final",
    lora_rank: int = 4,
):
    """
    Main entry point for GRPO training

    Usage:
        modal run training/modal_grpo.py
        modal run training/modal_grpo.py --sft-checkpoint=/custom/path
    """
    print("🎯 PsychoHistory GRPO Training Pipeline")
    print("=" * 60)
    print(f"  SFT Checkpoint: {sft_checkpoint}")
    print(f"  LoRA Rank: {lora_rank}")

    result = train_grpo.remote(
        sft_checkpoint=sft_checkpoint,
        lora_rank=lora_rank,
    )

    print(f"\n{'='*60}")
    print(f"✅ GRPO Training Complete!")
    print(f"  Output: {result['output_dir']}")
    print(f"  Cases: {result['num_cases']}")
    print(f"  Epochs: {result['num_epochs']}")
    print(f"{'='*60}")
