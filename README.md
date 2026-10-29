# CalorieIQ

A free, local-first food log, multi-source nutrition and weight tracker for iPhone and desktop. No account,
subscription, advertisements, or paid backend.

**Development mode is enabled.** Each new ID/generation in `build-config.js`
clears CalorieIQ test data once. Reopening the same version keeps new entries.
Set `development:false` before production. See [SERVING-UPDATE.md](SERVING-UPDATE.md)
for serving-size rules, real API findings, and reset details.

## Features

- Orange-and-blue Food Log with a single meal selector and edit/duplicate/move/delete with Undo
- Previous/next/today date controls, calendar and copying from any logged day
- Add Food search/manual and barcode paths; secondary access to quick add, saved meals, day reuse
- Favorites, saved/custom foods, recent and frequent food shortcuts inside Add Food
- Persistent calorie/macro goals, optional nutrient targets and daily overrides
- Daily Nutrition with independent date arrows, saturated fat, fiber, sugars, sodium, cholesterol and potassium
- Optional calcium, iron, magnesium, vitamins C/D/B12 and total folate
- Optional adult maintenance-calorie estimate, applied only after reviewing/saving goals
- Explicit serving/gram/milliliter quantities and incomplete-nutrition indicators
- Unified saved-food, USDA Foundation/SR Legacy/FNDDS and Open Food Facts search
- 13,588 real local USDA reference records, loaded on demand with source provenance
- Exact/padded barcode lookup with latest saved corrections taking priority
- Local camera and photo barcode scanning, with supported torch and zoom
- Recipe builder with ingredient snapshots and configurable servings
- Reusable meal templates and package portions when quantities support conversion
- Pounds by default, editable starting/current/goal weights, dated edits, 7/30/90-day and all-time interactive trends
- Personal profile with feet/inches height, adult calorie estimates for lose/maintain/gain, and explicit manual targets
- Pumpkin-orange/black branding with updated favicon, Apple touch icon and maskable PWA icons
- Collapsed Settings → Data & Backups with validated restore and recovery tools
- Single-user interface per installation; existing active records and older backup profiles retained
- Validated JSON backup/restore, recovery snapshot and legacy-data migration
- Offline app shell, scanner and saved foods; previously downloaded USDA details work offline
- Responsive light/dark interface; no full database precache

## Run locally

With Node 20 or later:

```
npm start
npm test
```

Open http://127.0.0.1:4173. No build or dependency installation is needed.
Physical phone camera access requires HTTPS.

## Data and privacy

Tracking records are stored in this browser, except explicit food searches and barcode
queries sent to Open Food Facts. USDA reference files come from this site without an API key. Camera images stay on the device. Export backups
regularly; browser storage can be erased. Installations do not sync or provide
password protection. Backups retain all stored records, including profiles from earlier versions, unencrypted.

Outside development resets, validated version 1 and version 2 backups remain supported.
Development releases intentionally clear only CalorieIQ-owned test storage once per build.
Never clear all browser/site data just to install an update.

See [DEVELOPMENT.md](DEVELOPMENT.md) for architecture, verification, release
procedure, known limitations and pending physical iPhone acceptance checks.

Published via the existing GitHub Pages configuration (`main`, repository root).
Version 2.5 is prepared for the authorized release through the existing Pages configuration.
See [V2.5-RELEASE.md](V2.5-RELEASE.md) for release checks and remaining physical iPhone acceptance work.
See [MULTISOURCE-REPORT.md](MULTISOURCE-REPORT.md) for source counts, verification and limitations,
and [data/usda/README.md](data/usda/README.md) for reproducible imports. USDA Branded and CNF are not bundled.
