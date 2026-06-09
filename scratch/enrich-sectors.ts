import YahooFinance from 'yahoo-finance2';
import fs from 'fs';
import path from 'path';

const yahooFinance = new YahooFinance();

const CACHE_FILE = path.join(process.cwd(), 'api', 'summary-cache.json');

// Exchanges allowed in the main backend list
const ALLOWED_EXCHANGES = new Set(['NYQ', 'NMS', 'NGM', 'NCM', 'ASE', 'BATS', 'BTS']);

async function run() {
  try {
    console.log("Loading Yahoo Finance instance...");
    // Force initialization of cookies/crumbs
    await yahooFinance.quote("AAPL", {}, { validateResult: false });

    // Fetch pages of custom screener to get top stocks
    const cookieJar = (yahooFinance as any)._opts.cookieJar;
    const screenerUrl = "https://query2.finance.yahoo.com/v1/finance/screener";
    const cookies = await cookieJar.getCookieString(screenerUrl);
    const configCookies = await cookieJar.getCookies("http://config.yf2/");
    const crumbCookie = configCookies.find((c: any) => c.key === "crumb");
    const crumb = crumbCookie?.value || "";

    const fetchPage = async (offset: number, size: number) => {
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
      return data.finance.result[0].quotes || [];
    };

    console.log("Fetching top 1250 US stocks from Yahoo Finance screener...");
    const [p1, p2, p3, p4, p5] = await Promise.all([
      fetchPage(0, 250),
      fetchPage(250, 250),
      fetchPage(500, 250),
      fetchPage(750, 250),
      fetchPage(1000, 250)
    ]);
    const allQuotes = [...p1, ...p2, ...p3, ...p4, ...p5];
    console.log(`Fetched ${allQuotes.length} quotes from Yahoo Finance.`);

    // Deduplicate and filter (matching api/index.ts)
    const uniqueStocksMap = new Map();
    allQuotes.forEach((q: any) => {
      if (q && q.symbol && ALLOWED_EXCHANGES.has(q.exchange)) {
        if (q.symbol.includes('-') && !q.symbol.startsWith('BRK-')) {
          return;
        }
        if (!uniqueStocksMap.has(q.symbol)) {
          uniqueStocksMap.set(q.symbol, {
            symbol: q.symbol,
            marketCap: q.marketCap || 0
          });
        }
      }
    });

    const top500 = Array.from(uniqueStocksMap.values())
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, 500)
      .map(s => s.symbol);

    console.log(`Identified top 500 stocks after filtering.`);

    // Read current cache
    let cache: Record<string, string> = {};
    if (fs.existsSync(CACHE_FILE)) {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      console.log(`Loaded ${Object.keys(cache).length} entries from summary-cache.json.`);
    } else {
      console.log("No existing summary-cache.json found, starting fresh.");
    }

    // Find missing symbols
    const missing = top500.filter(sym => !cache[sym.toUpperCase()]);
    console.log(`Found ${missing.length} missing sectors out of top 500 stocks.`);

    if (missing.length === 0) {
      console.log("All top 500 stocks already have sector mapping in the cache.");
      return;
    }

    // Fetch missing sectors sequentially/concurrently with a delay to be safe
    console.log(`Fetching sectors for ${missing.length} missing tickers...`);
    let count = 0;
    
    // Process in batches of 5 to avoid overwhelming the network
    const BATCH_SIZE = 5;
    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);
      console.log(`Fetching batch: ${batch.join(', ')} (${i + 1}/${missing.length})...`);
      
      await Promise.all(batch.map(async (sym) => {
        try {
          const res = await yahooFinance.quoteSummary(sym, { modules: ['assetProfile'] }, { validateResult: false }) as any;
          if (res?.assetProfile?.sector) {
            cache[sym.toUpperCase()] = res.assetProfile.sector;
            count++;
          } else {
            console.log(`  - No sector found for ${sym}`);
          }
        } catch (e: any) {
          console.error(`  - Failed to fetch sector for ${sym}: ${e.message}`);
        }
      }));

      // Gentle pause between batches (e.g. 500ms)
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`Successfully resolved ${count} new sectors.`);

    // Write updated cache
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
    console.log(`Saved updated cache with ${Object.keys(cache).length} total entries to ${CACHE_FILE}`);

  } catch (err: any) {
    console.error("Critical error in enrich-sectors script:", err);
  }
}

run();
