import express from "express";
import path from "path";
import cors from "cors";
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
  private maxConcurrency = 8; // Reduced concurrency for better stability
  private delayMs = 60; // Slightly higher base delay

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
          this.delayMs = Math.min(this.delayMs + 300, 2000); // More aggressive backoff
          this.maxConcurrency = Math.max(1, this.maxConcurrency - 2); // Reduce concurrency more significantly
        }
        reject(error);
      } finally {
        const jitter = Math.random() * 50;
        await new Promise(r => setTimeout(r, this.delayMs + jitter));
        this.activeCount--;
        // Recover stability slowly
        if (this.delayMs > 50) this.delayMs -= 1; // Slower recovery
        if (this.maxConcurrency < 12 && Math.random() > 0.95) this.maxConcurrency++; // More rare concurrency increase
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

// Cache for basic stock info to avoid redundant calls
const quoteCache: Record<string, { data: any, timestamp: number }> = {};
const summaryCache: Record<string, { data: any, timestamp: number }> = {};
const META_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const SUMMARY_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for sectors/profiles

// Cache for screener output
let cachedStockList: any[] = [];
let lastStockListCacheTime = 0;
const STOCK_LIST_TTL = 15 * 60 * 1000; // 15 mins

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", vercel: process.env.VERCEL });
});

app.get("/api/stocks", async (req, res) => {
  if (cachedStockList.length > 0 && Date.now() - lastStockListCacheTime < STOCK_LIST_TTL) {
    return res.json(cachedStockList);
  }

  // Define a fallback function for timeouts
  const fallbackResponse = () => {
    const fallbackList = CORE_SYMBOLS.map(symbol => ({
      symbol,
      marketCap: 1000000000,
      name: symbol
    }));
    cachedStockList = fallbackList;
    lastStockListCacheTime = Date.now();
    return res.json(fallbackList);
  };

  try {
    const fetchStocksTask = async () => {
      // Fetch from multiple categories to get a broader list targeting top market caps
      const screeners = [
        "most_actives", 
        "undervalued_large_caps", 
        "growth_technology_stocks",
        "undervalued_growth_stocks",
        "day_gainers",
        "most_shorted_stocks"
      ];

      const results = await Promise.allSettled(
        screeners.map(id => yfQueue.add(() => (yahooFinance as any).screener({ scrIds: id, count: 250 }, undefined, { validateResult: false }).catch(() => ({ quotes: [] }))))
      );


      const allQuotes: any[] = [];
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value && (r.value as any).quotes) {
          allQuotes.push(...(r.value as any).quotes);
        }
      });
      
      // Try for core quotes too
      /*
      try {
        const coreQuotes = await fetchQuoteWithRetry(CORE_SYMBOLS);
        if (Array.isArray(coreQuotes)) {
          allQuotes.push(...coreQuotes);
        }
      } catch (e) {
        console.warn("Core quotes fetch failed");
      }
      */

      if (allQuotes.length === 0) {
        // One last desperate attempt: just use CORE_SYMBOLS as symbols if all screeners failed
        return CORE_SYMBOLS.map(symbol => ({
          symbol,
          marketCap: 0,
          name: symbol
        }));
      }

      // Deduplicate by symbol and populate quote cache
      const uniqueStocksMap = new Map();
      allQuotes.forEach((q: any) => {
        if (q && q.symbol && !uniqueStocksMap.has(q.symbol)) {
          uniqueStocksMap.set(q.symbol, {
            symbol: q.symbol,
            marketCap: q.marketCap || 0,
            name: q.longName || q.shortName || q.symbol
          });
          // Seed the quote cache to save a per-symbol request later
          quoteCache[q.symbol] = { data: q, timestamp: Date.now() };
        }
      });

      // Sort by Market Cap descending and take top 500
      const stockList = Array.from(uniqueStocksMap.values())
        .sort((a, b) => b.marketCap - a.marketCap)
        .slice(0, 500);

      cachedStockList = stockList;
      lastStockListCacheTime = Date.now();
      return stockList;
    };

    // Vercel serverless has 10s limit, we time out after 25 seconds to allow for more data fetching
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 25000));
    const stockList = await Promise.race([fetchStocksTask(), timeoutPromise]);
    
    return res.json(stockList);

  } catch (error) {
    console.error("Error fetching stocks:", error);
    return fallbackResponse();
  }
});

