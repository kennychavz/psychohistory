# Mock Data Mode

This project includes a mock data mode to allow testing the tree visualization and UI without making expensive API calls to LLM and search services.

## Enabling Mock Mode

**For Development/Testing:**
1. Open `.env` file
2. Set `USE_MOCK_DATA=true`
3. Restart your dev server (`npm run dev`)

You should see `🧪 Mock Data Mode: ENABLED` in the console when the app starts.

## Disabling Mock Mode (Production)

**When you're ready to use real data:**
1. Open `.env` file
2. Set `USE_MOCK_DATA=false` (or remove the line entirely)
3. Restart your dev server

You should see `🧪 Mock Data Mode: DISABLED` in the console.

## What Gets Mocked?

When mock mode is enabled:
- ✅ LLM API calls are replaced with pre-generated responses
- ✅ Search/research results use placeholder data
- ✅ Processing delays are simulated (faster than real API calls)
- ✅ Probability trees are still generated with realistic structure
- ✅ All UI features work normally

When mock mode is disabled:
- 🚀 Real DeepSeek V3.1 API calls for research
- 🚀 Real DeepSeek R1 API calls for probability analysis
- 🚀 Real Exa search results
- 💰 Uses API credits

## File Structure

- `src/lib/mock/mock-data-generator.ts` - Mock data generation logic
- `.env` - Configuration file (USE_MOCK_DATA flag)
- All production code remains intact and unchanged

## Benefits

- **Save Money**: Test UI/UX without burning API credits
- **Faster Development**: Mock responses are instant
- **Offline Development**: Work without internet connection
- **Easy Toggle**: Single environment variable to switch modes
- **No Code Changes**: Production code is untouched
