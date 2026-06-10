import YahooFinance from 'yahoo-finance2';
import { subDays } from 'date-fns';

const yahooFinance = new YahooFinance();

async function run() {
  const timeframes = ['1h', '4hr', '1d', '1wk', '1mo'];
  const symbol = 'AAPL';
  for (const timeframe of timeframes) {
    const endDate = new Date();
    let startDate: Date;
    let interval: string = '1d';

    switch (timeframe) {
      case '1h':
        interval = '60m';
        startDate = subDays(endDate, 150);
        break;
      case '4hr':
        interval = '60m';
        startDate = subDays(endDate, 360);
        break;
      case '1wk':
        interval = '1wk';
        startDate = subDays(endDate, 3000);
        break;
      case '1mo':
        interval = '1mo';
        startDate = subDays(endDate, 12000);
        break;
      case '1d':
      default:
        interval = '1d';
        startDate = subDays(endDate, 360);
        break;
    }

    try {
      const chartResult = await yahooFinance.chart(symbol, {
        period1: startDate,
        period2: endDate,
        interval: interval as any
      });
      console.log(`Timeframe: ${timeframe}, Interval: ${interval}, Quotes count: ${chartResult?.quotes?.length}`);
    } catch (e: any) {
      console.error(`Timeframe: ${timeframe}, Error: ${e.message}`);
    }
  }
}
run();
