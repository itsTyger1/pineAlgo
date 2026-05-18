import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
async function run() {
  try {
    const res1h = await yahooFinance.chart('AAPL', { period1: new Date(Date.now() - 300*24*60*60*1000), interval: '1h' as any });
    console.log("1h works, items:", res1h?.quotes?.length);
  } catch(e: any) { console.error("1h error:", e.message); }
}
run();
