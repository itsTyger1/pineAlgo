import YahooFinance from 'yahoo-finance2';
async function run() {
  const yf = new YahooFinance();
  const syms = Array.from({length: 100}).map((_, i) => 'AAPL');
  const q = await yf.quote(syms);
  console.log('Got', q.length);
}
run();
