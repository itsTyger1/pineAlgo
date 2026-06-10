import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
async function run() {
  const res = await yahooFinance.chart('AAPL', { period1: new Date(Date.now() - 5*24*60*60*1000), interval: '60m' as any });
  console.log(res.quotes);
}
run();
