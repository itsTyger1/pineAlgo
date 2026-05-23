# Feature Implementation Plan: "Golden Star" Prime Entry Signal

## 1. Objective
To introduce a visual "Golden Star" indicator on the dashboard that identifies optimal "Buy Now" entry points for assets. This feature caters specifically to long-term investment decisions of 3-5 years. The star will appear to the left of the asset/stock name when a highly specific multi-timeframe alignment occurs, signaling that a macro uptrend is experiencing a deep, structural pullback.

## 2. UI/UX Specifications
* **Visual Element:** A small, filled golden star icon (e.g., FontAwesome fa-star, Heroicons star solid, or a custom SVG).
* **Color:** Gold/Yellow (matching the existing #D97706 or similar hex code used for the "VALUE ZONE" badges in the app).
* **Placement:** Directly to the left of the asset ticker symbol (e.g., ⭐ NVDA) in the main dashboard list.
* **Tooltip (Optional but recommended):** On hover, display a small tooltip stating: "Prime Entry: Macro Uptrend with Deep Structural Pullback.".
* **Header Filter Toggle (New):** A clickable star icon (unfilled/gray by default, filled/gold when active) placed directly to the left of the "ASSET" column header name.
* **Filter Behavior (New):** When toggled active, the dashboard list filters to exclusively show assets that currently have the Golden Star.

## 3. Core Logic & Algorithm Solution
To accurately determine a "Golden Star" buy opportunity, the logic identifies a deep discount within a proven macro uptrend. The overarching weekly and monthly trends must be highly bullish, while the daily, 4-hour, and 1-hour timeframes must simultaneously show extreme short-term weakness or oversold conditions.

### The Golden Star Algorithm
An asset receives the Golden Star if it meets ALL of the following exact criteria based on the existing timeframe data (1H, 4H, 1D, 1W, 1M):

1. **Macro Trend Confirmation (The Foundation):**
    * 1W status MUST equal BUY ZONE.
    * 1M status MUST equal BUY ZONE.
    * *Reasoning:* The long-term trajectory over months and years must be firmly intact and positive.
2. **Deep Value Setup (The Structural Pullback):**
    * 1D status MUST equal VALUE ZONE.
    * 4H status MUST equal VALUE ZONE.
    * *Reasoning:* Both the daily and 4-hour charts must confirm a meaningful, substantial pullback, ensuring the asset is at a genuine long-term discount.
3. **Micro-Bleed Entry (The Execution):**
    * 1H status MUST equal VALUE ZONE OR SELL ZONE.
    * *Reasoning:* The shortest timeframe confirms the asset is actively in the deepest part of the dip, highlighting the maximum point of financial opportunity for a dollar-cost averaging entry.

**Pseudocode for Frontend/Backend Evaluation:**
```javascript
function isGoldenStar(assetTimeframes) {
  const { h1, h4, d1, w1, m1 } = assetTimeframes;

  const macroBullish = (w1 === 'BUY ZONE' && m1 === 'BUY ZONE');
  const deepPullback = (d1 === 'VALUE ZONE' && h4 === 'VALUE ZONE');
  const microBleed = (h1 === 'VALUE ZONE' || h1 === 'SELL ZONE');

  return macroBullish && deepPullback && microBleed;
}
```

## 4. Engineering Tasks (For Antigravity)

### Frontend (UI/Component Updates)
* **Asset Row Component:** Modify the grid/table row component responsible for rendering the ASSET column.
* **Conditional Rendering:** Inject the isGoldenStar boolean into the component's props or state.
* **Icon Integration:** Add the SVG/Icon component inline with the ticker symbol flexbox/container. Ensure standard padding (e.g., mr-2 in Tailwind) separates the star from the text.
* **Header Filter Toggle (New):** Add a clickable star icon to the main table/grid header next to the "ASSET" label.
* **List Filtering Logic (New):** Introduce local UI state (e.g., showGoldenStarsOnly). When active, apply a .filter(asset => asset.isGoldenStar) to the dataset array before rendering the dashboard rows.
* **State Management:** Ensure the star dynamically appears/disappears upon the periodic refresh of the dashboard data (synced with the SYNCED: HH:MM:SS timer).

### Backend / Data Pipeline (If logic is handled server-side)
* **API Response Update:** If the frontend simply maps over an array of assets, the backend should ideally compute the isGoldenStar boolean and pass it in the JSON payload for each asset.
* **Example payload addition:** "isGoldenStar": true.
* **Performance:** This is a lightweight boolean check based on existing computed string values, so it should not add any noticeable overhead to the data sync process.

## 5. Edge Cases & Testing Protocol
* **Missing Data:** If an asset is a recent IPO and lacks 1M or 1W moving average data (resulting in NEUTRAL or NULL), the Golden Star should default to false. Long-term investments require historical data.
* **UI Overflow:** Test the placement of the star on smaller screens to ensure it doesn't cause the ticker symbol to break onto a second line awkwardly.
* **Strict Adherence:** Ensure the logic strictly requires AND operators for the 4H and 1D timeframes, not OR. The star should only trigger on this specific deep alignment.