// Helper for quote fetching with retry and chunking for reliability
async function fetchQuoteWithRetry(symbols: string | string[]) {
  if (typeof symbols === 'string') {
    return fetchSingleQuoteWithRetry(symbols);
  }

  // Chunk for reliability but not too small to avoid overhead
  const CHUNK_SIZE = 15;
  const chunks = [];
  for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
    chunks.push(symbols.slice(i, i + CHUNK_SIZE));
  }

  const allResults: any[] = [];
  for (const chunk of chunks) {
    let results = await fetchSingleQuoteWithRetry(chunk);
    
    // Fallback: If a small batch fails, try individual requests for each symbol in that batch
    if (!results && chunk.length > 1) {
      console.warn(`Batch failed for subset of ${chunk.length} symbols, falling back to individual requests`);
      const individualPromises = chunk.map(sym => fetchSingleQuoteWithRetry(sym));
      const individualResults = await Promise.all(individualPromises);
      results = individualResults.filter(r => r !== null);
    }

    if (Array.isArray(results)) {
      allResults.push(...results);
    } else if (results) {
      allResults.push(results);
    }
    // Delay between chunks to avoid overwhelming the API
    await new Promise(r => setTimeout(r, 200));
  }
  return allResults;
}

async function fetchSingleQuoteWithRetry(symbols: string | string[]) {
  let retryCount = 0;
  const maxRetries = 7; // Increased retries for higher reliability
  while (retryCount <= maxRetries) {
    try {
      // Increased timeout to allow for network variability
      const q = await yfQueue.add(() => yahooFinance.quote(symbols as any, undefined, { validateResult: false }), 20000); // Increased timeout
      if (q) return q;
      throw new Error("Empty quote response");
    } catch (e: any) {
      retryCount++;
      if (retryCount > maxRetries) {
        if (typeof symbols === 'string') {
          console.warn(`Quote fetch finally failed for ${symbols} after ${maxRetries} retries`);
        } else {
          console.warn(`Batch quote fetch finally failed for subset of ${symbols.length} symbols`);
        }
        return null;
      }
      // Exponential backoff with jitter - slightly more aggressive initial pause
      const backoff = Math.pow(2, retryCount) * 800; // Increased backoff
      const jitter = Math.random() * 500;
      await new Promise(r => setTimeout(r, backoff + jitter));
    }
  }
  return null;
}

