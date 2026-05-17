import YahooFinance from 'yahoo-finance2';
async function run() {
  const yf = new YahooFinance();
  const res = await yf.quoteSummary('AAPL', { modules: ['assetProfile'] });
  console.log(res?.assetProfile?.sector);
}
run();
