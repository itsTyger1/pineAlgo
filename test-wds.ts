import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function run() {
  try {
    const quote = await yahooFinance.quote("WDS");
    console.log("WDS Quote fields:");
    console.log(`  symbol: ${quote.symbol}`);
    console.log(`  marketCap: ${quote.marketCap}`);
    console.log(`  exchange: ${quote.exchange}`);
    console.log(`  regularMarketPrice: ${quote.regularMarketPrice}`);
  } catch (e: any) {
    console.error(e);
  }
}
run();
