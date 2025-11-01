"""
Monitor Modal training job progress

Polls Modal logs and volume to track training progress.
Use this to check on long-running training jobs without keeping terminal open.
"""

import time
import subprocess
import sys
from datetime import datetime


def get_modal_apps():
    """Get list of running Modal apps"""
    try:
        result = subprocess.run(
            ["modal", "app", "list"],
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.stdout
    except Exception as e:
        print(f"Error getting apps: {e}")
        return ""


def get_modal_logs(app_name: str = "psychohistory-sft", tail_lines: int = 20):
    """Get recent logs from Modal app"""
    try:
        result = subprocess.run(
            ["modal", "app", "logs", app_name, "--tail", str(tail_lines)],
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.stdout
    except subprocess.TimeoutExpired:
        return "⚠️  Timeout getting logs"
    except Exception as e:
        return f"⚠️  Error: {e}"


def check_volume_contents():
    """Check Modal volume for training artifacts"""
    try:
        result = subprocess.run(
            ["modal", "volume", "ls", "psychohistory-data", "/data/models/sft"],
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.stdout
    except:
        return "No models yet"


def parse_training_progress(logs: str) -> dict:
    """Extract training metrics from logs"""
    metrics = {
        "epoch": None,
        "loss": None,
        "step": None,
        "status": "Unknown"
    }

    lines = logs.split('\n')
    for line in reversed(lines):  # Start from most recent
        if "Starting Unsloth training" in line:
            metrics["status"] = "Training started"
        elif "Loading model" in line:
            metrics["status"] = "Loading model"
        elif "epoch" in line.lower() and "loss" in line.lower():
            # Try to parse training output
            try:
                if "epoch" in line.lower():
                    parts = line.split()
                    for i, part in enumerate(parts):
                        if "epoch" in part.lower() and i + 1 < len(parts):
                            metrics["epoch"] = parts[i + 1].strip(':,')
                        if "loss" in part.lower() and i + 1 < len(parts):
                            metrics["loss"] = parts[i + 1].strip(':,')
            except:
                pass
        elif "Training complete" in line or "✅" in line:
            metrics["status"] = "Completed"
        elif "Error" in line or "Failed" in line or "❌" in line:
            metrics["status"] = "Failed"

    return metrics


def monitor_training(
    app_name: str = "psychohistory-sft",
    check_interval: int = 30,
    max_duration: int = 7200  # 2 hours max
):
    """
    Monitor training progress with periodic updates

    Args:
        app_name: Modal app name
        check_interval: Seconds between checks
        max_duration: Max time to monitor (seconds)
    """
    print("=" * 70)
    print("🔍 PsychoHistory Training Monitor")
    print("=" * 70)
    print(f"\nMonitoring app: {app_name}")
    print(f"Check interval: {check_interval}s")
    print(f"Max duration: {max_duration}s ({max_duration/60:.0f} minutes)")
    print("\nPress Ctrl+C to stop monitoring (training will continue)\n")

    start_time = time.time()
    iteration = 0
    last_status = None

    try:
        while True:
            elapsed = time.time() - start_time

            if elapsed > max_duration:
                print("\n⏰ Max monitoring duration reached")
                break

            iteration += 1
            now = datetime.now().strftime("%H:%M:%S")

            print(f"\n{'─' * 70}")
            print(f"📊 Check #{iteration} at {now} (elapsed: {elapsed/60:.1f}m)")
            print(f"{'─' * 70}")

            # Get logs
            print("\n📝 Recent logs:")
            logs = get_modal_logs(app_name, tail_lines=15)

            # Show last few lines
            log_lines = logs.split('\n')
            for line in log_lines[-10:]:
                if line.strip():
                    print(f"  {line}")

            # Parse status
            metrics = parse_training_progress(logs)

            print(f"\n📈 Status: {metrics['status']}")
            if metrics['epoch']:
                print(f"  Epoch: {metrics['epoch']}")
            if metrics['loss']:
                print(f"  Loss: {metrics['loss']}")

            # Check if completed or failed
            if metrics['status'] == "Completed":
                print("\n✅ Training completed successfully!")

                print("\n📦 Checking for saved models...")
                volume_contents = check_volume_contents()
                print(volume_contents)
                break

            elif metrics['status'] == "Failed":
                print("\n❌ Training failed!")
                print("\nFull logs:")
                print(get_modal_logs(app_name, tail_lines=50))
                break

            # Status change notification
            if metrics['status'] != last_status and last_status is not None:
                print(f"\n🔔 Status changed: {last_status} → {metrics['status']}")
            last_status = metrics['status']

            # Wait before next check
            if elapsed + check_interval < max_duration:
                print(f"\n⏸️  Sleeping {check_interval}s until next check...")
                time.sleep(check_interval)
            else:
                break

    except KeyboardInterrupt:
        print("\n\n⚠️  Monitoring stopped by user")
        print("ℹ️  Training is still running on Modal")
        print(f"ℹ️  Check logs: modal app logs {app_name}")

    finally:
        total_time = time.time() - start_time
        print(f"\n{'=' * 70}")
        print(f"Total monitoring time: {total_time/60:.1f} minutes")
        print(f"{'=' * 70}\n")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Monitor Modal training job")
    parser.add_argument(
        "--app",
        default="psychohistory-sft",
        help="Modal app name (default: psychohistory-sft)"
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=30,
        help="Check interval in seconds (default: 30)"
    )
    parser.add_argument(
        "--max-duration",
        type=int,
        default=7200,
        help="Max monitoring duration in seconds (default: 7200 = 2 hours)"
    )

    args = parser.parse_args()

    monitor_training(
        app_name=args.app,
        check_interval=args.interval,
        max_duration=args.max_duration
    )
