import { subDays, format } from 'date-fns';
async function testFetch() {
  const result = await fetch('http://127.0.0.1:3000/api/analysis/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols: ['AAPL', 'MSFT', 'XOM'], timeframe: '1d' })
  });
  const data = await result.json();
  console.log(JSON.stringify(data, null, 2));
}
testFetch().catch(console.error);
