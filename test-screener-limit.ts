import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function testLimit() {
  const counts = [400, 300, 250];
  for (const count of counts) {
    try {
      console.log(`Testing count: ${count}`);
      const result = await (yahooFinance as any).screener({ scrIds: 'most_actives', count }, { validateResult: false });
      console.log(`Success with count ${count}: fetched ${result.quotes.length} symbols`);
      break; 
    } catch (e) {
      console.log(`Failed with count ${count}: ${e.message}`);
    }
  }
}

testLimit();
