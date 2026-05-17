import express from "express";
import cors from "cors";
import YahooFinance from 'yahoo-finance2';
import { subDays } from 'date-fns';

const yahooFinance = new YahooFinance();
const app = express();

app.use(cors());
app.use(express.json());

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

const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 30 * 60 * 1000;

const CORE_SYMBOLS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AVGO", "ORCL", "ADBE",
  "PLTR", "AI", "SMCI", "ARM", "TSM", "AMD", "QCOM", "ASML",
  "XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO", "OXY", "HES", "HAL", "DVN",
  "CCJ", "CEG", "VST", "SMR", "OKLO", "NNE", "BWXT", "LEU",
  "FSLR", "ENPH", "NEE", "SEDG"
];

app.get("/api/stocks", async (req, res) => {
  try {
    const [actives, gainers, losers, coreQuotes] = await Promise.all([
      (yahooFinance as any).screener({ scrIds: "most_actives", count: 50 }, undefined, { validateResult: false }),
      (yahooFinance as any).screener({ scrIds: "day_gainers", count: 50 }, undefined, { validateResult: false }),
      (yahooFinance as any).screener({ scrIds: "day_losers", count: 50 }, undefined, { validateResult: false }),
      yahooFinance.quote(CORE_SYMBOLS, undefined, { validateResult: false }).catch(() => [])
    ]) as any[];

    const allQuotes = [
      ...(actives.quotes || []),
      ...(gainers.quotes || []),
      ...(losers.quotes || []),
      ...(Array.isArray(coreQuotes) ? coreQuotes : [coreQuotes]),
    ];

    const uniqueStocksMap = new Map();
    allQuotes.forEach((q: any) => {
      if (q && q.symbol && !uniqueStocksMap.has(q.symbol)) {
        uniqueStocksMap.set(q.symbol, {
          symbol: q.symbol,
          marketCap: q.marketCap || 0,
        });
      }
    });

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
        startDate = subDays(endDate, 1500);
        break;
      case '1mo':
        interval = '1mo';
        startDate = subDays(endDate, 7000);
        break;
      case '1d':
      default:
        interval = '1d';
        startDate = subDays(endDate, 400);
        break;
    }

    const queryOptions = {
      period1: startDate,
      interval: interval as any,
    };

    const [chartResult, quote, summary] = await Promise.all([
      yahooFinance.chart(symbol, queryOptions, { validateResult: false }).catch(() => ({ quotes: [] })),
      yahooFinance.quote(symbol, undefined, { validateResult: false }).catch(() => ({})),
      yahooFinance.quoteSummary(symbol, { modules: ['assetProfile'] }, { validateResult: false }).catch(() => null)
    ]) as any[];

    const history = chartResult.quotes || [];
    const assetProfile = summary?.assetProfile || {};
    const prices = history.map((h: any) => h.close).filter((c: any): c is number => typeof c === 'number');

    if (prices.length === 0) {
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
    res.status(500).json({ error: `Failed to analyze ${symbol}`, details: error.message });
  }
});

export default app;
