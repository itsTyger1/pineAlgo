# Implementation Plan: "Uptrend Pullback" Entry Signal

We will introduce a visual "Uptrend Pullback" (P) indicator on the dashboard that identifies assets currently in a strong macro uptrend but experiencing a short-term, micro pullback. This allows users to spot favorable entry points before the trend resumes.

---

## User Review Required

> [!NOTE]
> The 'P' icon/badge will appear to the left of the ticker symbol (and to the left of the Golden Star) when macro and micro timeframes align to signal a pullback setup.

---

## Proposed Changes

### Frontend UI Updates

#### [MODIFY] [src/App.tsx](file:///c:/Users/eltig/antigravity/pineAlgo/src/App.tsx)
- **Asset Row Component:** Modify the asset column to render the 'P' icon/badge to the left of the Golden Star icon.
- **Header Filter Toggle:** Add a clickable 'P' icon next to the "ASSET" label.
- **Filtering Logic:** Add `showPullbacksOnly` state to filter list to pullback assets when toggled.
- **Filter Stacking:** Stack the Golden Star and Pullback filters logically (using an OR condition if both are active).

### Core Logic & Algorithm

The asset receives the 'P' icon if it meets ALL of the following criteria:
1. **Macro Uptrend:**
   - `1W` = `Buy Zone`
   - `1M` = `Buy Zone`
   - `1D` = `Buy Zone`
2. **Micro Pullback/Consolidation:**
   - `4H` = `Value Zone`, `Neutral Zone`, or `Buy Zone`
3. **Immediate Entry Trigger:**
   - `1H` = `Value Zone` or `Neutral Zone`

---

## Verification Plan

### Automated Tests
- Run `npm run lint` to verify TypeScript type compliance.
- Run `npm run build` to verify compiling.

### Manual Verification
- Verify that assets meeting the exact criteria render a 'P' badge.
- Verify the header filter toggle filters the list correctly.
- Verify filter stacking (toggling both shows assets that are either Golden Stars OR Uptrend Pullbacks).
