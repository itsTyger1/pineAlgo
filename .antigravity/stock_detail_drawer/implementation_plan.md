# Implementation Plan: Stock Detail Expansion Drawer

We will implement Feature #1: Stock Detail / Expansion Drawer. Clicking a stock row in the Table view or a card in the Grid view will open a premium, slide-over detail drawer on the right side of the screen.

---

## User Review Required

> [!IMPORTANT]
> The direct click on a stock row/card will now open this detailed analytics drawer instead of immediately redirecting to TradingView. Inside the drawer, a prominent "Open in TradingView" button will be available to trigger the same mobile-intent redirect as before.

---

## Proposed Changes

### 1. Backend Server Updates

We will update [api/index.ts](file:///c:/Users/ElTig/OneDrive/Documents/Antigravity/pineAlgo/api/index.ts) to expose a new endpoint `/api/stock-details/:symbol`.

#### Details Cache
Set up an in-memory cache for stock details with a 15-minute TTL:
```typescript
const detailsCache: Record<string, { data: any, timestamp: number }> = {};
const DETAILS_CACHE_TTL = 15 * 60 * 1000;
```

#### New Route: `GET /api/stock-details/:symbol`
- **Quote Fetching:** Fetch key statistics (52-week range, volumes, P/E ratio, dividend yield) via `yahooFinance.quote`.
- **Chart Fetching:** Fetch 365 days of daily chart data via `yahooFinance.chart`.
- **Technical Metrics:** For the last 90 trading days, calculate:
  - Daily close price
  - SMA 50
  - SMA 200
  - RSI 21
- **Crossover Analysis:** Determine whether SMA 50 is trading above/below SMA 200 and calculate the percentage difference.

---

### 2. Frontend App Updates

We will update [src/App.tsx](file:///c:/Users/ElTig/OneDrive/Documents/Antigravity/pineAlgo/src/App.tsx).

#### State Hooks
Introduce the following states to manage the drawer:
```typescript
const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
const [detailsData, setDetailsData] = useState<any | null>(null);
const [detailsLoading, setDetailsLoading] = useState(false);
```

#### Data Fetching Hook
Implement a `useEffect` that triggers a fetch to `/api/stock-details/:symbol` whenever `selectedSymbol` changes, caching the result in frontend state or ref.

#### Interactive Click Triggers
- Update the Table `tr` and Grid `motion.div` click handlers to open the drawer:
  ```typescript
  onClick={() => setSelectedSymbol(stock.symbol)}
  ```

#### Slide-Over Drawer UI Component
Render a slide-over panel on the right with custom backdrop blur:
- **Header:** Close button, symbol, company name, current price, and change percentage.
- **Action Bar:** "Open in TradingView" action button.
- **5-Timeframe Heatmap:** Visual timeline of the 5 timeframe zones (`1H`, `4H`, `1D`, `1W`, `1M`) using colored badges.
- **SVG Charts:**
  - **Price Pane:** SVG line chart rendering 90-day Close Price (with gradient area fill), overlaid with red/blue lines for SMA 50 and SMA 200.
  - **RSI Pane:** SVG line chart of RSI 21 with dashed markers at 30 (Oversold) and 70 (Overbought).
- **Key Stats Grid:**
  - 52-week low-to-high slider indicating current price position.
  - P/E ratio, Dividend yield, Volume, and Average Volume.
  - SMA Crossover info badge.

---

## Verification Plan

### Automated Tests
- Run `npm run build` to verify compiling.
- Run `npm run lint` to verify TypeScript type compliance.

### Manual Verification
1. Click on a stock row in the table or card in the grid.
2. Verify the slide-over drawer enters smoothly from the right side.
3. Confirm that it shows a loading shimmer, followed by the actual data and SVG charts.
4. Verify the 5-timeframe badges match the main table badges.
5. Click the "Open in TradingView" button and verify deep-linking works.
