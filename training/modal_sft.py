"""
Modal SFT (Supervised Fine-Tuning) for Probability Tree Models

This script implements Phase 1 training: learning to predict events that actually happened.
Uses LoRA rank 64 for sufficient learning capacity.
"""

import modal
import json
from pathlib import Path

# Modal app
app = modal.App("psychohistory-sft")

# Shared volume for data and models
volume = modal.Volume.from_name("psychohistory-data", create_if_missing=True)

# GPU image with all dependencies
# Install torch 2.8.0 first (has torch.int1 for torchao), then latest Unsloth (supports gpt-oss-20b)
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git")  # Needed for git-based pip installs
    .pip_install(
        # Install torch 2.8+ first (has torch.int1 support for torchao)
        "torch>=2.8.0",
        "triton>=3.4.0",
        "torchvision",
        # Pin compatible versions for latest Unsloth
        "transformers>=4.51.3,<=4.57.2",  # Unsloth's supported range
        "trl==0.23.1",  # Latest Unsloth needs newer trl (but <=0.23.1)
        "peft>=0.7.1",
        "accelerate>=1.9.0",
        "datasets>=3.6.0",
        "bitsandbytes>=0.43.0",
        "xformers>=0.0.27",
        "wandb>=0.16.0",
    )
    .run_commands(
        # Install latest Unsloth from git (supports gpt-oss-20b, works with torch 2.8+)
        "pip install --no-cache-dir --upgrade 'unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git'",
        "pip install --no-cache-dir --upgrade 'git+https://github.com/unslothai/unsloth-zoo.git'",
    )
)


@app.function(
    image=image,
    gpu="A10G",  # A10G GPU (24GB) - Unsloth only needs 14GB!
    timeout=7200,  # 2 hours
    volumes={"/data": volume},
    secrets=[modal.Secret.from_name("huggingface-secret")],
    mounts=[modal.Mount.from_local_dir("training/data", remote_path="/training_data")],
)
def train_sft_impl(
    model_name: str = "unsloth/gpt-oss-20b",  # ✅ Use Unsloth's optimized variant!
    data_path: str = "/training_data/real_historical_cases.jsonl",  # Mounted from local
    output_dir: str = "/data/models/sft",
    lora_rank: int = 64,
    learning_rate: float = 3e-4,
    num_epochs: int = 3,
    batch_size: int = 1,
):
    """
    Train SFT model with LoRA rank 64

    Args:
        model_name: Base model to fine-tune
        data_path: Path to training data (JSONL)
        output_dir: Where to save checkpoints
        lora_rank: LoRA rank (64 for SFT)
        learning_rate: Learning rate (10x higher than full FT)
        num_epochs: Number of training epochs
        batch_size: Batch size per GPU
    """
    import os
    import torch
    from unsloth import FastLanguageModel
    from datasets import Dataset
    import wandb

    # Handle HuggingFace token (Modal uses HF_TOKEN)
    hf_token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    if hf_token:
        os.environ["HUGGING_FACE_HUB_TOKEN"] = hf_token
        os.environ["HF_TOKEN"] = hf_token
        print("✅ HuggingFace token configured")
    else:
        print("⚠️  No HuggingFace token found")

    print(f"🚀 Starting SFT training with Unsloth")
    print(f"  Model: {model_name}")
    print(f"  LoRA Rank: {lora_rank}")
    print(f"  Learning Rate: {learning_rate}")
    print(f"  Data: {data_path}")

    # Initialize wandb (optional)
    try:
        import os
        if os.environ.get("WANDB_API_KEY"):
            wandb.init(
                project="psychohistory-training",
                name=f"sft-unsloth-rank{lora_rank}",
                config={
                    "model": model_name,
                    "lora_rank": lora_rank,
                    "learning_rate": learning_rate,
                    "epochs": num_epochs,
                }
            )
        else:
            # Disable wandb if no API key
            os.environ["WANDB_MODE"] = "disabled"
            print("⚠️  WandB API key not found, logging disabled")
    except Exception as e:
        print(f"⚠️  WandB init failed: {e}, continuing without logging")

    # Load model with Unsloth (memory efficient!)
    print("\n📥 Loading model with Unsloth (4-bit quantized)...")
    print(f"  Model: {model_name}")
    print(f"  Expected VRAM: ~14GB (vs 76GB+ with openai/gpt-oss-20b)")

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=model_name,  # Use the parameter (defaults to unsloth/gpt-oss-20b)
        max_seq_length=2048,
        dtype=None,  # Auto-detect
        load_in_4bit=True,  # QLoRA: 14GB VRAM
        full_finetuning=False,
    )

    # Add LoRA adapters with Unsloth
    print(f"\n🔧 Adding LoRA adapters (rank {lora_rank})...")
    model = FastLanguageModel.get_peft_model(
        model,
        r=lora_rank,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                        "gate_proj", "up_proj", "down_proj"],
        lora_alpha=16,  # Unsloth recommends 16 for GPT-OSS
        lora_dropout=0,  # 0 for inference, small value for training
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=3407,
        use_rslora=False,
        loftq_config=None,
    )

    # Load and prepare dataset
    print(f"\n📚 Loading training data from {data_path}...")
    cases = []
    with open(data_path) as f:
        for line in f:
            cases.append(json.loads(line))

    print(f"  Loaded {len(cases)} cases")

    # Format training examples
    def format_example(case):
        """
        Format case to match inference prompt structure.

        Model learns to generate events with calibrated probabilities.
        Uses soft labels: actual event gets 0.7, alternatives split remaining 0.3.
        """
        training_texts = []

        for level in case['levels']:
            # Build prompt matching inference format (src/lib/llm/prompt-templates.ts)
            path_str = ' → '.join(level['path']) if level.get('path') else case['seed']['event']

            prompt = f"""Initial Event: {case['seed']['event']}
Path so far: {path_str}
Current Event: {level['parent_event']}
Depth: {level['depth']}/3
Timeframe: next {level['timeframe_months']} months

Research:
{level['research_summary']}

Predict 1-5 possible next events following from the current situation.

Requirements:
- Probabilities sum to 1.0
- Specific, measurable outcomes
- Base predictions on research evidence

Output JSON only:
[{{"event": "...", "probability": 0.3}}]
"""

            # Build target: array format with soft labels
            target = []
            num_alternatives = sum(1 for c in level['candidates'] if c['label'] == 0)
            alt_prob = 0.3 / num_alternatives if num_alternatives > 0 else 0.0

            for cand in level['candidates']:
                target.append({
                    "event": cand['event'],
                    "probability": 0.7 if cand['label'] == 1 else alt_prob
                })

            completion = json.dumps(target)

            # Concatenate
            full_text = prompt + "\n" + completion + tokenizer.eos_token
            training_texts.append(full_text)

        # Join all depth levels for this case
        return {"text": "\n\n".join(training_texts)}

    formatted_data = [format_example(case) for case in cases]

    # Create HuggingFace dataset
    dataset = Dataset.from_list(formatted_data)

    print(f"\n📝 Sample training example:")
    print(dataset[0]['text'][:500] + "...")

    # Training configuration
    from trl import SFTTrainer, SFTConfig

    # Unsloth SFT Trainer with SFTConfig
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=2048,
        args=SFTConfig(
            per_device_train_batch_size=batch_size,
            gradient_accumulation_steps=16,  # Effective batch = batch_size * 16
            warmup_steps=5,
            num_train_epochs=num_epochs,
            learning_rate=learning_rate,
            logging_steps=1,
            optim="adamw_8bit",
            weight_decay=0.01,
            lr_scheduler_type="linear",
            seed=3407,
            output_dir=output_dir,
            fp16=not torch.cuda.is_bf16_supported(),
            bf16=torch.cuda.is_bf16_supported(),
        ),
    )

    # Train with Unsloth
    print(f"\n🏋️ Starting Unsloth training for {num_epochs} epochs...")
    print(f"  Memory usage should be ~14GB (vs 76GB+ with standard training)")
    trainer.train()

    # Save final model
    print(f"\n💾 Saving model to {output_dir}/final...")
    model.save_pretrained(f"{output_dir}/final")
    tokenizer.save_pretrained(f"{output_dir}/final")

    # Commit volume
    volume.commit()

    print(f"\n✅ SFT training complete!")
    print(f"  Model saved to: {output_dir}/final")

    return {
        "output_dir": f"{output_dir}/final",
        "num_cases": len(cases),
        "num_epochs": num_epochs,
    }


