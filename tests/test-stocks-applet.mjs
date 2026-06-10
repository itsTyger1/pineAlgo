import http from 'http';
http.get('http://127.0.0.1:3000/api/stocks', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body length:', data.length));
}).on('error', (err) => console.error(err.message));
