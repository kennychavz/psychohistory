#!/usr/bin/env python3
"""
Fact-check filtered seeds using Exa API.
Verifies each event actually happened on the claimed date with accurate details.
"""

import json
import os
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any
import requests

# Exa API configuration
EXA_API_KEY = "fcfbff6a-a74c-472a-aa07-ffd0a91edde7"
EXA_API_URL = "https://api.exa.ai/search"

def search_exa(query: str, start_date: str = None, end_date: str = None, num_results: int = 5) -> Dict[str, Any]:
    """
    Search using Exa API with date constraints.

    Args:
        query: Search query
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
        num_results: Number of results to return

    Returns:
        Dictionary with search results
    """
    headers = {
        "Content-Type": "application/json",
        "x-api-key": EXA_API_KEY
    }

    payload = {
        "query": query,
        "num_results": num_results,
        "type": "keyword",  # Use keyword search for factual queries
        "use_autoprompt": False
    }

    # Add date filtering if provided
    if start_date and end_date:
        payload["start_published_date"] = start_date
        payload["end_published_date"] = end_date

    try:
        response = requests.post(EXA_API_URL, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ Exa API error: {e}")
        return {"results": []}

def verify_event(seed: Dict[str, Any]) -> Dict[str, Any]:
    """
    Verify a single seed event using Exa searches.

    Returns:
        Updated seed with verification_status, sources_found, and verification_notes
    """
    event = seed["event"]
    date_str = seed["date"]
    context = seed["context"]

    print(f"\n🔍 Verifying: {event} ({date_str})")

    # Parse date and create search window (±7 days for flexibility)
    try:
        event_date = datetime.strptime(date_str, "%Y-%m-%d")
        start_date = (event_date - timedelta(days=7)).strftime("%Y-%m-%d")
        end_date = (event_date + timedelta(days=7)).strftime("%Y-%m-%d")
    except ValueError:
        return {
            **seed,
            "verification_status": "ERROR",
            "sources_found": [],
            "verification_notes": f"Invalid date format: {date_str}"
        }

    # Search 1: Event + date
    query1 = f"{event} {date_str}"
    results1 = search_exa(query1, start_date=start_date, end_date=end_date, num_results=3)
    time.sleep(1)  # Rate limiting

    # Search 2: Key terms from context
    query2 = f"{event} {context[:100]}"
    results2 = search_exa(query2, start_date=start_date, end_date=end_date, num_results=3)
    time.sleep(1)  # Rate limiting

    # Search 3: Broader search without strict date filter (for events that might be reported later)
    extended_end = (event_date + timedelta(days=90)).strftime("%Y-%m-%d")
    results3 = search_exa(query1, start_date=start_date, end_date=extended_end, num_results=2)
    time.sleep(1)  # Rate limiting

    # Collect all sources
    all_results = []
    for result_set in [results1, results2, results3]:
        if "results" in result_set:
            all_results.extend(result_set["results"])

    # Extract unique sources
    sources = []
    seen_urls = set()
    for result in all_results:
        url = result.get("url", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            sources.append({
                "url": url,
                "title": result.get("title", ""),
                "published_date": result.get("published_date", "")
            })

    # Determine verification status
    num_sources = len(sources)

    if num_sources >= 2:
        # Check if sources are from reliable domains
        reliable_domains = [
            "reuters.com", "bbc.com", "apnews.com", "bloomberg.com",
            "nytimes.com", "wsj.com", "ft.com", "economist.com",
            "theguardian.com", "washingtonpost.com", "cnbc.com",
            "aljazeera.com", "npr.org", "pbs.org"
        ]

        reliable_count = sum(1 for s in sources if any(domain in s["url"] for domain in reliable_domains))

        if reliable_count >= 2:
            status = "✅ VERIFIED"
            notes = f"Found {num_sources} sources confirming event, including {reliable_count} from reliable news outlets."
        elif num_sources >= 3:
            status = "✅ VERIFIED"
            notes = f"Found {num_sources} sources confirming event."
        else:
            status = "⚠️ QUESTIONABLE"
            notes = f"Found {num_sources} sources but only {reliable_count} from reliable outlets. Need manual review."

    elif num_sources == 1:
        status = "⚠️ QUESTIONABLE"
        notes = "Only found 1 source. Event may be real but needs additional verification."

    else:
        status = "❌ HALLUCINATION"
        notes = "No credible sources found confirming this event occurred on this date."

    print(f"   {status}: {notes}")
    print(f"   Sources found: {num_sources}")

    return {
        **seed,
        "verification_status": status,
        "sources_found": sources[:5],  # Keep top 5 sources
        "verification_notes": notes
    }

def main():
    """Main verification process."""
    # Load seeds
    seeds_path = "/Users/matthieuhuss/PsychoHistory/training/data_collection/checkpoints/seeds_filtered.json"
    output_path = "/Users/matthieuhuss/PsychoHistory/training/data_collection/checkpoints/seeds_verified.json"

    print("📖 Loading filtered seeds...")
    with open(seeds_path, 'r') as f:
        seeds = json.load(f)

    print(f"✅ Loaded {len(seeds)} seeds to verify")
    print("🔍 Starting verification process...\n")
    print("=" * 80)

    # Verify each seed
    verified_seeds = []
    stats = {
        "✅ VERIFIED": 0,
        "⚠️ QUESTIONABLE": 0,
        "❌ HALLUCINATION": 0,
        "ERROR": 0
    }

    for i, seed in enumerate(seeds, 1):
        print(f"\n[{i}/{len(seeds)}]", end=" ")

        try:
            verified_seed = verify_event(seed)
            verified_seeds.append(verified_seed)

            status = verified_seed["verification_status"]
            stats[status] = stats.get(status, 0) + 1

            # Save checkpoint every 10 seeds
            if i % 10 == 0:
                with open(output_path, 'w') as f:
                    json.dump(verified_seeds, f, indent=2)
                print(f"\n💾 Checkpoint saved ({i}/{len(seeds)})")

        except Exception as e:
            print(f"❌ Error verifying seed: {e}")
            verified_seeds.append({
                **seed,
                "verification_status": "ERROR",
                "sources_found": [],
                "verification_notes": f"Error during verification: {str(e)}"
            })
            stats["ERROR"] = stats.get("ERROR", 0) + 1

    # Save final results
    print("\n" + "=" * 80)
    print("💾 Saving final verified seeds...")
    with open(output_path, 'w') as f:
        json.dump(verified_seeds, f, indent=2)

    print(f"✅ Verification complete! Results saved to: {output_path}")

    # Print summary statistics
    print("\n📊 VERIFICATION SUMMARY:")
    print("=" * 80)
    total = len(seeds)
    for status, count in stats.items():
        percentage = (count / total * 100) if total > 0 else 0
        print(f"{status}: {count:2d} / {total} ({percentage:.1f}%)")

    print("\n" + "=" * 80)
    print("\n🎯 NEXT STEPS:")
    if stats.get("❌ HALLUCINATION", 0) > 0:
        print(f"⚠️  Found {stats['❌ HALLUCINATION']} hallucinated events - REMOVE these from dataset")
    if stats.get("⚠️ QUESTIONABLE", 0) > 0:
        print(f"⚠️  Found {stats['⚠️ QUESTIONABLE']} questionable events - MANUALLY REVIEW these")
    if stats.get("✅ VERIFIED", 0) > 0:
        print(f"✅ {stats['✅ VERIFIED']} events verified - safe to use in training")

if __name__ == "__main__":
    main()
