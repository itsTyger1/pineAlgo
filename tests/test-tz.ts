import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
async function run() {
  const res = await yahooFinance.chart('AAPL', { period1: new Date(Date.now() - 5*24*60*60*1000), interval: '60m' as any });
  
  for (let q of res.quotes) {
    if (!q.date) continue;
    const d = new Date(q.date);
    const timeStr = d.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
    console.log(q.date, timeStr, q.close);
  }
}
run();
