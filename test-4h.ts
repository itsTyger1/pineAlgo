import fetch from 'node-fetch';

async function test() {
  const res = await fetch('http://localhost:3000/api/analysis/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols: ['AAPL'], timeframe: '4hr' })
  });
  const data = await res.json();
  console.log("RSI:", data[0]?.rsi);
  console.log("Zone:", data[0]?.zone);
}
test();
