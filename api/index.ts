import express from "express";
import path from "path";
import cors from "cors";
import fs from "fs";
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
  private maxConcurrency = 15; // Higher concurrency for faster throughput
  private delayMs = 30; // Lower base delay for speed

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
          this.delayMs = Math.min(this.delayMs + 200, 1500); // Backoff on rate limit
          this.maxConcurrency = Math.max(3, this.maxConcurrency - 2); // Reduce concurrency but keep minimum
        }
        reject(error);
      } finally {
        const jitter = Math.random() * 50;
        await new Promise(r => setTimeout(r, this.delayMs + jitter));
        this.activeCount--;
        // Recover stability quickly
        if (this.delayMs > 30) this.delayMs = Math.max(30, this.delayMs - 25); // 12.5x faster recovery
        if (this.maxConcurrency < 15 && Math.random() > 0.5) this.maxConcurrency = Math.min(15, this.maxConcurrency + 1); // 5x faster concurrency recovery
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
  "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "NVDA", "META", "TSLA", "BRK-B", "TSM", "AVGO",
  "WMT", "JPM", "LLY", "V", "UNH", "XOM", "MA", "JNJ", "PG", "HD", "ORCL", "CVX", "MRK",
  "ABBV", "COST", "PEP", "ASML", "BAC", "KO", "TMO", "CSCO", "MCD", "CRM", "ABT", "LIN",
  "NFLX", "AMD", "CMCSA", "TXN", "DHR", "INTC", "MU", "QCOM", "ADBE", "IBM", "HON", "BA",
  "COP", "SLB", "EOG", "MPC", "PSX", "VLO", "OXY", "HES", "HAL", "DVN",
  "NEE", "CEG", "VST", "SMR", "CCJ",
  "PLTR", "AI", "SMCI", "ARM", "FSLR", "ENPH", "SEDG",
  "NVO", "NVS", "SAP", "TM", "TMUS", "AZN", "BHP", "SNY", "SONY", "MDT", "RY", "RIO",
  "C", "GS", "MS", "AXP", "BLK", "SCHW", "MMC", "PGR", "CB", "CME", "UBER", "ABNB", "SHOP",
  "NOW", "INTU", "PANW", "CRWD", "WDAY", "SNPS", "CDNS", "FTNT", "TEAM", "MDB", "DDOG",
  "ISRG", "SYK", "VRTX", "BSX", "REGN", "ZTS", "ILMN", "EW", "ALGN", "BIIB", "MRNA", "IDXX",
  "LMT", "RTX", "GD", "NOC", "GE", "CAT", "DE", "UNP", "UPS", "FDX", "ETN", "EMR", "MMM",
  "SBUX", "NKE", "TGT", "TJX", "LOW", "BKNG", "CMG", "MAR", "HLT", "LVS", "MGM", "CCL", "RCL",
  "VZ", "T", "DIS", "WBD", "TMUS", "CHTR", "LYV", "EA", "TTWO", "WPP", "OMC", "IPG",
  "SQ", "PYPL", "COIN", "HOOD", "AFRM", "UPST", "SOFI", "LC", "NU", "SG", "MELI", "SE",
  "CRSP", "NTLA", "EDIT", "BEAM", "PACB", "GILD", "BMRN", "VRTX", "INCY", "SGEN", "EXAS",
  "ALB", "LTHM", "LAC", "SQM", "FCX", "SCCO", "VALE", "CLF", "X", "STLD", "NUE", "RS"
];

// Cache for basic stock info to avoid redundant calls
const quoteCache: Record<string, { data: any, timestamp: number }> = {};
const META_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const SUMMARY_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for sectors/profiles

const CACHE_FILE = path.join(process.cwd(), 'api', 'summary-cache.json');
let summaryCache: Record<string, string | { data: any, timestamp: number }> = {};

