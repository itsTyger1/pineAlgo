import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function testPagination() {
  try {
    console.log(`Testing with offset: 0`);
    const result1 = await (yahooFinance as any).screener({ scrIds: 'most_actives', count: 50 }, { validateResult: false });
    console.log(`Fetched ${result1.quotes.length} symbols with offset 0`);
    
    console.log(`Testing with offset: 50`);
    const result2 = await (yahooFinance as any).screener({ scrIds: 'most_actives', count: 50, offset: 50 }, { validateResult: false });
    console.log(`Fetched ${result2.quotes.length} symbols with offset 50`);
    
    console.log(`First symbol offset 0: ${result1.quotes[0].symbol}`);
    console.log(`First symbol offset 50: ${result2.quotes[0].symbol}`);
  } catch (e) {
    console.error(e);
  }
}

testPagination();
