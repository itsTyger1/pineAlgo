import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import YahooFinance from 'yahoo-finance2';
import { subDays, format } from 'date-fns';

const yahooFinance = new YahooFinance();
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Helper to calculate SMA
function calculateSMA(data: number[], length: number): number | null {
  if (data.length === 0) return null;
  // If we have less data than the requested period, use all available data
  const actualLength = Math.min(data.length, length);
  const slice = data.slice(-actualLength);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / actualLength;
}

// Helper to calculate RSI (Wilder's smoothing)
function calculateRSI(data: number[], length: number): number | null {
  if (data.length < length + 1) return null;

  let gains = [];
  let losses = [];

  for (let i = 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? Math.abs(diff) : 0);
  }

  // Initial average
  let avgGain = gains.slice(0, length).reduce((a, b) => a + b, 0) / length;
  let avgLoss = losses.slice(0, length).reduce((a, b) => a + b, 0) / length;

  // Smoothed averages (Wilder's method used by TradingView ta.rsi)
  for (let i = length; i < gains.length; i++) {
    avgGain = (avgGain * (length - 1) + gains[i]) / length;
    avgLoss = (avgLoss * (length - 1) + losses[i]) / length;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Request Queue to prevent rate limiting with concurrency
class RequestQueue {
  private queue: { fn: () => Promise<any>, resolve: (v: any) => void, reject: (e: any) => void, timeout: number }[] = [];
  private activeCount = 0;
  private maxConcurrency = 3; // Allow a few concurrent requests to avoid massive bottlenecks
  private delayMs = 60; // Slightly more conservative delay

  async add<T>(fn: () => Promise<T>, timeoutMs = 15000): Promise<T> {
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

    // Execute with timeout logic
    const execute = async () => {
      const timeoutPromise = new Promise((_, r) => 
        setTimeout(() => r(new Error('Yahoo Finance Request Timeout')), timeout)
      );

      try {
        const result = await Promise.race([fn(), timeoutPromise]);
        resolve(result);
      } catch (error: any) {
        if (error?.message?.includes('Too Many Requests') || error?.status === 429) {
          console.error("RATE LIMIT DETECTED (429): Backing off...");
          this.delayMs = Math.min(this.delayMs + 100, 1000); // Dynamic backoff
        }
        reject(error);
      } finally {
        await new Promise(r => setTimeout(r, this.delayMs));
        this.activeCount--;
        // Recover delay slowly
        if (this.delayMs > 60) this.delayMs -= 5;
        this.process();
      }
    };

    execute();
  }
}

const yfQueue = new RequestQueue();

interface StockAnalysis {
  symbol: string;
  name: string;
  price: number;
  change: number;
  marketCap: number;
  maFast: number;
  maSlow: number;
  rsi: number;
  zone: string;
  sector: string;
  industry: string;
  lastUpdated: string;
}

// Cache for stock calculations to avoid hitting YF too hard
const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 60 * 60 * 1000; // 60 minutes

const CORE_SYMBOLS = [
  // Tech & AI
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AVGO", "ORCL", "ADBE",
  "PLTR", "AI", "SMCI", "ARM", "TSM", "AMD", "META", "QCOM", "ASML",
  // Energy (Oil & Gas)
  "XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO", "OXY", "HES", "HAL", "DVN",
  // Nuclear & Utilities
  "CCJ", "CEG", "VST", "SMR", "OKLO", "NNE", "BWXT", "LEU",
  // Green Energy
  "FSLR", "ENPH", "NEE", "SEDG"
];

app.get("/api/stocks", async (req, res) => {
  try {
    // Fetch from multiple categories to get a broader list since "most_actives" is often limited
    const [actives, gainers, losers, coreQuotes] = await Promise.all([
      yfQueue.add(() => (yahooFinance as any).screener({ scrIds: "most_actives", count: 100 }, undefined, { validateResult: false })),
      yfQueue.add(() => (yahooFinance as any).screener({ scrIds: "day_gainers", count: 100 }, undefined, { validateResult: false })),
      yfQueue.add(() => (yahooFinance as any).screener({ scrIds: "day_losers", count: 100 }, undefined, { validateResult: false })),
      yfQueue.add(() => yahooFinance.quote(CORE_SYMBOLS, undefined, { validateResult: false }).catch(() => []))
    ]) as any[];

    const allQuotes = [
      ...(actives.quotes || []),
      ...(gainers.quotes || []),
      ...(losers.quotes || []),
      ...(Array.isArray(coreQuotes) ? coreQuotes : [coreQuotes]),
    ];

    // Deduplicate by symbol and map to desired structure
    const uniqueStocksMap = new Map();
    allQuotes.forEach((q: any) => {
      if (q && q.symbol && !uniqueStocksMap.has(q.symbol)) {
        uniqueStocksMap.set(q.symbol, {
          symbol: q.symbol,
          marketCap: q.marketCap || 0,
        });
      }
    });

    // Sort by Market Cap descending and take top 500
    const stockList = Array.from(uniqueStocksMap.values())
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, 500);

    res.json(stockList);
  } catch (error) {
    console.error("Error fetching stocks:", error);
    res.status(500).json({ error: "Failed to fetch top stocks" });
  }
});

