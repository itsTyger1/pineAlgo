import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function run() {
  try {
    const quote = await yahooFinance.quote("WDS", {}, { validateResult: false });
    console.log("WDS Quote fields:");
    console.log(JSON.stringify(quote, null, 2));
  } catch (e: any) {
    console.error(e);
  }
}
run();