@app.function(
    image=image,
    volumes={"/data": volume},
)
def prepare_data(local_data_path: str = "training/data/historical_cases.jsonl"):
    """
    Upload local training data to Modal volume

    Args:
        local_data_path: Path to local JSONL file
    """
    import shutil

    # Read local file
    with open(local_data_path) as f:
        data = f.read()

    # Write to volume
    volume_path = "/data/synthetic_cases.jsonl"
    with open(volume_path, 'w') as f:
        f.write(data)

    volume.commit()

    print(f"✅ Uploaded {local_data_path} to {volume_path}")

    return volume_path


def train_sft(*args, **kwargs):
    """Wrapper function for backward compatibility"""
    return train_sft_impl.remote(*args, **kwargs)


@app.local_entrypoint()
def main(
    upload_data: bool = False,  # Data already uploaded via test_volume
    run_training: bool = True,
    lora_rank: int = 64,
    num_epochs: int = 1,  # Default to 1 for quick testing
):
    """
    Main entry point for SFT training

    Usage:
        modal run training/modal_sft.py
        modal run training/modal_sft.py --lora-rank=32
        modal run training/modal_sft.py --num-epochs=3
    """
    print("🎯 PsychoHistory SFT Training Pipeline")
    print("=" * 60)

    # Step 1: Upload data (optional, already done via test_volume)
    if upload_data:
        print("\n📤 Uploading training data...")
        prepare_data.remote()

    # Step 2: Train
    if run_training:
        print(f"\n🏋️  Starting SFT training...")
        print(f"  LoRA Rank: {lora_rank}")
        print(f"  Epochs: {num_epochs}")

        result = train_sft_impl.remote(
            lora_rank=lora_rank,
            num_epochs=num_epochs
        )

        print(f"\n{'='*60}")
        print(f"✅ Training Complete!")
        print(f"  Output: {result['output_dir']}")
        print(f"  Cases: {result['num_cases']}")
        print(f"  Epochs: {result['num_epochs']}")
        print(f"{'='*60}")
