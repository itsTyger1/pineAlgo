import YahooFinance from 'yahoo-finance2';
async function run() {
  const yf = new YahooFinance();
  const symbols = Array.from({length: 50}).map((_, i) => 'AAPL');
  
  const start = Date.now();
  await Promise.all(symbols.map(s => yf.quoteSummary(s, { modules: ['assetProfile'] }).catch(() => null)));
  console.log(`Took ${Date.now() - start}ms`);
}
run();
