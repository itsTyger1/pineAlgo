# Performance Optimization: `/api/index.ts` — 753 MB / 10s CPU → <128 MB / <1s

## Problem Summary

Every invocation of the single Vercel serverless function (`/api/index.ts`) currently:
- Consumes **753 MB RAM** (P75)
- Burns **10 seconds of Active CPU time** (P75)
- Causes **~6% throttling** from Vercel

This is because the serverless function is an **Express app** that, on cold start, initializes the `yahoo-finance2` library, reads a 32 KB JSON cache file from disk, and defines all route handlers. But the real cost comes from the **`/api/analysis/batch`** and **`/api/stocks`** endpoints, which make dozens of concurrent HTTP calls to Yahoo Finance and perform CPU-heavy indicator calculations inside the request lifecycle.

---

## Root Cause Analysis

I identified **7 primary root causes** ranked by impact:

### 🔴 Critical: O(n²) SMA/RSI Recalculation in `/api/stock-details` (Lines 779–796)

```typescript
for (let i = startIdx; i < validHistory.length; i++) {
  const pricesBefore = closePrices.slice(0, i + 1); // ← Copies entire array each iteration
  const sma50 = calculateSMA(pricesBefore, 50);      // ← Recomputes from scratch
  const sma200 = calculateSMA(pricesBefore, 200);     // ← Recomputes from scratch
  const rsi = calculateRSI(pricesBefore, 21);          // ← Recomputes from scratch
}
```

For 90 chart points over ~250 data points, this creates **90 array copies** (up to 250 elements each) and runs **270 full indicator calculations**. The `calculateRSI` function alone iterates the full array for each call. This is **O(n × m)** where n=90 iterations and m=250 price points — effectively ~67,500 operations per request.

**Fix**: Compute SMA and RSI in a single forward pass using rolling/incremental algorithms.

---

### 🔴 Critical: `toLocaleString()` in Hot Loop (Lines 536, 546)

```typescript
for (const q of history) {
  const timeStr = d.toLocaleString('en-US', { timeZone: 'America/New_York', ... });
}
```

`toLocaleString()` with timezone conversion is **extremely expensive** (~1–5ms per call due to ICU/Intl initialization). For the `4hr` timeframe with ~2,400 hourly candles (360 days of history), this runs **2,400 times** = up to **12 seconds of CPU** just for time formatting.

**Fix**: Use raw UTC offset math or `Intl.DateTimeFormat` with a cached formatter instance.

---

### 🟠 High: Massive Concurrent Yahoo Finance Calls in Batch Endpoint

The `/api/analysis/batch` endpoint receives 50 symbols and fires off **50 parallel `getAnalysis()` calls**, each of which:
1. Fetches a quote (potentially via retry with backoff)
2. Fetches chart data (potentially via retry with backoff)
3. Fires off a `quoteSummary` call for sector info

With `maxConcurrency=15` in the queue, this creates a thundering herd of HTTP connections. Each Yahoo Finance response can be 50–200 KB of JSON, so 50 symbols × ~150 KB = **~7.5 MB of JSON parsing** per batch.

**Fix**: The Yahoo Finance `chart()` API does NOT support multi-symbol queries, so we can't batch those. However, we can:
- Serve cached results immediately without re-fetching
- Reduce the number of chart data points fetched (use tighter date ranges)
- Pre-compute and cache analysis results

---

### 🟠 High: 5-Page Screener Fetch on Every `/api/stocks` Call (Lines 266–272)

```typescript
const [page1, page2, page3, page4, page5] = await Promise.all([
  fetchScreenerPage(0, 250),   // Each returns ~250 stocks with full quote data
  fetchScreenerPage(250, 250),
  fetchScreenerPage(500, 250),
  fetchScreenerPage(750, 250),
  fetchScreenerPage(1000, 250)
]);
allQuotes = [...page1, ...page2, ...page3, ...page4, ...page5]; // 1250 objects
```

This fetches **1,250 stock quote objects** from Yahoo's screener, parses them, spreads them into a single array, then filters/deduplicates. Each response is ~100–200 KB of JSON. This alone is **~1 MB of JSON parsing + allocation**.

The 15-minute cache (`STOCK_LIST_TTL`) helps on warm invocations, but on Vercel serverless, the process is often cold-started, so the in-memory cache is empty.

**Fix**: The stock list barely changes — cache it externally (Vercel KV, or a static JSON file that's updated via cron).

---

### 🟡 Medium: Synchronous Disk I/O at Module Init (Lines 157–165)

```typescript
if (fs.existsSync(CACHE_FILE)) {
  const raw = fs.readFileSync(CACHE_FILE, 'utf8');  // 32 KB blocking read
  summaryCache = JSON.parse(raw);
}
```

This blocks the event loop during cold start. On Vercel's ephemeral filesystem, this file may not even exist (it's written to `process.cwd()` which is read-only on Vercel in production).

**Fix**: Remove filesystem caching entirely — it doesn't work on Vercel's read-only filesystem. Use the hardcoded `SECTOR_MAP` as the primary source.

---

### 🟡 Medium: `saveSummaryCache()` Called Per-Symbol (Lines 570, 883)

Every time a sector is fetched for a new symbol, `saveSummaryCache()` writes the entire cache to disk via `JSON.stringify()` + `fs.writeFileSync()`. In a batch of 50 symbols with 25 missing summaries, this triggers **25 synchronous disk writes**.

