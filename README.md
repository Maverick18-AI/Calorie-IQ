# CalorieIQ

A free, local-first calorie and macro diary for iPhone and desktop. No account,
subscription, advertisements, or paid backend.

**Development mode is enabled.** Each new ID/generation in `build-config.js`
clears CalorieIQ test data once. Reopening the same version keeps new entries.
Set `development:false` before production. See [SERVING-UPDATE.md](SERVING-UPDATE.md)
for serving-size rules, real API findings, and reset details.

## Features

- Daily diary with meal groups, edit, duplicate, delete/Undo and previous-day copy
- Persistent calorie/macro goals plus optional daily overrides
- Explicit serving/gram/milliliter quantities and incomplete-nutrition indicators
- Open Food Facts name search and barcode lookup; recent/saved/custom foods
- Local camera and photo barcode scanning, with supported torch and zoom
- Recipe builder with ingredient snapshots and configurable servings
- Reusable meal templates, weight records, weight and calorie trends
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

Existing version 1 diaries migrate automatically; the original storage key is
retained. Never clear site data to install an update.

See [DEVELOPMENT.md](DEVELOPMENT.md) for architecture, verification, release
procedure, known limitations and pending physical iPhone acceptance checks.

No GitHub push or deployment is part of this local implementation.
