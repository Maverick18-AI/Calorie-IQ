# CalorieIQ

A free, local-first nutrition and weight diary for iPhone and desktop. No account,
subscription, advertisements, or paid backend.

**Development mode is enabled.** Each new ID/generation in `build-config.js`
clears CalorieIQ test data once. Reopening the same version keeps new entries.
Set `development:false` before production. See [SERVING-UPDATE.md](SERVING-UPDATE.md)
for serving-size rules, real API findings, and reset details.

## Features

- Orange-and-blue daily dashboard, four meals, edit/duplicate/move/delete with Undo
- Previous/next/today date controls, calendar and copying from any logged day
- Quick-add calories with optional macros; favorites, recent and frequent food shortcuts
- Persistent calorie/macro goals, optional nutrient targets and daily overrides
- Daily/weekly nutrition, saturated fat, fiber, sugars, sodium, cholesterol and potassium
- Optional adult maintenance-calorie estimate, applied only after reviewing/saving goals
- Explicit serving/gram/milliliter quantities and incomplete-nutrition indicators
- Open Food Facts name search and barcode lookup; recent/saved/custom foods
- Local camera and photo barcode scanning, with supported torch and zoom
- Recipe builder with ingredient snapshots and configurable servings
- Reusable meal templates and package portions when quantities support conversion
- Weight goals, start/current/change/remaining, 7/30/90-day trends and optional 7-day averages
- Separate local family profiles and profile-specific goals/libraries
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

Everything is stored in this browser, except explicit food searches and barcode
queries sent to Open Food Facts. Camera images stay on the device. Export backups
regularly; browser storage can be erased. Profiles do not sync between devices
and do not provide password protection. Backups contain all profiles unencrypted.

Outside development resets, validated version 1 and version 2 backups remain supported.
Development releases intentionally clear only CalorieIQ-owned test storage once per build.
Never clear all browser/site data just to install an update.

See [DEVELOPMENT.md](DEVELOPMENT.md) for architecture, verification, release
procedure, known limitations and pending physical iPhone acceptance checks.

Published via the existing GitHub Pages configuration (`main`, repository root).
See [V2.2-RELEASE.md](V2.2-RELEASE.md) for scope, tests and physical iPhone checks.