app.get("/api/analysis/:symbol", async (req, res) => {
  const { symbol } = req.params;
  const timeframe = (req.query.timeframe as string) || '1d';
  const cacheKey = `${symbol}_${timeframe}`;
  
  if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp) < CACHE_TTL) {
    return res.json(cache[cacheKey].data);
  }

  try {
    const endDate = new Date();
    let startDate: Date;
    let interval: '1d' | '1wk' | '1mo' = '1d';

    switch (timeframe) {
      case '1wk':
        interval = '1wk';
        startDate = subDays(endDate, 1500); // ~214 weeks
        break;
      case '1mo':
        interval = '1mo';
        startDate = subDays(endDate, 7000); // ~233 months (~19 years)
        break;
      case '1d':
      default:
        interval = '1d';
        startDate = subDays(endDate, 400); // ~400 days
        break;
    }

    const queryOptions = {
      period1: startDate,
      period2: endDate,
      interval: interval as any,
    };

    let history: any[] = [];
    let quote: any = {};
    let summary: any = null;

    try {
      const [chartResult, quoteResult, summaryResult] = await Promise.all([
        yfQueue.add(() => yahooFinance.chart(symbol, queryOptions, { validateResult: false }).catch((err) => {
          console.warn(`Chart data fetch failed for ${symbol} (${interval}):`, err.message);
          return { quotes: [] };
        })),
        yfQueue.add(() => yahooFinance.quote(symbol, undefined, { validateResult: false }).catch(() => ({}))),
        yfQueue.add(() => yahooFinance.quoteSummary(symbol, { modules: ['assetProfile'] }, { validateResult: false }).catch(() => null))
      ]) as [any, any, any];

      history = chartResult.quotes || [];
      quote = quoteResult;
      summary = summaryResult;

      // Final fallback if interval fetch failed: try daily chart with smaller range
      if (history.length === 0) {
        console.log(`Retrying ${symbol} with daily chart fallback...`);
        const fallbackOptions = { 
          period1: subDays(endDate, 365),
          interval: '1d' as const
        };
        const fallbackResult = await yfQueue.add(() => yahooFinance.chart(symbol, fallbackOptions, { validateResult: false }).catch(() => ({ quotes: [] }))) as any;
        history = fallbackResult.quotes || [];
      }
    } catch (e: any) {
      console.error(`Unexpected error during data fetch for ${symbol}:`, e.message);
    }

    const assetProfile = summary?.assetProfile || {};
    const prices = history.map((h: any) => h.close).filter((c: any): c is number => typeof c === 'number');

    if (prices.length === 0) {
      console.warn(`No historical data could be found for ${symbol} after multiple attempts.`);
      return res.status(404).json({ error: `No historical data found for ${symbol} on ${timeframe} timeframe.` });
    }

    const maFast = calculateSMA(prices, 50);
    const maSlow = calculateSMA(prices, 200);
    const rsi = calculateRSI(prices, 21);

    const isMacroUptrend = maFast !== null && maSlow !== null && (maFast > maSlow);
    const isMacroDowntrend = maFast !== null && maSlow !== null && (maFast < maSlow);

    let zone = "Neutral";
    if (isMacroUptrend && rsi !== null && rsi >= 50) zone = "Standard Buy";
    else if (isMacroUptrend && rsi !== null && rsi <= 45) zone = "Value Pullback";
    else if (isMacroDowntrend) zone = "Sell Section";

    // Improved fallback for sectors (ETFs, Trusts, etc)
    let sector = assetProfile.sector;
    if (!sector) {
      if (quote.quoteType === 'ETF') sector = 'ETF / Fund';
      else if (quote.quoteType === 'MUTUALFUND') sector = 'Mutual Fund';
      else if (quote.quoteType === 'TRUST') sector = 'Investment Trust';
      else sector = 'Other';
    }

    const data: StockAnalysis = {
      symbol,
      name: quote.longName || quote.shortName || symbol,
      price: quote.regularMarketPrice || 0,
      change: quote.regularMarketChangePercent || 0,
      marketCap: quote.marketCap || 0,
      maFast: maFast || 0,
      maSlow: maSlow || 0,
      rsi: rsi || 0,
      zone,
      sector: sector,
      industry: assetProfile.industry || (quote.quoteType === 'ETF' ? 'Exchange Traded Fund' : 'Other'),
      lastUpdated: new Date().toISOString()
    };

    cache[cacheKey] = { data, timestamp: Date.now() };
    res.json(data);
  } catch (error: any) {
    console.error(`Error analyzing ${symbol}:`, error);
    if (error.subErrors) {
      console.error('Sub-errors:', JSON.stringify(error.subErrors, null, 2));
    }
    res.status(500).json({ error: `Failed to analyze ${symbol}`, details: error.message });
  }
});

// Export the app for Vercel
export default app;

if (process.env.NODE_ENV !== "production") {
  async function startServer() {
    console.log("Starting server initialization...");
    try {
      console.log("Initializing Vite in development mode...");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite middleware mounted.");

      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    } catch (err) {
      console.error("Failed to start server:", err);
    }
  }

  console.log("Calling startServer()...");
  startServer();
} else if (!process.env.VERCEL) {
  // In traditional production (not Vercel), serve static files and listen
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