async function getAnalysis(symbol: string, timeframe: string) {
  const cacheKey = `${symbol}_${timeframe}`;
  if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp) < CACHE_TTL) {
    return cache[cacheKey].data;
  }

  const endDate = new Date();
  let startDate: Date;
  let interval: '1d' | '1wk' | '1mo' = '1d';

  switch (timeframe) {
    case '1wk':
      interval = '1wk';
      startDate = subDays(endDate, 1500);
      break;
    case '1mo':
      interval = '1mo';
      startDate = subDays(endDate, 7000);
      break;
    case '1d':
    default:
      interval = '1d';
      // Huge optimization: only fetch 45 days for RSI calculation instead of 400!
      // We will use the yahoo quote MAs for timeframe 1d.
      startDate = subDays(endDate, 45);
      break;
  }

  const queryOptions = {
    period1: startDate,
    period2: endDate,
    interval: interval as any,
  };

  let quote: any = null;
  if (quoteCache[symbol] && (Date.now() - quoteCache[symbol].timestamp) < META_CACHE_TTL) {
    quote = quoteCache[symbol].data;
  }

  if (!quote) {
    const q = await fetchQuoteWithRetry(symbol);
    if (q) {
      quote = q;
      quoteCache[symbol] = { data: quote, timestamp: Date.now() };
    }
  }

  let chartResult;
  let chartRetryCount = 0;
  const maxChartRetries = 5; // Increased chart retries
  
  while (chartRetryCount <= maxChartRetries) {
    try {
      chartResult = await yfQueue.add(() => yahooFinance.chart(symbol, queryOptions, { validateResult: false }), 15000); // Increased timeout to 15s
      if (chartResult && chartResult.quotes && chartResult.quotes.length > 0) {
        break; // Success
      }
      throw new Error("Empty chart data");
    } catch (e) {
      chartRetryCount++;
      if (chartRetryCount > maxChartRetries) {
        console.error(`Chart failed for ${symbol} after ${chartRetryCount} attempts`);
        chartResult = { quotes: [] };
      } else {
        // Exponential backoff for charts too
        const chartBackoff = Math.pow(2, chartRetryCount) * 800; // Increased backoff
        await new Promise(r => setTimeout(r, chartBackoff + Math.random() * 500));
      }
    }
  }

  const history = chartResult.quotes || [];
  const prices = history.map((h: any) => h.close).filter((c: any): c is number => typeof c === 'number');

  let sector = 'Other';
  const summary = summaryCache[symbol]?.data;
  
  // Fallback map for popular stocks if YF rate limits us on AWS/Vercel
  const SECTOR_MAP: Record<string, string> = {
    "AAPL": "Technology", "MSFT": "Technology", "GOOGL": "Communication", "AMZN": "Consumer", "NVDA": "Technology", "META": "Communication", "TSLA": "Consumer", "AVGO": "Technology", "ORCL": "Technology", "ADBE": "Technology",
    "PLTR": "Technology", "SMCI": "Technology", "AMD": "Technology", "TSM": "Technology", 
    "XOM": "Energy", "CVX": "Energy", "COP": "Energy", "OXY": "Energy",
    "JPM": "Financials", "BAC": "Financials", "WFC": "Financials", "GS": "Financials",
    "JNJ": "Healthcare", "UNH": "Healthcare", "PFE": "Healthcare", "LLY": "Healthcare"
  };

  if (summary?.assetProfile?.sector) {
    sector = summary.assetProfile.sector;
  } else if (SECTOR_MAP[symbol]) {
    sector = SECTOR_MAP[symbol];
  } else if (quote?.quoteType === 'ETF') {
    sector = 'ETF / Fund';
  } else if (quote?.quoteType === 'MUTUALFUND') {
    sector = 'Mutual Fund';
  } else {
    sector = 'Other';
  }

  if (prices.length === 0) {
    return {
      symbol,
      name: quote?.longName || quote?.shortName || symbol,
      price: quote?.regularMarketPrice || 0,
      change: (quote?.regularMarketChangePercent || 0) * (quote?.regularMarketChangePercent < 1 ? 100 : 1),
      marketCap: quote?.marketCap || 0,
      maFast: quote?.fiftyDayAverage || 0,
      maSlow: quote?.twoHundredDayAverage || 0,
      rsi: 50,
      zone: "Neutral",
      sector: sector,
      industry: 'Other',
      lastUpdated: new Date().toISOString()
    };
  }

  // Optimize MA calculation
  let maFast: number | null = 0;
  let maSlow: number | null = 0;
  
  if (timeframe === '1d' && quote?.fiftyDayAverage && quote?.twoHundredDayAverage) {
    maFast = quote.fiftyDayAverage;
    maSlow = quote.twoHundredDayAverage;
  } else {
    maFast = calculateSMA(prices, 50) || 0;
    maSlow = calculateSMA(prices, 200) || 0;
  }
  
  const rsi = calculateRSI(prices, 21) || 50;

  const isMacroUptrend = maFast !== null && maSlow !== null && (maFast > maSlow);
  const isMacroDowntrend = maFast !== null && maSlow !== null && (maFast < maSlow);

  let zone = "Neutral";
  if (isMacroUptrend && rsi >= 48) zone = "Standard Buy";
  else if (isMacroUptrend && rsi <= 45) zone = "Value Pullback";
  else if (isMacroDowntrend) zone = "Sell Section";

  const data = {
    symbol,
    name: quote?.longName || quote?.shortName || symbol,
    price: quote?.regularMarketPrice || 0,
    change: (quote?.regularMarketChangePercent || 0) * (quote?.regularMarketChangePercent < 1 ? 100 : 1),
    marketCap: quote?.marketCap || 0,
    maFast: maFast || 0,
    maSlow: maSlow || 0,
    rsi: rsi,
    zone,
    sector: sector,
    industry: 'Other',
    lastUpdated: new Date().toISOString()
  };

  cache[cacheKey] = { data, timestamp: Date.now() };
  return data;
}

