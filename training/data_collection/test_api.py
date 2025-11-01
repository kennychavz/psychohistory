"""Quick test of OpenRouter API"""

import os
from pathlib import Path

# Load env
env_path = Path(__file__).parent.parent.parent / ".env.local"
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ[key] = value

from openai import OpenAI

api_key = os.getenv("OPENROUTER_API_KEY")
print(f"API Key found: {api_key[:20]}...")

client = OpenAI(
    api_key=api_key,
    base_url="https://openrouter.ai/api/v1"
)

print("\nTesting DeepSeek V3.1 call...")
response = client.chat.completions.create(
    model="deepseek/deepseek-chat",
    messages=[{"role": "user", "content": "Say 'hello' and nothing else."}],
    max_tokens=10
)

print(f"Response: {response.choices[0].message.content}")
print("\n✅ API working!")
