import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DOME_API_KEY = process.env.DOMEAPI_KEY;
const DOME_API_BASE = 'https://api.domeapi.io/v1';
const TARGET_MARKETS = 1000;
const TAGS = ['geopolitics', 'politics', 'world'];

interface Market {
  id: string;
  title: string;
  status: string;
  tags: string[];
  [key: string]: any;
}

async function fetchMarkets(): Promise<Market[]> {
  const allMarkets: Market[] = [];
  let offset = 0;
  const limit = 100; // Fetch 100 at a time
  const delayBetweenRequests = 8000; // 8 seconds to respect rate limits (0.133 req/sec = ~7.5s)
  let retryCount = 0;
  const maxRetries = 5;

  console.log('Starting to fetch markets...');
  console.log(`Filtering by tags: ${TAGS.join(', ')}`);
  console.log('Filtering for closed markets only');
  console.log(`Rate limiting: ${delayBetweenRequests}ms between requests\n`);

  while (allMarkets.length < TARGET_MARKETS) {
    try {
      // Fetch markets with pagination from Polymarket via Dome API
      const url = new URL(`${DOME_API_BASE}/polymarket/markets`);
      url.searchParams.append('limit', limit.toString());
      url.searchParams.append('offset', offset.toString());
      url.searchParams.append('status', 'closed');

      // Add tag filters - Dome API accepts multiple tags
      TAGS.forEach(tag => {
        url.searchParams.append('tags', tag);
      });

      console.log(`Fetching batch ${Math.floor(offset / limit) + 1} (offset: ${offset})...`);

      const response = await fetch(url.toString(), {
        headers: {
          'X-API-Key': DOME_API_KEY || '',
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 429) {
        // Rate limited - parse retry_after from response
        const errorData = await response.json();
        const retryAfter = errorData.retry_after || 20;

        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`⚠️  Rate limited. Waiting ${retryAfter} seconds before retry ${retryCount}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue; // Retry the same request
        } else {
          console.log(`❌ Max retries reached. Saving ${allMarkets.length} markets collected so far.`);
          break;
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText}\n${errorText}`);
      }

      const data = await response.json();
      const markets = data.markets || [];
      const pagination = data.pagination || {};

      if (markets.length === 0) {
        console.log('No more markets available.');
        break;
      }

      // Markets are already filtered by the API, but double-check
      const filteredMarkets = markets.filter((market: Market) => {
        return market.status === 'closed';
      });

      allMarkets.push(...filteredMarkets);
      console.log(`✓ Added ${filteredMarkets.length} markets. Total: ${allMarkets.length}/${TARGET_MARKETS}`);
      console.log(`  API pagination: has_more=${pagination.has_more}, total=${pagination.total}`);

      offset += limit;
      retryCount = 0; // Reset retry count on success

      // Save intermediate progress every 200 markets
      if (allMarkets.length % 200 === 0) {
        await saveMarketsToFile(allMarkets, `intermediate-${allMarkets.length}.json`);
      }

      // Add delay to avoid rate limiting
      if (allMarkets.length < TARGET_MARKETS && pagination.has_more) {
        console.log(`  Waiting ${delayBetweenRequests / 1000}s before next request...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
      }

      // If no more results available according to pagination
      if (!pagination.has_more || markets.length < limit) {
        console.log('Reached end of available markets.');
        break;
      }
    } catch (error) {
      console.error('Error fetching markets:', error);
      throw error;
    }
  }

  return allMarkets.slice(0, TARGET_MARKETS);
}

async function saveMarketsToFile(markets: Market[], filename: string) {
  const outputPath = path.join(__dirname, '..', 'src', 'data', filename);
  const outputDir = path.dirname(outputPath);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(markets, null, 2));
  console.log(`  💾 Saved ${markets.length} markets to ${filename}`);
}

async function main() {
  try {
    console.log('='.repeat(60));
    console.log('Dome API Market Fetcher');
    console.log('='.repeat(60));
    console.log();

    if (!DOME_API_KEY) {
      throw new Error('DOMEAPI_KEY not found in .env file');
    }

    const markets = await fetchMarkets();

    console.log();
    console.log('='.repeat(60));
    console.log(`Successfully fetched ${markets.length} markets`);
    console.log('='.repeat(60));
    console.log();

    // Save final results to JSON file
    await saveMarketsToFile(markets, 'dome-markets.json');

    console.log();
    console.log('Summary:');
    console.log(`- Total markets: ${markets.length}`);
    console.log(`- Tags filtered: ${TAGS.join(', ')}`);
    console.log(`- Status: closed only`);
    console.log(`- File location: src/data/dome-markets.json`);
    console.log();

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
