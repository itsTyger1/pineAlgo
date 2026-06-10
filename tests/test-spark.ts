import YahooFinance from 'yahoo-finance2';
async function run() {
  const yf = new YahooFinance();
  try {
    const q: any = await yf.spark(['AAPL', 'MSFT']);
    console.log(q);
  } catch(e: any) {
    console.error(e.message);
  }
}
run();
