import YahooFinance from 'yahoo-finance2';
async function run() {
  const yf = new YahooFinance();
  const q = await yf.quote('AAPL');
  console.log('Quote data:', JSON.stringify(q, null, 2));
}
run();
