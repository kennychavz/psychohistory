"""
Shared utilities for data collection agents.
"""

import json
import time
import requests
from typing import Dict, List, Any, Optional
from openai import OpenAI
from config import config


class LLMClient:
    """Client for calling DeepSeek models via OpenRouter"""

    def __init__(self):
        self.client = OpenAI(
            api_key=config.OPENROUTER_API_KEY,
            base_url=config.OPENROUTER_BASE_URL
        )

    def call_research_model(
        self,
        prompt: str,
        system_prompt: str = "You are a helpful research assistant.",
        temperature: float = 0.7,
        max_tokens: int = 4000
    ) -> str:
        """Call DeepSeek V3.1 for research/generation tasks"""
        for attempt in range(config.RETRY_ATTEMPTS):
            try:
                response = self.client.chat.completions.create(
                    model=config.RESEARCH_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=temperature,
                    max_tokens=max_tokens
                )
                return response.choices[0].message.content
            except Exception as e:
                print(f"LLM call failed (attempt {attempt + 1}/{config.RETRY_ATTEMPTS}): {e}")
                if attempt < config.RETRY_ATTEMPTS - 1:
                    time.sleep(config.RETRY_DELAY)
                else:
                    raise

    def call_reasoning_model(
        self,
        prompt: str,
        system_prompt: str = "You are a reasoning assistant that thinks step-by-step.",
        temperature: float = 1.0,
        max_tokens: int = 8000
    ) -> str:
        """Call DeepSeek R1 for reasoning/analysis tasks"""
        for attempt in range(config.RETRY_ATTEMPTS):
            try:
                response = self.client.chat.completions.create(
                    model=config.REASONING_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=temperature,
                    max_tokens=max_tokens
                )
                return response.choices[0].message.content
            except Exception as e:
                print(f"LLM call failed (attempt {attempt + 1}/{config.RETRY_ATTEMPTS}): {e}")
                if attempt < config.RETRY_ATTEMPTS - 1:
                    time.sleep(config.RETRY_DELAY)
                else:
                    raise


class WebSearchClient:
    """Client for web search via Exa API"""

    def __init__(self):
        self.api_key = config.EXA_API_KEY
        self.base_url = "https://api.exa.ai"

    def search(
        self,
        query: str,
        max_results: int = 5,
        use_autoprompt: bool = True,
        include_domains: Optional[List[str]] = None,
        exclude_domains: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Search the web using Exa API

        Args:
            query: Search query
            max_results: Maximum number of results
            use_autoprompt: Let Exa optimize the query
            include_domains: List of domains to include
            exclude_domains: List of domains to exclude

        Returns:
            List of search results with title, url, text, score
        """
        if not self.api_key:
            print("⚠️  EXA_API_KEY not set, returning empty results")
            return []

        payload = {
            "query": query,
            "num_results": max_results,
            "use_autoprompt": use_autoprompt,
            "type": "keyword",  # or "neural" for semantic search
            "contents": {
                "text": True,
                "summary": True
            }
        }

        if include_domains:
            payload["include_domains"] = include_domains
        if exclude_domains:
            payload["exclude_domains"] = exclude_domains

        for attempt in range(config.RETRY_ATTEMPTS):
            try:
                response = requests.post(
                    f"{self.base_url}/search",
                    json=payload,
                    headers={
                        "Content-Type": "application/json",
                        "x-api-key": self.api_key
                    },
                    timeout=30
                )
                response.raise_for_status()
                data = response.json()

                # Convert Exa format to our format
                results = []
                for result in data.get("results", []):
                    results.append({
                        "title": result.get("title", ""),
                        "url": result.get("url", ""),
                        "content": result.get("text", "") or result.get("summary", ""),
                        "score": result.get("score", 0.0)
                    })

                return results
            except Exception as e:
                print(f"Search failed (attempt {attempt + 1}/{config.RETRY_ATTEMPTS}): {e}")
                if attempt < config.RETRY_ATTEMPTS - 1:
                    time.sleep(config.RETRY_DELAY)
                else:
                    return []

    def search_with_date_range(
        self,
        query: str,
        start_date: str,
        end_date: Optional[str] = None,
        max_results: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Search with date constraints (YYYY-MM-DD format)

        Exa uses start_published_date and end_published_date
        """
        if not self.api_key:
            print("⚠️  EXA_API_KEY not set, returning empty results")
            return []

        payload = {
            "query": query,
            "num_results": max_results,
            "use_autoprompt": True,
            "type": "keyword",
            "start_published_date": start_date,
            "contents": {
                "text": True,
                "summary": True
            }
        }

        if end_date:
            payload["end_published_date"] = end_date

        for attempt in range(config.RETRY_ATTEMPTS):
            try:
                response = requests.post(
                    f"{self.base_url}/search",
                    json=payload,
                    headers={
                        "Content-Type": "application/json",
                        "x-api-key": self.api_key
                    },
                    timeout=30
                )
                response.raise_for_status()
                data = response.json()

                # Convert to our format
                results = []
                for result in data.get("results", []):
                    results.append({
                        "title": result.get("title", ""),
                        "url": result.get("url", ""),
                        "content": result.get("text", "") or result.get("summary", ""),
                        "score": result.get("score", 0.0),
                        "published_date": result.get("published_date", "")
                    })

                return results
            except Exception as e:
                print(f"Date search failed (attempt {attempt + 1}/{config.RETRY_ATTEMPTS}): {e}")
                if attempt < config.RETRY_ATTEMPTS - 1:
                    time.sleep(config.RETRY_DELAY)
                else:
                    return []


def parse_json_response(response: str) -> Optional[Dict]:
    """
    Extract JSON from LLM response (handles markdown code blocks)
    """
    response = response.strip()

    # Handle markdown code blocks
    if "```json" in response:
        response = response.split("```json")[1].split("```")[0].strip()
    elif "```" in response:
        response = response.split("```")[1].split("```")[0].strip()

    try:
        return json.loads(response)
    except json.JSONDecodeError as e:
        print(f"⚠️  JSON parsing failed: {e}")
        print(f"Response: {response[:500]}...")
        return None


def save_checkpoint(data: Any, filename: str):
    """Save checkpoint data to JSON file"""
    import os
    filepath = os.path.join(config.CHECKPOINT_DIR, filename)
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"💾 Checkpoint saved: {filepath}")


def load_checkpoint(filename: str) -> Optional[Any]:
    """Load checkpoint data from JSON file"""
    import os
    filepath = os.path.join(config.CHECKPOINT_DIR, filename)
    if not os.path.exists(filepath):
        return None

    with open(filepath, 'r') as f:
        data = json.load(f)
    print(f"📂 Checkpoint loaded: {filepath}")
    return data


# Global clients
llm_client = LLMClient()
search_client = WebSearchClient()
