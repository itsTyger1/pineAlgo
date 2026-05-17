import YahooFinance from 'yahoo-finance2';
async function run() {
  const yf = new YahooFinance();
  const q = await yf.quote('AAPL');
  console.log(JSON.stringify({ 
    symbol: q.symbol, 
    price: q.regularMarketPrice,
    ma50: q.fiftyDayAverage,
    ma200: q.twoHundredDayAverage,
    change: q.regularMarketChangePercent
  }, null, 2));
}
run();
