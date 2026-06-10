# Task Checklist: Codebase Reorganization & Cleanup

- [x] Create `tests/` directory
- [x] Move scratch and testing scripts to `tests/`
  - [x] Move `test-*.ts` and `test-*.mjs` files from root
  - [x] Move `verify-local.ts` and `find-settimeframe.ts` from root
  - [x] Move `app/applet/test-stocks.mjs` to `tests/` and remove empty `app/` folder
- [x] Delete duplicate files in root
  - [x] Remove `star_feature.md`
  - [x] Remove `uptrend_pullback_feature.md`
- [x] Document project structure
  - [x] Create `CLEANUP.md` in root directory
- [x] Verification
  - [x] Run `npm run build` to verify compiling
  - [x] Run `npm run lint` to verify TypeScript types
