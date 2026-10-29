# CalorieIQ development notes

Current local candidate: **2.6.0-dev.1**, generation **7**. See [V2.6-RELEASE.md](V2.6-RELEASE.md) for current features, verification and limitations. The original implementation notes below are historical.

## Original 2.0 checkpoint

All six roadmap areas have local implementations. Nothing is deployed automatically.

## Verified in this workspace

- 14 passing Node core tests: conversions, migration, malformed/nested imports, unknown nutrition, recipe/history snapshots, failed writes, stale revisions, profiles and backup round trips.
- Passing Microsoft Edge browser checks at a 390px mobile viewport and desktop: logging, edit/delete/Undo, safe rendering, goals, recipes, meal creation, profiles, weight, invalid restore, valid restore/recovery, export, mocked barcode lookup, migration, offline shell and scanner availability, and mobile horizontal overflow.
- Real bundled ZXing empty-frame handling and simulated camera start/stop and pending-permission cancellation. These simulations do not establish physical camera recognition performance.
- JavaScript syntax checks and Git whitespace check. Screenshots inspected for mobile/desktop layout.
- No production API requests, iPhone hardware tests, existing hosted-installation update test, Git commits, pushes or deployments performed.

## Architecture

- `core.js`: versioned data schema, full backup validation, legacy migration, nutrition conversions, recipe snapshots, revision-checked writes.
- `app.js`: safe DOM rendering, diary/library/profile interactions, API access, backup and update UI.
- `scanner.js`: cancellable camera sessions, native detection with ZXing fallback, photos, supported torch/zoom, cleanup on background/exit.
- `styles.css`: responsive light/dark design, touch targets, safe-area spacing.
- `sw.js`: complete versioned offline shell, including the locally bundled scanner.

Records use stable IDs. Diary records carry per-base nutrition, quantity, unit, meal and source. Unknown nutrients are `null`; totals show an asterisk when incomplete. Recipe ingredients and logged foods are snapshots so future edits cannot rewrite historical totals.

## Local development

Requires Node 20+; no build or package installation is needed for the app:

```
npm start
npm test
```

Open http://127.0.0.1:4173. Camera access on a physical phone requires HTTPS; phone access to an ordinary HTTP LAN address is not sufficient.

For optional browser verification, install Playwright separately, set `PLAYWRIGHT_PATH` to the package path, then run `node tests/browser.cjs` while the preview server is running. This test uses installed Microsoft Edge and does not require production food-service requests. Mocked data verifies parsing, not service availability.

## Storage and migration

Version 1 logs migrate once into `calorieiq-v2`, preserving totals, dates and daily calorie goals. Original `calorieiq-v1` data is retained. Never clear browser data to update the app.

Import accepts validated legacy and version 2 JSON, with a 10 MB limit. The complete candidate is validated before any replacement. Current data is stored as `calorieiq-recovery-v2` before restore. Failed candidate writes leave the current database unchanged. An unreadable startup database blocks saving and can be downloaded for recovery.

The app retains localStorage and the version 2 schema. The reliability changes add a session-wide exclusive Web Lock: one tab can save; other tabs are read-only and retain their drafts. Startup/migration writes, normal saves and restore require ownership. Ownership ends on page exit and is rechecked on back/forward restoration. Complete stored-string and revision comparisons also reject replacement/deletion conflicts. Browsers without Web Locks fail closed to read-only access. Older app versions do not participate in the lock: close old-version tabs before upgrading. This is not cross-device synchronization or protection against unrelated same-origin scripts. Browser eviction and device loss still require external backups.

The 2.3 interface uses only the existing active local user. Profile controls are removed; the underlying version-2 profile structure remains for backup compatibility, without deleting archived records. No authentication or synchronization is added. Unsaved forms and recipe drafts are retained during navigation and saved to per-tab sessionStorage for reload recovery. Replacing drafts or restoring data requires confirmation. Session storage may fail or disappear when the tab/session closes; download important drafts before closing. Draft downloads are separate from restorable diary backups. The chart table provides exact nutrition values and weight entries provide exact weigh-ins. Gaps in calorie data are omitted from charts rather than assumed to be zero.

See RELIABILITY.md for the six-issue reliability work, compatibility policy and regression results. The original verification list above describes the initial implementation before the local checkpoint was created.

## Release procedure (current)

1. Run all Node and browser suites. Development test data resets once per new build.
2. Advance BOTH build ID and generation in `build-config.js`. The service-worker cache name derives from the build ID. Add every new browser module to its shell assets.
3. Verify the previous installed service worker updates to a waiting worker, development reset happens exactly once (or production data persists), activation works, and reload uses one coherent asset version.
4. Deploy the complete root folder, including icons and vendor assets, only after authorization. Do not deploy tests or local tools if using a packaging workflow.
5. Test offline reload and export/restore on the deployed HTTPS origin.

## Physical iPhone acceptance checklist — still pending

- Safari and Home Screen app on older/newer iPhones; normal and larger text; VoiceOver; dark mode and landscape.
- Camera permission allow/deny; repeated start/stop while permission is pending; lock/unlock, background/return and interrupted tracks.
- UPC-A, UPC-E, EAN-8 and EAN-13; glare, dim light, curved packaging; photo decoding; supported torch/zoom controls.
- Record recognition success and time to recognition; verify camera indicator turns off on Stop and navigation.
- Online name search and barcode lookup, service throttling, timeout, unknown product and incomplete nutrition. Confirm current Open Food Facts response shape, CORS and regional availability.
- Real package serving values for solids and liquids. Standardized OFF `_100g` values can describe liquids; the UI asks users to verify g/ml against the label rather than guessing volume from arbitrary package text.
- Native iOS backup download/Files restore and migration from an existing installation.
- Existing-installation service-worker update, offline restart, family profile isolation and backup round trip.

## Service use

Open Food Facts calls happen only on explicit search/lookup. Name search uses the full-text CGI endpoint; barcode lookup uses API v3. Local limits are conservative and coordinated across supported same-origin tabs using Web Locks and local rate state; they are not globally coordinated across devices/IPs. No API key is embedded. Complete Open Food Facts app registration/usage identification before a public release, using the project owner's contact details. No registration or message has been submitted on the owner's behalf.

No subscription, advertisements, analytics, account service, or paid backend was added.