app.get("/api/analysis/:symbol", async (req, res) => {
  const { symbol } = req.params;
  const timeframe = (req.query.timeframe as string) || '1d';
  
  try {
    const data = await getAnalysis(symbol, timeframe);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message || `Failed to analyze ${symbol}` });
  }
});

app.post("/api/analysis/batch", async (req, res) => {
  const { symbols, timeframe = '1d' } = req.body;
  if (!Array.isArray(symbols)) {
    return res.status(400).json({ error: "symbols must be an array" });
  }

  try {
    const fetchBatchTask = async () => {
      // 1. Fetch missing quotes in one go (batch optimized)
      const missingQuotes = symbols.filter(s => !quoteCache[s] || (Date.now() - quoteCache[s].timestamp) > META_CACHE_TTL);
      const quotePromise = missingQuotes.length > 0 
        ? fetchQuoteWithRetry(missingQuotes).then((results: any) => {
            if (Array.isArray(results)) {
              results.forEach((q: any) => {
                if (q && q.symbol) quoteCache[q.symbol] = { data: q, timestamp: Date.now() };
              });
            }
          })
        : Promise.resolve();

      // 2. Fetch missing summaries (parallel but limited) - use long cache
      const missingSummaries = symbols.filter(s => !summaryCache[s] || (Date.now() - summaryCache[s].timestamp) > SUMMARY_CACHE_TTL);
      const summaryPromises = missingSummaries.slice(0, 10).map(sym => 
        yfQueue.add(() => yahooFinance.quoteSummary(sym, { modules: ['assetProfile'] }, { validateResult: false }).then((res: any) => {
          if (res) summaryCache[sym] = { data: res, timestamp: Date.now() };
        }).catch(() => null), 3000)
      );

      // Wait for core metadata before analysis
      await Promise.all([quotePromise, ...summaryPromises]);

      const analysisPromises = symbols.map(async (sym) => {
        try {
          return await getAnalysis(sym, timeframe);
        } catch (e: any) {
          return null;
        }
      });

      const settledResults = await Promise.allSettled(analysisPromises);
      return settledResults.map(r => r.status === 'fulfilled' ? r.value : null).filter(r => r !== null);
    };

    const timeoutLimit = new Promise<any[]>((_, r) => setTimeout(() => r([]), 8500));
    
    // We race the batch task against a 8.5 second timeout so we never hit Vercel's 10s ceiling
    const results = await Promise.race([fetchBatchTask(), timeoutLimit]);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: "Batch analysis failed", details: error.message });
  }
});


// Export the app for Vercel
export default app;

if (process.env.NODE_ENV !== "production") {
  async function startServer() {
    console.log("Starting server initialization...");
    try {
      console.log("Initializing Vite in development mode...");
      const viteModule = await (new Function('return import("vite")'))();
      const createViteServer = viteModule.createServer;
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
