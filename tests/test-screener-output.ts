import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function run() {
  try {
    // Lazy init crumb/cookies
    await yahooFinance.quote("AAPL", {}, { validateResult: false });
    
    const cookieJar = (yahooFinance as any)._opts.cookieJar;
    const screenerUrl = "https://query2.finance.yahoo.com/v1/finance/screener";
    const cookies = await cookieJar.getCookieString(screenerUrl);
    const configCookies = await cookieJar.getCookies("http://config.yf2/");
    const crumbCookie = configCookies.find((c: any) => c.key === "crumb");
    const crumb = crumbCookie?.value || "";

    const payload = {
      offset: 0,
      size: 100,
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
    const quotes = data.finance.result[0].quotes || [];
    
    console.log(`Fetched ${quotes.length} quotes.`);
    for (let i = 0; i < Math.min(20, quotes.length); i++) {
      const q = quotes[i];
      console.log(`Symbol: ${q.symbol}, Name: ${q.shortName || q.longName}, Exchange: ${q.exchange}, FullExchange: ${q.fullExchangeName}, QuoteType: ${q.quoteType}, Market: ${q.market}`);
    }

    // Let's search for Roche and HSBC if they are in the list
    console.log("\nSearching for OTC symbols...");
    const otc = quotes.filter((q: any) => q.symbol.endsWith('F') || q.symbol.endsWith('Y') || q.exchange?.includes('PNK') || q.exchange?.includes('OTC'));
    console.log(`Found ${otc.length} OTC/foreign symbols in top 100:`);
    otc.forEach((q: any) => {
      console.log(`  - ${q.symbol} (${q.shortName || q.longName}) on Exchange: ${q.exchange}, Market: ${q.market}`);
    });

  } catch (e: any) {
    console.error("Error running test:", e);
  }
}
run();
