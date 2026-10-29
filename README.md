# CalorieIQ

A free, local-first food log, nutrition and weight tracker for iPhone and desktop. No account,
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
- Optional adult maintenance-calorie estimate, applied only after reviewing/saving goals
- Explicit serving/gram/milliliter quantities and incomplete-nutrition indicators
- Open Food Facts name search and barcode lookup; recent/saved/custom foods
- Local camera and photo barcode scanning, with supported torch and zoom
- Recipe builder with ingredient snapshots and configurable servings
- Reusable meal templates and package portions when quantities support conversion
- Weight goals, start/current/change/remaining, 7/30/90-day trends and optional 7-day averages
- Single-user interface per installation; existing active records and older backup profiles retained
- Validated JSON backup/restore, recovery snapshot and legacy-data migration
- Offline app shell and scanner; responsive light/dark interface

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
queries sent to Open Food Facts. Camera images stay on the device. Export backups
regularly; browser storage can be erased. Installations do not sync or provide
password protection. Backups retain all stored records, including profiles from earlier versions, unencrypted.

Outside development resets, validated version 1 and version 2 backups remain supported.
Development releases intentionally clear only CalorieIQ-owned test storage once per build.
Never clear all browser/site data just to install an update.

See [DEVELOPMENT.md](DEVELOPMENT.md) for architecture, verification, release
procedure, known limitations and pending physical iPhone acceptance checks.

Published via the existing GitHub Pages configuration (`main`, repository root).
Version 2.3 is prepared locally; publication requires explicit approval.
See [V2.3-RELEASE.md](V2.3-RELEASE.md) for scope, verification and physical iPhone checks.
