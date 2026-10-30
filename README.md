# My Budget

Private, offline budget tracker (iPhone PWA). React + TypeScript + Vite + Tailwind + Dexie (IndexedDB) + Recharts + vite-plugin-pwa.
All data stays on the device. No accounts, cloud, or analytics.

## Commands
- `npm install` – install dependencies
- `npm run dev` – development server
- `npm test` – run the 36 formula / carry-forward / backup tests
- `npm run build` – production build into `dist/` (offline service worker included)
- `npm run preview` – serve the production build locally
- Hosting in a sub-folder (e.g. GitHub Pages): `BASE_PATH=/my-budget/ npm run build`

## Where things live
- `src/lib/finance.ts` – every formula (income, expenses, available, planned, balances, carry-forward, unallocated, validation)
- `src/lib/baseline.ts` – starting budget, income and allocation %
- `src/lib/db.ts` – local database, month plans, backup/restore, reset
- `src/lib/backup.ts` – backup validation and CSV export
- `src/screens/*` – Overview, Activity, Budget, Savings, History, Reports, Settings
- `tests/*` – automated tests

## Rules the app follows
- Actual totals come only from recorded transactions; nothing is pre-filled as "actual".
- Planned allocation = available × %. It is a guide only and never counted as savings.
- Savings deposits are recorded manually. Closing = opening + deposits; next month opens at this month's closing (computed live, so edits flow forward).
- Allocation % must total 100%; negative, zero or non-numeric amounts are rejected.
