import YahooFinance from 'yahoo-finance2';
async function run() {
  const yf = new YahooFinance();
  const start = Date.now();
  const res = await Promise.all(['AAPL', 'MSFT', 'GOOG', 'NVDA', 'AMZN'].map(s => yf.chart(s, { period1: new Date('2024-03-01') })));
  console.log(`Took ${Date.now() - start}ms for 5 charts`);
}
run();
