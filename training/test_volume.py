"""
Test Modal volume operations
"""

import modal
import json

app = modal.App("test-volume")
image = modal.Image.debian_slim(python_version="3.11")
volume = modal.Volume.from_name("psychohistory-data", create_if_missing=True)


@app.function(
    image=image,
    volumes={"/data": volume},
)
def upload_test_data(data_content: str):
    """Upload synthetic data to volume"""

    # Write to volume
    volume_path = "/data/historical_cases.jsonl"
    with open(volume_path, 'w') as f:
        f.write(data_content)

    # Count lines
    num_lines = len(data_content.strip().split('\n'))

    # Commit changes
    volume.commit()

    print(f"✅ Uploaded {num_lines} cases to {volume_path}")

    return {
        "success": True,
        "num_cases": num_lines,
        "volume_path": volume_path
    }


@app.function(
    image=image,
    volumes={"/data": volume},
)
def list_volume_contents():
    """List files in volume"""
    import os

    contents = []

    if os.path.exists("/data"):
        for item in os.listdir("/data"):
            path = f"/data/{item}"
            if os.path.isfile(path):
                size = os.path.getsize(path)
                contents.append({"name": item, "size": size, "type": "file"})
            else:
                contents.append({"name": item, "type": "dir"})

    return contents


@app.function(
    image=image,
    volumes={"/data": volume},
)
def read_volume_data():
    """Read data from volume to verify"""
    import json

    volume_path = "/data/historical_cases.jsonl"

    try:
        cases = []
        with open(volume_path) as f:
            for line in f:
                cases.append(json.loads(line))

        print(f"✅ Read {len(cases)} cases from volume")
        print(f"\nFirst case:")
        print(json.dumps(cases[0], indent=2))

        return {
            "success": True,
            "num_cases": len(cases),
            "first_case": cases[0]
        }
    except FileNotFoundError:
        print(f"❌ File not found: {volume_path}")
        return {"success": False, "error": "File not found"}


@app.local_entrypoint()
def main():
    print("🧪 Testing Modal Volume Operations\n")

    # Read local data
    local_path = "training/data/historical_cases.jsonl"
    print(f"Reading local file: {local_path}")

    with open(local_path) as f:
        data_content = f.read()

    print(f"✅ Read {len(data_content)} bytes\n")

    # Step 1: Upload data
    print("Step 1: Uploading historical cases data...")
    result = upload_test_data.remote(data_content)
    print(f"Result: {result}\n")

    # Step 2: List contents
    print("Step 2: Listing volume contents...")
    contents = list_volume_contents.remote()
    print("Volume contents:")
    for item in contents:
        print(f"  - {item['name']} ({item.get('size', 'N/A')} bytes)")
    print()

    # Step 3: Read back data
    print("Step 3: Reading data from volume...")
    result = read_volume_data.remote()
    print(f"Success: {result['success']}")
    print(f"Cases: {result.get('num_cases', 0)}\n")

    print("✅ Volume test complete!")
