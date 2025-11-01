import * as fs from 'fs';
import * as path from 'path';

interface RawMarket {
  market_slug: string;
  title: string;
  condition_id: string;
  start_time: number;
  end_time: number;
  completed_time: number;
  close_time: number;
  tags: string[];
  volume_total: number;
  resolution_source: string;
  side_a: {
    id: string;
    label: string;
  };
  side_b: {
    id: string;
    label: string;
  };
  winning_side?: {
    id: string;
    label: string;
  };
  status: string;
}

interface EnrichedMarket {
  event: string;
  outcome: string;
  market_slug: string;
  completed_date: string;
  tags: string[];
  volume_total: number;
  side_a_label: string;
  side_b_label: string;
  winning_side_label: string | null;
  resolution_source: string;
}

function timestampToDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().split('T')[0];
}

function enrichMarketData(rawMarkets: RawMarket[]): EnrichedMarket[] {
  return rawMarkets.map((market) => {
    return {
      event: market.title,
      outcome: market.winning_side?.label || 'Unknown',
      market_slug: market.market_slug,
      completed_date: timestampToDate(market.completed_time),
      tags: market.tags,
      volume_total: market.volume_total,
      side_a_label: market.side_a.label,
      side_b_label: market.side_b.label,
      winning_side_label: market.winning_side?.label || null,
      resolution_source: market.resolution_source,
    };
  });
}

async function main() {
  try {
    console.log('='.repeat(60));
    console.log('Market Outcome Enrichment Script');
    console.log('='.repeat(60));
    console.log();

    // Read raw market data
    const inputPath = path.join(__dirname, '..', 'src', 'data', 'dome-markets.json');
    console.log(`Reading raw market data from: ${inputPath}`);

    const rawData = fs.readFileSync(inputPath, 'utf-8');
    const rawMarkets: RawMarket[] = JSON.parse(rawData);

    console.log(`Total markets loaded: ${rawMarkets.length}`);
    console.log();

    // Analyze the data
    const marketsWithOutcome = rawMarkets.filter(m => m.winning_side);
    const marketsWithoutOutcome = rawMarkets.filter(m => !m.winning_side);

    console.log('Data Analysis:');
    console.log(`  Markets with outcome: ${marketsWithOutcome.length}`);
    console.log(`  Markets without outcome: ${marketsWithoutOutcome.length}`);
    console.log();

    // Sample outcome distribution
    const outcomeCounts: Record<string, number> = {};
    marketsWithOutcome.forEach(m => {
      const outcome = m.winning_side!.label;
      outcomeCounts[outcome] = (outcomeCounts[outcome] || 0) + 1;
    });

    console.log('Outcome Distribution:');
    Object.entries(outcomeCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([outcome, count]) => {
        console.log(`  ${outcome}: ${count} (${((count / marketsWithOutcome.length) * 100).toFixed(1)}%)`);
      });
    console.log();

    // Enrich the data
    console.log('Enriching market data...');
    const enrichedMarkets = enrichMarketData(rawMarkets);

    // Save enriched data
    const outputPath = path.join(__dirname, '..', 'src', 'data', 'enriched-market-outcomes.json');
    fs.writeFileSync(outputPath, JSON.stringify(enrichedMarkets, null, 2));
    console.log(`✓ Enriched data saved to: ${outputPath}`);
    console.log();

    // Create a simple event-outcome mapping
    const simpleOutcomes = enrichedMarkets.map(m => ({
      event: m.event,
      outcome: m.outcome,
      completed_date: m.completed_date,
    }));

    const simpleOutputPath = path.join(__dirname, '..', 'src', 'data', 'simple-event-outcomes.json');
    fs.writeFileSync(simpleOutputPath, JSON.stringify(simpleOutcomes, null, 2));
    console.log(`✓ Simple event-outcome mapping saved to: ${simpleOutputPath}`);
    console.log();

    // Display sample results
    console.log('Sample Results (first 5):');
    console.log('='.repeat(60));
    enrichedMarkets.slice(0, 5).forEach((market, idx) => {
      console.log(`${idx + 1}. Event: ${market.event}`);
      console.log(`   Outcome: ${market.outcome}`);
      console.log(`   Date: ${market.completed_date}`);
      console.log();
    });

    console.log('='.repeat(60));
    console.log('Summary:');
    console.log(`- Total markets enriched: ${enrichedMarkets.length}`);
    console.log(`- Markets with outcomes: ${marketsWithOutcome.length}`);
    console.log(`- Files created:`);
    console.log(`  1. enriched-market-outcomes.json (full data)`);
    console.log(`  2. simple-event-outcomes.json (event + outcome only)`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
