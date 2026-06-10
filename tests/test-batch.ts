import YahooFinance from 'yahoo-finance2';
import { subDays } from 'date-fns';

const yahooFinance = new YahooFinance();

// Copy necessary helpers and functions from api/index.ts to run them directly in the test environment

class RequestQueue {
  private queue: { fn: () => Promise<any>, resolve: (v: any) => void, reject: (e: any) => void, timeout: number }[] = [];
  private activeCount = 0;
  private maxConcurrency = 15;
  private delayMs = 30;

  async add<T>(fn: () => Promise<T>, timeoutMs = 25000): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject, timeout: timeoutMs });
      this.process();
    });
  }

  private async process() {
    if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) return;

    const item = this.queue.shift();
    if (!item) return;

    this.activeCount++;
    const { fn, resolve, reject, timeout } = item;

    const execute = async () => {
      const timeoutPromise = new Promise((_, r) =>
        setTimeout(() => r(new Error('Yahoo Finance Request Timeout')), timeout)
      );

      try {
        const result = await Promise.race([fn(), timeoutPromise]);
        resolve(result);
      } catch (error: any) {
        reject(error);
      } finally {
        const jitter = Math.random() * 50;
        await new Promise(r => setTimeout(r, this.delayMs + jitter));
        this.activeCount--;
        this.process();
      }
    };

    execute();
  }
}

const yfQueue = new RequestQueue();

function calculateSMA(data: number[], length: number): number | null {
  if (data.length === 0) return null;
  const actualLength = Math.min(data.length, length);
  const slice = data.slice(-actualLength);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / actualLength;
}

function calculateRSI(data: number[], length: number): number | null {
  if (data.length < length + 1) return null;
  let gains = [];
  let losses = [];
  for (let i = 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? Math.abs(diff) : 0);
  }
  let avgGain = gains.slice(0, length).reduce((a, b) => a + b, 0) / length;
  let avgLoss = losses.slice(0, length).reduce((a, b) => a + b, 0) / length;
  for (let i = length; i < gains.length; i++) {
    avgGain = (avgGain * (length - 1) + gains[i]) / length;
    avgLoss = (avgLoss * (length - 1) + losses[i]) / length;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

async function fetchSingleQuoteWithRetry(symbol: string) {
  try {
    return await yfQueue.add(() => yahooFinance.quote(symbol, undefined, { validateResult: false }), 15000);
  } catch (e: any) {
    return null;
  }
}

async function getAnalysis(symbol: string, timeframe: string) {
  const endDate = new Date();
  let startDate: Date;
  let interval = '1d';

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

  const queryOptions = {
    period1: startDate,
    period2: endDate,
    interval: interval as any,
  };

  const quote = await fetchSingleQuoteWithRetry(symbol);

  let chartResult: any;
  try {
    chartResult = await yfQueue.add(() => yahooFinance.chart(symbol, queryOptions, { validateResult: false }), 12000);
  } catch (e) {
    chartResult = { quotes: [] };
  }

  const history = chartResult.quotes || [];
  let prices: number[] = [];
  if (timeframe === '4hr') {
    for (const q of history) {
      if (q.date && typeof q.close === 'number') {
        const d = new Date(q.date);
        const timeStr = d.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
        if (timeStr === '12:30' || timeStr === '15:30') {
          prices.push(q.close);
        }
      }
    }
  } else if (timeframe === '1h') {
    for (const q of history) {
      if (q.date && typeof q.close === 'number') {
        const d = new Date(q.date);
        const timeStr = d.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
        const [hourParts, minuteParts] = timeStr.split(':');
        const h = parseInt(hourParts, 10);
        const m = parseInt(minuteParts, 10);
        const totalMinutes = h * 60 + m;
        if (totalMinutes >= 570 && totalMinutes < 960) {
          prices.push(q.close);
        }
      }
    }
  } else {
    prices = history.map((h: any) => h.close).filter((c: any): c is number => typeof c === 'number');
  }

  // Print debug for the first symbol
  if (symbol === 'AAPL') {
    console.log(`[AAPL DEBUG] Timeframe: ${timeframe}, History: ${history.length}, Prices: ${prices.length}`);
  }

  const maFast = calculateSMA(prices, 50) || 0;
  const maSlow = calculateSMA(prices, 200) || 0;
  const rsi = calculateRSI(prices, 21) || 50;

  return { symbol, timeframe, pricesCount: prices.length, rsi, maFast, maSlow };
}

async function test() {
  const symbols = ['AAPL', 'MSFT', 'AMZN', 'NVDA', 'META'];
  const timeframes = ['1h', '4hr', '1d', '1wk', '1mo'];
  
  for (const tf of timeframes) {
    console.log(`\n--- Starting analysis for timeframe: ${tf} ---`);
    const start = Date.now();
    const promises = symbols.map(sym => getAnalysis(sym, tf));
    const results = await Promise.all(promises);
    console.log(`Completed ${tf} in ${Date.now() - start}ms. Results:`);
    results.forEach(r => {
      console.log(`  ${r.symbol}: Prices=${r.pricesCount}, RSI=${r.rsi.toFixed(2)}, maFast=${r.maFast.toFixed(2)}, maSlow=${r.maSlow.toFixed(2)}`);
    });
  }
}

test().catch(console.error);
