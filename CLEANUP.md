# PineAlgo Project Organization & Cleanup

This document describes the updated project structure and directory organization established to follow coding best practices.

---

## 📂 Project Directory Structure

```text
pineAlgo/
├── .antigravity/        # Antigravity session planning, walkthroughs, and templates
│   ├── feature_ideas.md
│   ├── multi_pc_sync.md
│   ├── star_feature.md
│   └── uptrend_pullback_feature.md
├── api/                 # Express Backend Server (Express API, Yahoo Finance queue, etc.)
│   ├── index.ts
│   └── summary-cache.json
├── dist/                # Compiled production distribution files (Git-ignored)
├── scratch/             # Scratch space for temporary single-file analysis code
│   └── enrich-sectors.ts
├── src/                 # Frontend React Client (Vite, TailwindCSS, Lucide-React, Motion)
│   ├── App.tsx          # Main React Application
│   ├── index.css        # Global CSS stylesheet & Tailwind setup
│   └── main.tsx         # React mount point
├── tests/               # Consolidated testing, scratch scripts, and utility tools
│   ├── find-settimeframe.ts
│   ├── verify-local.ts
│   ├── test-stocks.mjs
│   ├── test-stocks-applet.mjs
│   └── test-*.ts        # Custom playground scripts for ticker, chart, and queue testing
├── .env.example         # Example configuration file for environment variables
├── .gitignore           # Git ignore rules
├── index.html           # Main frontend entry point page
├── package.json         # Project metadata, dependencies, and execution scripts
├── README.md            # General project overview
├── tsconfig.json        # TypeScript compile configuration
├── vercel.json          # Deployment configuration for Vercel Serverless Functions
└── vite.config.ts       # Vite configuration file
```

---

## 🔧 Organization and Cleanup Details

1. **Root Directory decluttering:**
   - Moved **30 standalone files** (prefixed with `test-*`, `find-*`, and `verify-*`) into the new `tests/` directory at the project root. This dramatically simplifies root navigation and isolates test/utility code.
2. **Consolidated Documentation:**
   - Removed duplicate `star_feature.md` and `uptrend_pullback_feature.md` files from the root directory. They are now located and tracked solely in `.antigravity/` to prevent duplicate docs and confusing sync issues.
3. **App folder elimination:**
   - Moved `app/applet/test-stocks.mjs` to `tests/test-stocks-applet.mjs` and deleted the empty `app/` folder, removing unnecessary nested folders.
4. **Preserved Core Context:**
   - Kept `api/` (backend) and `src/` (frontend) folders fully clean, leaving only active production application code inside them.
