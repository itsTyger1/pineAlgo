# Codebase Reorganization & Cleanup Plan

We will clean up and organize the project directories and files to follow modern web development best practices. Currently, the project root is cluttered with over 20 standalone scratch and test files, and duplicate markdown documentation files exist.

## User Review Required

> [!NOTE]
> This cleanup is structural and will not alter any functional application code in `api/` or `src/`. It moves development scratch scripts and test scripts into a consolidated `/tests` directory and removes duplicate setup documentation.

## Open Questions

None. The proposed folder structure is standard for clean Node/TypeScript projects.

## Proposed Changes

### Root Folder Cleanup

#### [DELETE] [star_feature.md](file:///c:/Users/ElTig/OneDrive/Documents/Antigravity/pineAlgo/star_feature.md)
* Remove the duplicate markdown file in the root, as it is already preserved and tracked in `.antigravity/star_feature.md`.

#### [DELETE] [uptrend_pullback_feature.md](file:///c:/Users/ElTig/OneDrive/Documents/Antigravity/pineAlgo/uptrend_pullback_feature.md)
* Remove the duplicate markdown file in the root, as it is already preserved and tracked in `.antigravity/uptrend_pullback_feature.md`.

---

### Tests and Scripts Consolidation

We will create a new `/tests` directory in the project root to house all standalone development, validation, and testing scripts.

#### [NEW] [tests/](file:///c:/Users/ElTig/OneDrive/Documents/Antigravity/pineAlgo/tests)
Create the directory and move the following files into it:
* `find-settimeframe.ts`
* All `test-*.ts` files (e.g., `test-4h.ts`, `test-screener.ts`, `test-yf.ts`, etc.)
* `verify-local.ts`
* `test-stocks.mjs` (moved from `app/applet/test-stocks.mjs`)
* `test-stocks.mjs` (the duplicate under the root directory)

#### [DELETE] [app/](file:///c:/Users/ElTig/OneDrive/Documents/Antigravity/pineAlgo/app)
* Delete the `app` folder once `applet/test-stocks.mjs` is moved, keeping the directory structure lean.

---

### Summary of Cleanup Documentation

We will add a new documentation file `CLEANUP.md` to the project root to explain the directory structure.

#### [NEW] [CLEANUP.md](file:///c:/Users/ElTig/OneDrive/Documents/Antigravity/pineAlgo/CLEANUP.md)
* Document the clean project layout, folder structure, and where dev scripts are located.

---

## Verification Plan

### Automated Tests
- Run `npm run build` to verify that the Express server and Vite React frontend compile and bundle perfectly. Since none of the moved scripts are referenced in package.json or application imports, the builds should remain 100% functional.
- Run `npm run lint` to verify that TypeScript compilation (tsc) completes without errors.
