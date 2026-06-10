# Implementation Plan: "Golden Star" Prime Entry Signal

We will introduce a visual "Golden Star" indicator on the dashboard that identifies optimal "Buy Now" entry points for assets. This feature caters specifically to long-term investment decisions of 3-5 years.

---

## User Review Required

> [!NOTE]
> The star will appear to the left of the asset/stock name when a highly specific multi-timeframe alignment occurs, signaling that a macro uptrend is experiencing a deep, structural pullback.

---

## Proposed Changes

### Frontend UI Updates

#### [MODIFY] [src/App.tsx](file:///c:/Users/eltig/antigravity/pineAlgo/src/App.tsx)
- **Asset Row Component:** Modify the grid/table row component responsible for rendering the ASSET column to display the star icon next to the ticker symbol.
- **Header Filter Toggle:** Add a clickable star icon to the main table/grid header next to the "ASSET" label.
- **Filtering Logic:** Add `showGoldenStarsOnly` state to filter the rendered list when toggled.
- **Tooltips:** Add a tooltip on hover stating: "Prime Entry: Macro Uptrend with Deep Structural Pullback".

### Core Logic & Algorithm

The asset receives the Golden Star if it meets ALL of the following criteria:
1. **Macro Trend Confirmation:**
   - `1W` = `Buy Zone`
   - `1M` = `Buy Zone`
2. **Deep Value Setup:**
   - `1D` = `Value Zone`
   - `4H` = `Value Zone`
3. **Micro-Bleed Entry:**
   - `1H` = `Value Zone` OR `Sell Zone`

---

## Verification Plan

### Automated Tests
- Run `npm run lint` to verify TypeScript type compliance.
- Run `npm run build` to verify compiling.

### Manual Verification
- Verify that assets meeting the exact criteria render a gold star next to their tickers.
- Verify the header filter toggle filters the list correctly.
- Verify hover tooltips display correctly.
