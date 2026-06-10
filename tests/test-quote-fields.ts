import YahooFinance from 'yahoo-finance2';
async function run() {
  const yf = new YahooFinance();
  const q = await yf.quote('AAPL', { return: 'object', fields: ['sector'] as any }, { validateResult: false });
  console.log(q.sector !== undefined ? q.sector : 'No sector');
}
run();
