import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function run() {
  try {
    await yahooFinance.quote("AAPL", {}, { validateResult: false });
    
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

    console.log("Fetching pages...");
    const [p1, p2, p3, p4, p5] = await Promise.all([
      fetchPage(0, 250),
      fetchPage(250, 250),
      fetchPage(500, 250),
      fetchPage(750, 250),
      fetchPage(1000, 250)
    ]);
    const allQuotes = [...p1, ...p2, ...p3, ...p4, ...p5];
    
    const wds = allQuotes.find((q: any) => q.symbol === 'WDS');
    if (wds) {
      console.log("Found WDS in screener response!");
      console.log(JSON.stringify(wds, null, 2));
    } else {
      console.log("WDS not found in screener response.");
    }
  } catch (e: any) {
    console.error(e);
  }
}
run();
