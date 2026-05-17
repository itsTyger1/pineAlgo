import YahooFinance from 'yahoo-finance2';
async function run() {
  const yf = new YahooFinance();
  const res = await yf.screener({ scrIds: 'most_actives', count: 1 }, { validateResult: false });
  console.log(Object.keys(res.quotes[0]));
}
run();
