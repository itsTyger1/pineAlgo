import YahooFinance from 'yahoo-finance2';
async function run() {
  const yf = new YahooFinance();
  try {
    const q = await yf.quote('GOOG');
    console.log('GOOG regularMarketChangePercent:', q.regularMarketChangePercent);
    console.log('GOOG regularMarketChange:', q.regularMarketChange);
    console.log('GOOG full:', JSON.stringify(q, null, 2));
  } catch (e) {
    console.error(e);
  }
}
run();
