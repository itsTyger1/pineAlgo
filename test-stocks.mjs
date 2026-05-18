import http from 'http';
http.get('http://127.0.0.1:3000/api/stocks', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const stocks = JSON.parse(data);
    console.log('Status:', res.statusCode, 'Stock count:', stocks.length);
  });
}).on('error', (err) => console.error(err.message));
