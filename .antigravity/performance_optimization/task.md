# Optimization Tasks

## Phase 1: Algorithmic Hotfix
- [x] 1a. Replace O(n²) chart indicator loop with single-pass rolling SMA/RSI
- [x] 1b. Replace `toLocaleString()` with cached `Intl.DateTimeFormat`
- [x] 1c. Remove filesystem I/O (`fs.readFileSync`, `saveSummaryCache()`)

## Phase 2: Caching Architecture
- [x] 2a. Add `Cache-Control` / `s-maxage` headers to all endpoints
- [x] 2b. summaryCache seeded at runtime via SECTOR_MAP lookups in getAnalysis()

## Phase 3: Reduce Data Volume & Sector Coverage
- [x] 3a. Expand `SECTOR_MAP` to 400+ symbols (from ~200)
- [x] 3b. Keep background `quoteSummary` for unknowns (removed disk writes only)

## Phase 4: Verification
- [x] 4a. Verify TypeScript compiles cleanly (`npx tsc --noEmit` = 0 errors)
- [x] 4b. Create walkthrough of changes
