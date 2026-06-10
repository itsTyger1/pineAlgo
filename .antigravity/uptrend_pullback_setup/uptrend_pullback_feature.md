# Feature Implementation Plan: "Uptrend Pullback" Entry Signal

## 1. Objective
To introduce a visual "Uptrend Pullback" indicator on the dashboard that identifies assets currently in a strong macro uptrend but experiencing a short-term, micro pullback. This feature allows users to spot favorable entry points before the trend resumes.

## 2. UI/UX Specifications
* **Visual Element:** A small "Letter P" icon or badge (e.g., a custom SVG, or the letter 'P' inside a styled circle/square).
* **Placement:** Directly to the left of the "Golden Star" icon within the asset column.
* **Header Filter Toggle:** A clickable 'P' icon placed in the main table/grid header next to the "ASSET" label.
* **Filter Behavior:** When toggled active, the dashboard list filters to exclusively show assets that currently satisfy the Uptrend Pullback logic.

## 3. Core Logic & Algorithm Solution
The algorithm identifies a strong uptrend on the higher timeframes and a localized dip or consolidation on the lower timeframes.

### The Uptrend Pullback Algorithm
An asset receives the 'P' icon if it meets **ALL** of the following criteria based on the existing timeframe data (`1H`, `4H`, `1D`, `1W`, `1M`):

1. **Macro Uptrend (The Foundation):**
    * `1W` MUST equal `BUY ZONE`.
    * `1M` MUST equal `BUY ZONE`.
    * `1D` MUST equal `BUY ZONE`.
2. **Micro Pullback/Consolidation (The Setup):**
    * `4H` MUST equal `VALUE ZONE`, `NEUTRAL ZONE`, OR `BUY ZONE`.
3. **Immediate Entry Trigger (The Dip):**
    * `1H` MUST equal `VALUE ZONE` OR `NEUTRAL ZONE`.

**Pseudocode for Frontend/Backend Evaluation:**
```javascript
function isUptrendPullback(assetTimeframes) {
  const { h1, h4, d1, w1, m1 } = assetTimeframes;

  const macroUptrend = (m1 === 'BUY ZONE' && w1 === 'BUY ZONE' && d1 === 'BUY ZONE');
  const microSetup = (h4 === 'VALUE ZONE' || h4 === 'NEUTRAL ZONE' || h4 === 'BUY ZONE');
  const immediateDip = (h1 === 'VALUE ZONE' || h1 === 'NEUTRAL ZONE');

  return macroUptrend && microSetup && immediateDip;
}
```

## 4. Engineering Tasks (For Antigravity)

### Frontend (UI/Component Updates)
* **Asset Row Component:** Modify the grid/table row component responsible for rendering the `ASSET` column.
* **Conditional Rendering:** Inject the `isUptrendPullback` boolean into the component's props or state.
* **Icon Integration:** Add the 'P' icon component inline with the ticker symbol flexbox/container, positioned explicitly to the left of the Golden Star icon.
* **Header Filter Toggle:** Add a clickable 'P' icon to the main table/grid header next to the "ASSET" label.
* **List Filtering Logic:** Introduce local UI state (e.g., `showPullbacksOnly`). When active, apply a `.filter(asset => asset.isUptrendPullback)` to the dataset array before rendering the dashboard rows.
* **State Management:** Ensure the icon dynamically appears/disappears upon the periodic refresh of the dashboard data (synced with the `SYNCED: HH:MM:SS` timer).

### Backend / Data Pipeline (If logic is handled server-side)
* **API Response Update:** Compute the `isUptrendPullback` boolean and pass it in the JSON payload for each asset.
* **Example payload addition:** `"isUptrendPullback": true`.

## 5. Edge Cases & Testing Protocol
* **Missing Data:** If an asset lacks `1M`, `1W`, or `1D` moving average data, the Uptrend Pullback should default to `false`.
* **UI Overflow:** Test the placement of the 'P' icon alongside the Golden Star on smaller screens to ensure it doesn't cause the ticker symbol to break onto a second line awkwardly.
* **Filter Stacking:** Ensure the logic handles UI states where a user might attempt to toggle BOTH the Golden Star filter and the Uptrend Pullback filter simultaneously (determine if they should be mutually exclusive or logically combined).