// Load persistent summary cache at startup
try {
  if (fs.existsSync(CACHE_FILE)) {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    summaryCache = JSON.parse(raw);
    console.log(`Loaded ${Object.keys(summaryCache).length} cached sectors/summaries from persistent cache file.`);
  }
} catch (e) {
  console.warn("Failed to load persistent summary cache file:", e);
}

function saveSummaryCache() {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(summaryCache, null, 2), 'utf8');
  } catch (e) {
    console.warn("Failed to save summary cache file:", e);
  }
}

// Cache for screener output
let cachedStockList: any[] = [];
let lastStockListCacheTime = 0;
const STOCK_LIST_TTL = 15 * 60 * 1000; // 15 mins

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", vercel: process.env.VERCEL });
});

app.get("/api/stocks", async (req, res) => {
  const refresh = req.query.refresh === 'true';
  if (!refresh && cachedStockList.length > 0 && Date.now() - lastStockListCacheTime < STOCK_LIST_TTL) {
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
    // Helper: fetch a single page from Yahoo's custom screener POST API
    // This is the same API that powers https://finance.yahoo.com/research-hub/screener/equity/
    // We use native fetch (not yahooFinance._fetch) because the library's _fetch only supports GET.
    const fetchScreenerPage = async (offset: number, size: number): Promise<any[]> => {
      // Get cookies and crumb from the yahoo-finance2 instance's internal state
      const cookieJar = (yahooFinance as any)._opts.cookieJar;
      const screenerUrl = "https://query2.finance.yahoo.com/v1/finance/screener";
      const cookies = await cookieJar.getCookieString(screenerUrl);
      const configCookies = await cookieJar.getCookies("http://config.yf2/");
      const crumbCookie = configCookies.find((c: any) => c.key === "crumb");
      const crumb = crumbCookie?.value || "";

      const payload = {
        offset,
        size,
        sortField: "intradaymarketcap",
        sortType: "DESC",
        quoteType: "equity",
        query: {
          operator: "and",
          operands: [
            { operator: "eq", operands: ["region", "us"] }
          ]
        },
        userId: "",
        userIdType: "guid"
      };

      const response = await fetch(`${screenerUrl}?crumb=${encodeURIComponent(crumb)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": cookies,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json() as any;

      if (data?.finance?.result?.[0]?.quotes) {
        return data.finance.result[0].quotes;
      }
      return [];
    };

    const fetchStocksTask = async () => {
      // Primary approach: Use Yahoo's custom screener POST API to get top 500 US equities by market cap
      let allQuotes: any[] = [];
      let usedCustomScreener = false;

      try {
        console.log("Fetching stocks via custom screener POST API (sorted by marketCap DESC)...");
        // Ensure yahoo-finance2 has initialized its crumb/cookies (lazy init on first authenticated call)
        await yahooFinance.quote("AAPL", {}, { validateResult: false });
        // Paginate: 5 requests of 250 to get 1250 stocks, ensuring we get at least 500 major exchange equities after filtering out OTC
        const [page1, page2, page3, page4, page5] = await Promise.all([
          fetchScreenerPage(0, 250),
          fetchScreenerPage(250, 250),
          fetchScreenerPage(500, 250),
          fetchScreenerPage(750, 250),
          fetchScreenerPage(1000, 250)
        ]);
        allQuotes = [...page1, ...page2, ...page3, ...page4, ...page5];
        if (allQuotes.length > 0) {
          usedCustomScreener = true;
          console.log(`Custom screener returned ${allQuotes.length} stocks.`);
        }
      } catch (e: any) {
        console.warn("Custom screener POST failed, falling back to predefined screeners:", e.message);
      }

      // Fallback: Use predefined screeners if custom screener returned nothing
      if (!usedCustomScreener) {
        console.log("Falling back to predefined screeners...");
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

        results.forEach(r => {
          if (r.status === 'fulfilled' && r.value && (r.value as any).quotes) {
            allQuotes.push(...(r.value as any).quotes);
          }
        });

        // Try for core quotes too
        try {
          const coreQuotes = await fetchQuoteWithRetry(CORE_SYMBOLS);
          if (Array.isArray(coreQuotes)) {
            allQuotes.push(...coreQuotes);
          }
        } catch (e) {
          console.warn("Core quotes fetch failed");
        }
      }

      if (allQuotes.length === 0) {
        // Last resort: use CORE_SYMBOLS as symbols if everything failed
        return CORE_SYMBOLS.map(symbol => ({
          symbol,
          marketCap: 0,
          name: symbol
        }));
      }

      // Keep only major exchanges and exclude OTC/foreign pink sheets (like RHHBF, HBCYF)
      const ALLOWED_EXCHANGES = new Set(['NYQ', 'NMS', 'NGM', 'NCM', 'ASE', 'BATS', 'BTS']);

      // Deduplicate by symbol and populate quote cache
      const uniqueStocksMap = new Map();
      allQuotes.forEach((q: any) => {
        if (q && q.symbol && ALLOWED_EXCHANGES.has(q.exchange)) {
          // Exclude preferred share classes (symbols containing hyphens, except BRK-A and BRK-B)
          if (q.symbol.includes('-') && !q.symbol.startsWith('BRK-')) {
            return;
          }
          if (!uniqueStocksMap.has(q.symbol)) {
            uniqueStocksMap.set(q.symbol, {
              symbol: q.symbol,
              marketCap: q.marketCap || 0,
              name: q.longName || q.shortName || q.symbol
            });
            // Seed the quote cache to save a per-symbol request later
            quoteCache[q.symbol] = { data: q, timestamp: Date.now() };
          }
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

    // Vercel serverless has 60s limit with our new config, we time out after 28 seconds to avoid 504 proxy timeout
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 28000));
    const stockList = await Promise.race([fetchStocksTask(), timeoutPromise]);

    return res.json(stockList);

  } catch (error: any) {
    if (error.message === 'Timeout') {
      console.warn("Stock fetch timeout (28s exceeded), using fallback data.");
    } else {
      console.error("Error fetching stocks:", error);
    }
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

  const promises = chunks.map(async (chunk) => {
    let results = await fetchSingleQuoteWithRetry(chunk);

    // Fallback: If a small batch fails, try individual requests for each symbol in that batch
    if (!results && chunk.length > 1) {
      console.warn(`Batch failed for subset of ${chunk.length} symbols, falling back to individual requests`);
      const individualPromises = chunk.map(sym => fetchSingleQuoteWithRetry(sym));
      const individualResults = await Promise.all(individualPromises);
      results = individualResults.filter(r => r !== null);
    }
    return results;
  });

  const settledResults = await Promise.allSettled(promises);
  const allResults: any[] = [];

  for (const r of settledResults) {
    if (r.status === 'fulfilled' && r.value) {
      const results = r.value;
      if (Array.isArray(results)) {
        allResults.push(...results);
      } else if (results) {
        allResults.push(results);
      }
    }
  }
  return allResults;
}

async function fetchSingleQuoteWithRetry(symbols: string | string[]) {
  let retryCount = 0;
  const maxRetries = 3; // Reduced retries for faster failure handling
  while (retryCount <= maxRetries) {
    try {
      // Adjusted timeout to allow for network variability but fail fast enough
      const q = await yfQueue.add(() => yahooFinance.quote(symbols as any, undefined, { validateResult: false }), 15000); // 15s timeout
      if (q) return q;
      throw new Error("Empty quote response");
    } catch (e: any) {
      retryCount++;
      if (retryCount > maxRetries) {
        if (typeof symbols === 'string') {
          // console.warn(`Quote fetch finally failed for ${symbols} after ${maxRetries} retries`);
        } else {
          // console.warn(`Batch quote fetch finally failed for subset of ${symbols.length} symbols`);
        }
        return null;
      }
      // Exponential backoff
      const backoff = Math.pow(2, retryCount) * 500; // Reduced backoff
      const jitter = Math.random() * 300;
      await new Promise(r => setTimeout(r, backoff + jitter));
    }
  }
  return null;
}

async function getAnalysis(symbol: string, timeframe: string, bypassCache = false) {
  const cacheKey = `${symbol}_${timeframe}`;
  if (!bypassCache && cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp) < CACHE_TTL) {
    const cachedData = cache[cacheKey].data;
    if (cachedData.sector === 'Other' && summaryCache[symbol.toUpperCase()]) {
      const cachedSector = summaryCache[symbol.toUpperCase()];
      cachedData.sector = typeof cachedSector === 'string' ? cachedSector : (cachedSector as any).data?.assetProfile?.sector || 'Other';
    }
    return cachedData;
  }

  const endDate = new Date();
  let startDate: Date;
  let interval: '60m' | '1d' | '1wk' | '1mo' = '1d';

  switch (timeframe) {
    case '1h':
      interval = '60m';
      startDate = subDays(endDate, 150);
      break;
    case '4hr':
      interval = '60m';
      // 360 days yields ~480 candles (2 per trading day).
      // This ensures SMA(200) always has 200+ candles and RSI(21) converges properly.
      startDate = subDays(endDate, 360);
      break;
    case '1wk':
      interval = '1wk';
      // 3000 days yields ~428 weekly candles, ensuring SMA(200) and RSI(21) convergence.
      startDate = subDays(endDate, 3000);
      break;
    case '1mo':
      interval = '1mo';
      // 12000 days yields ~400 monthly candles, ensuring SMA(200) and RSI(21) convergence.
      startDate = subDays(endDate, 12000);
      break;
    case '1d':
    default:
      interval = '1d';
      // Need ~360 calendar days (~250 trading bars) for RSI(21) Wilder's smoothing to converge properly.
      // MAs still come from Yahoo quote endpoint, so this extra data is only for RSI.
      startDate = subDays(endDate, 360);
      break;
  }

  const queryOptions = {
    period1: startDate,
    period2: endDate,
    interval: interval as any,
  };

  let quote: any = null;
  if (!bypassCache && quoteCache[symbol] && (Date.now() - quoteCache[symbol].timestamp) < META_CACHE_TTL) {
    quote = quoteCache[symbol].data;
  }

  if (!quote) {
    const q = await fetchQuoteWithRetry(symbol);
    if (q) {
      quote = q;
      quoteCache[symbol] = { data: quote, timestamp: Date.now() };
    }
  }

  let chartResult: any;
  let chartRetryCount = 0;
  const maxChartRetries = 2; // Fail fast to avoid blocking batches

  while (chartRetryCount <= maxChartRetries) {
    try {
      chartResult = await yfQueue.add(() => yahooFinance.chart(symbol, queryOptions, { validateResult: false }), 12000);
      if (chartResult && chartResult.quotes && chartResult.quotes.length > 0) {
        break; // Success
      }
      throw new Error("Empty chart data");
    } catch (e) {
      chartRetryCount++;
      if (chartRetryCount > maxChartRetries) {
        chartResult = { quotes: [] };
      } else {
        // Fast exponential backoff
        const chartBackoff = Math.pow(2, chartRetryCount) * 400;
        await new Promise(r => setTimeout(r, chartBackoff + Math.random() * 200));
      }
    }
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
        // Regular session standard trading hours: 9:30 AM to 4:00 PM EST (570 to 960 minutes)
        if (totalMinutes >= 570 && totalMinutes < 960) {
          prices.push(q.close);
        }
      }
    }
  } else {
    prices = history.map((h: any) => h.close).filter((c: any): c is number => typeof c === 'number');
  }

  let sector = 'Other';
  const cachedSector = summaryCache[symbol.toUpperCase()];
  if (cachedSector) {
    sector = typeof cachedSector === 'string' ? cachedSector : (cachedSector as any).data?.assetProfile?.sector || 'Other';
  } else {
    // Fire off sector fetch asynchronously in the background for unknowns without blocking
    yfQueue.add(() => yahooFinance.quoteSummary(symbol, { modules: ['assetProfile'] }, { validateResult: false }).then((res: any) => {
      if (res?.assetProfile?.sector) {
        summaryCache[symbol.toUpperCase()] = res.assetProfile.sector;
      }
    }).catch(() => null), 3000);
  }

  // Fallback map for popular stocks if YF rate limits us on AWS/Vercel
  const SECTOR_MAP: Record<string, string> = {
    // Technology
    "AAPL": "Technology", "MSFT": "Technology", "NVDA": "Technology", "AVGO": "Technology",
    "ORCL": "Technology", "ADBE": "Technology", "CRM": "Technology", "CSCO": "Technology",
    "IBM": "Technology", "NOW": "Technology", "INTU": "Technology", "PANW": "Technology",
    "ANET": "Technology", "LRCX": "Technology", "KLAC": "Technology", "SNPS": "Technology",
    "CDNS": "Technology", "ASML": "Technology", "TEAM": "Technology", "WDAY": "Technology",
    "CRWD": "Technology", "DDOG": "Technology", "PLTR": "Technology", "SMCI": "Technology",
    "AMD": "Technology", "TSM": "Technology", "TXN": "Technology", "INTC": "Technology",
    "QCOM": "Technology", "MU": "Technology", "FSLR": "Technology", "ENPH": "Technology",
    "SEDG": "Technology", "ARM": "Technology", "SNOW": "Technology", "MDB": "Technology",
    "NET": "Technology", "ANSS": "Technology", "HPQ": "Technology", "HPE": "Technology",
    "NTAP": "Technology", "WDC": "Technology", "STX": "Technology", "FITB": "Financials",

    // Communication Services
    "GOOG": "Communication", "GOOGL": "Communication", "META": "Communication", "NFLX": "Communication",
    "DIS": "Communication", "TMUS": "Communication", "VZ": "Communication", "T": "Communication",
    "CMCSA": "Communication", "CHTR": "Communication", "EA": "Communication", "TTWO": "Communication",
    "MTCH": "Communication", "SNAP": "Communication", "PINS": "Communication", "LYV": "Communication",
    "OMC": "Communication", "IPG": "Communication", "WBD": "Communication",

    // Consumer Discretionary & Staples
    "AMZN": "Consumer", "TSLA": "Consumer", "WMT": "Consumer", "COST": "Consumer",
    "HD": "Consumer", "MCD": "Consumer", "KO": "Consumer", "PEP": "Consumer",
    "NKE": "Consumer", "SBUX": "Consumer", "TGT": "Consumer", "TJX": "Consumer",
    "LOW": "Consumer", "CMG": "Consumer", "BKNG": "Consumer", "EL": "Consumer",
    "ROST": "Consumer", "DG": "Consumer", "DLTR": "Consumer", "Target": "Consumer",
    "MAR": "Consumer", "HLT": "Consumer", "LVS": "Consumer", "MGM": "Consumer",
    "CCL": "Consumer", "RCL": "Consumer", "NCLH": "Consumer", "MELI": "Consumer",
    "SE": "Consumer", "SG": "Consumer", "YUM": "Consumer", "DPZ": "Consumer",
    "OR.PA": "Consumer", "LVMUY": "Consumer", "MO": "Consumer", "PM": "Consumer",
    "PG": "Consumer", "CL": "Consumer", "KDP": "Consumer", "MDLZ": "Consumer",
    "GIS": "Consumer", "K": "Consumer", "KHC": "Consumer", "SYY": "Consumer",
    "ADM": "Consumer", "KR": "Consumer", "TSG": "Consumer",

    // Financials
    "JPM": "Financials", "BAC": "Financials", "WFC": "Financials", "C": "Financials",
    "GS": "Financials", "MS": "Financials", "AXP": "Financials", "BLK": "Financials",
    "SCHW": "Financials", "MMC": "Financials", "PGR": "Financials", "CB": "Financials",
    "V": "Financials", "MA": "Financials", "COIN": "Financials", "HOOD": "Financials",
    "PYPL": "Financials", "SQ": "Financials", "SOFI": "Financials", "AFRM": "Financials",
    "UPST": "Financials", "NU": "Financials", "AON": "Financials", "MET": "Financials",
    "PRU": "Financials", "TRV": "Financials", "ALL": "Financials", "CME": "Financials",
    "ICE": "Financials", "SPGI": "Financials", "MCO": "Financials", "DFS": "Financials",
    "SYF": "Financials", "KEY": "Financials", "HBAN": "Financials", "RF": "Financials",

    // Healthcare
    "JNJ": "Healthcare", "UNH": "Healthcare", "PFE": "Healthcare", "LLY": "Healthcare",
    "ABBV": "Healthcare", "MRK": "Healthcare", "TMO": "Healthcare", "ABT": "Healthcare",
    "DHR": "Healthcare", "ISRG": "Healthcare", "SYK": "Healthcare", "VRTX": "Healthcare",
    "BSX": "Healthcare", "CI": "Healthcare", "CVS": "Healthcare", "ELV": "Healthcare",
    "BDX": "Healthcare", "MCK": "Healthcare", "COR": "Healthcare", "CNC": "Healthcare",
    "REGN": "Healthcare", "ZTS": "Healthcare", "ILMN": "Healthcare", "EW": "Healthcare",
    "ALGN": "Healthcare", "BIIB": "Healthcare", "MRNA": "Healthcare", "IDXX": "Healthcare",
    "GILD": "Healthcare", "BMRN": "Healthcare", "INCY": "Healthcare", "EXAS": "Healthcare",
    "AMGN": "Healthcare", "HCA": "Healthcare", "IQV": "Healthcare", "MDT": "Healthcare",
    "AZN": "Healthcare", "NVO": "Healthcare", "NVS": "Healthcare", "SNY": "Healthcare",

    // Energy
    "XOM": "Energy", "CVX": "Energy", "COP": "Energy", "OXY": "Energy",
    "SLB": "Energy", "HAL": "Energy", "BKR": "Energy", "EOG": "Energy",
    "MPC": "Energy", "PSX": "Energy", "VLO": "Energy", "HES": "Energy",
    "DVN": "Energy", "LNG": "Energy", "WMB": "Energy", "KMI": "Energy",
    "PXD": "Energy", "FANG": "Energy", "MRO": "Energy", "APA": "Energy",

    // Industrials
    "GE": "Industrials", "CAT": "Industrials", "UNP": "Industrials", "HON": "Industrials",
    "RTX": "Industrials", "LMT": "Industrials", "UPS": "Industrials", "FDX": "Industrials",
    "DE": "Industrials", "ETN": "Industrials", "EMR": "Industrials", "WM": "Industrials",
    "NSC": "Industrials", "CSX": "Industrials", "ADP": "Industrials", "ITW": "Industrials",
    "GD": "Industrials", "NOC": "Industrials", "TDG": "Industrials", "BA": "Industrials",
    "MMM": "Industrials", "FTV": "Industrials", "IR": "Industrials", "AME": "Industrials",
    "PH": "Industrials", "ROP": "Industrials", "FAST": "Industrials", "VRSK": "Industrials",

    // Materials
    "LIN": "Materials", "APD": "Materials", "SHW": "Materials", "FCX": "Materials",
    "NUE": "Materials", "DOW": "Materials", "DD": "Materials", "ALB": "Materials",
    "NEM": "Materials", "VALE": "Materials", "SCCO": "Materials", "CLF": "Materials",
    "X": "Materials", "STLD": "Materials", "RS": "Materials", "LTHM": "Materials",
    "LAC": "Materials", "SQM": "Materials",

    // Utilities & Real Estate
    "NEE": "Utilities", "SO": "Utilities", "DUK": "Utilities", "AEP": "Utilities",
    "D": "Utilities", "EXC": "Utilities", "SRE": "Utilities", "CEG": "Utilities",
    "VST": "Utilities", "PLD": "Real Estate", "AMT": "Real Estate", "CCI": "Real Estate",
    "EQIX": "Real Estate", "WY": "Real Estate", "SMR": "Utilities", "CCJ": "Energy"
  };

  if (sector === 'Other') {
    if (SECTOR_MAP[symbol.toUpperCase()]) {
      sector = SECTOR_MAP[symbol.toUpperCase()];
    } else if (quote?.quoteType === 'ETF') {
      sector = 'ETF / Fund';
    } else if (quote?.quoteType === 'MUTUALFUND') {
      sector = 'Mutual Fund';
    }
  }

  if (prices.length === 0) {
    return {
      symbol,
      name: quote?.longName || quote?.shortName || symbol,
      price: quote?.regularMarketPrice || 0,
      change: quote?.regularMarketChangePercent || 0,
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

  let zone = "Neutral Zone";
  if (isMacroUptrend && rsi >= 48) zone = "Buy Zone";
  else if (isMacroUptrend && rsi <= 45) zone = "Value Zone";
  else if (isMacroDowntrend) zone = "Sell Zone";

  const data = {
    symbol,
    name: quote?.longName || quote?.shortName || symbol,
    price: quote?.regularMarketPrice || 0,
    change: quote?.regularMarketChangePercent || 0,
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
  const refresh = req.query.refresh === 'true';

  try {
    const data = await getAnalysis(symbol, timeframe, refresh);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message || `Failed to analyze ${symbol}` });
  }
});

app.post("/api/analysis/batch", async (req, res) => {
  const { symbols, timeframe = '1d', refresh = false } = req.body;
  if (!Array.isArray(symbols)) {
    return res.status(400).json({ error: "symbols must be an array" });
  }

  try {
    const results: any[] = [];
    const fetchBatchTask = async () => {
      // 1. Fetch ALL missing quotes in one go (batch optimized)
      const missingQuotes = refresh
        ? symbols
        : symbols.filter(s => !quoteCache[s] || (Date.now() - quoteCache[s].timestamp) > META_CACHE_TTL);
      if (missingQuotes.length > 0) {
        try {
          const results = await fetchQuoteWithRetry(missingQuotes);
          if (Array.isArray(results)) {
            results.forEach((q: any) => {
              if (q && q.symbol) quoteCache[q.symbol] = { data: q, timestamp: Date.now() };
            });
          }
        } catch (e) {
          // Non-fatal: analysis will fetch individually
        }
      }

      // 2. Fire off summary fetches in background (don't block analysis, rate-limit safe)
      const missingSummaries = symbols.filter(s => !summaryCache[s.toUpperCase()]);
      if (missingSummaries.length > 0) {
        setTimeout(() => {
          const toFetch = missingSummaries.slice(0, 25);
          toFetch.forEach((sym, index) => {
            setTimeout(() => {
              yfQueue.add(() => yahooFinance.quoteSummary(sym, { modules: ['assetProfile'] }, { validateResult: false }).then((res: any) => {
                if (res?.assetProfile?.sector) {
                  summaryCache[sym.toUpperCase()] = res.assetProfile.sector;
                }
              }).catch(() => null), 20000);
            }, index * 350); // Space them out by 350ms to be gentle on Yahoo Finance
          });
        }, 3000); // Wait 3s so the primary chart queries execute first
      }

      // 3. Run all analyses in parallel (don't wait for summaries)
      const analysisPromises = symbols.map(async (sym) => {
        try {
          const res = await getAnalysis(sym, timeframe, refresh);
          if (res) {
            results.push(res);
          }
          return res;
        } catch (e: any) {
          return null;
        }
      });

      await Promise.allSettled(analysisPromises);
      return results;
    };

    const timeoutLimit = new Promise<any[]>((resolve) => setTimeout(() => resolve(results), 28000));

    // We race the batch task against a 28 second timeout to avoid proxy 504 timeouts.
    // If it times out, we still return whatever results were successfully processed so far.
    const finalResults = await Promise.race([fetchBatchTask(), timeoutLimit]);
    res.json(finalResults);
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