**Fix**: Remove entirely (see above — filesystem doesn't persist on Vercel).

---

### 🟢 Low: `yahoo-finance2` Library Weight

The `yahoo-finance2` package pulls in significant dependencies. Its initialization (cookie jar, crumb fetching) adds to cold start time. This is unavoidable if we want to use the library, but worth noting.

---

## Proposed Changes

### Phase 1: Algorithmic Hotfix (Biggest CPU Win)

#### [MODIFY] [index.ts](file:///c:/Users/ElTig/OneDrive/Documents/Antigravity/pineAlgo/api/index.ts)

**1. Replace O(n²) chart indicator computation with single-pass rolling algorithms**

Replace the loop at lines 779–796 with incremental SMA (running sum) and streaming RSI (Wilder's method with carry-forward state). This transforms ~67,500 operations into ~750 operations (one pass over 250 data points).

New helper functions:
- `computeChartIndicators(closePrices, startIdx, smaLengths, rsiLength)` — returns pre-computed arrays of SMA50, SMA200, and RSI for the chart range in a single forward pass.

**2. Eliminate `toLocaleString()` from hot loops**

Replace the per-candle `toLocaleString()` calls with a **cached `Intl.DateTimeFormat`** instance (created once) and manual hour/minute extraction. This is ~100x faster.

```typescript
// Before (lines 536, 546): ~1-5ms per call
const timeStr = d.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });

// After: ~0.01ms per call  
const parts = cachedFormatter.formatToParts(d);
const h = +parts.find(p => p.type === 'hour')!.value;
const m = +parts.find(p => p.type === 'minute')!.value;
```

**3. Remove filesystem I/O (summary-cache.json)**

- Remove `fs.readFileSync` at module init (lines 157–165)
- Remove `saveSummaryCache()` function and all calls to it
- Keep the in-memory `summaryCache` object for runtime use, but seed it from `SECTOR_MAP` on init
- The `SECTOR_MAP` already covers ~200 symbols which is the majority of the top 500

---

### Phase 2: Caching Architecture

#### [MODIFY] [index.ts](file:///c:/Users/ElTig/OneDrive/Documents/Antigravity/pineAlgo/api/index.ts)

**4. Add HTTP-level caching headers for Vercel Edge Cache**

Add `Cache-Control` and `s-maxage` headers so Vercel's CDN/Edge Cache serves repeat requests without invoking the function:

```typescript
// /api/stocks — stock list changes slowly
res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');

// /api/analysis/batch — analysis results valid for 15+ minutes
res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

// /api/stock-details/:symbol — per-stock details
res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
```

This alone could **eliminate 80%+ of function invocations** since the frontend fetches the same data for all users.

**5. Seed the in-memory caches from SECTOR_MAP on init**

Pre-populate `summaryCache` from `SECTOR_MAP` so sector lookups never trigger Yahoo Finance `quoteSummary` calls for known symbols.

---

### Phase 3: Reduce Data Volume

#### [MODIFY] [index.ts](file:///c:/Users/ElTig/OneDrive/Documents/Antigravity/pineAlgo/api/index.ts)

**6. Tighten historical data ranges**

The `4hr` timeframe currently fetches **360 days of hourly data** (~2,400 candles) just to synthesize 4hr bars. After the 4hr filter, only ~480 candles remain. We can reduce the fetch to 270 days and still have 200+ 4hr bars for SMA(200).

Similarly, the `1h` timeframe fetches 150 days (~1,500+ candles) but SMA(200) on hourly needs only the last ~30 trading days for meaningful data. However, since Yahoo limits hourly data to 730 days, the current 150 days is already reasonable.

**7. Expand `SECTOR_MAP` to cover all 500 stocks + keep background discovery**

The current `SECTOR_MAP` covers ~200 symbols. We'll expand it to ~350+ to cover the vast majority of top US equities. For any symbol NOT in the map, the background `quoteSummary` calls (lines 567–572, 876–888) are **kept** to ensure no stock shows "Other". However, we remove the `saveSummaryCache()` disk writes since they don't work on Vercel's read-only filesystem anyway — the in-memory cache is sufficient for the function's lifetime.

---

## Key Constraint: Dashboard Loading Speed

> [!IMPORTANT]
> All changes are **strictly performance improvements** — nothing slows down existing data loading.
> - The concurrent Yahoo Finance fetching pattern (15 concurrent, batch of 50, etc.) is **unchanged**
> - The algorithmic fixes (rolling SMA/RSI, cached date formatter) make each `getAnalysis()` call **faster**
> - Edge cache headers only benefit repeat requests; first-load behavior is identical

---

## Verification Plan

### Automated Tests
- `npx tsx api/index.ts` — verify the server starts without errors locally
- Manually hit `/api/stocks`, `/api/analysis/batch`, and `/api/stock-details/AAPL` to verify correct responses

### Performance Verification
- Compare before/after response times for `/api/analysis/batch` with 50 symbols
- Monitor Vercel function logs after deployment for CPU time and memory usage
- Verify `Cache-Control` headers appear in responses using browser DevTools

### Functional Verification
- Confirm chart data in stock details still shows correct SMA50, SMA200, and RSI values
- Confirm 4hr and 1hr timeframe filtering still produces correct candle counts
- Confirm sector labels are still populated correctly from `SECTOR_MAP`

## Expected Impact

| Metric | Before | After (Est.) |
|--------|--------|-------------|
| Active CPU (P75) | 10s | <1.5s |
| Memory (P75) | 753 MB | <200 MB |
| Cold Start | ~3–5s | ~1–2s |
| Repeat Requests | Full recompute | Served from Vercel Edge Cache (0ms CPU) |
| Chart Indicators | O(n²) — 67,500 ops | O(n) — 750 ops |
| `toLocaleString` calls | 2,400 per 4hr request | 0 (replaced with cached formatter) |
| Disk I/O | 25+ sync writes per batch | 0 |
