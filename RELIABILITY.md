# Reliability fixes after the v2 checkpoint

Base checkpoint: `c6da74fd38a8fde5f15073b1e3d264cf8b31412b` on local `development/v2`.
The reliability changes are approved for a local checkpoint. No push or deployment is authorized.

## Behavior and compatibility

1. **Nutrition units:** `_100g` fields are read as a consistent group. Explicit `100g`/`100ml` declarations select mass/volume; an explicit serving declaration uses serving fields when available. No density or gram/milliliter equivalence is inferred from package or serving text. Ambiguous standardized data requires the user to select g or ml from the label before logging. Switching between unit types clears old nutrient inputs after confirmation instead of relabeling them. Base quantity changes remain manual label entry, not automatic conversion. API numeric data can still be wrong: verify real package labels.
2. **Weight:** switching kg/lb converts the entered number, including an edited record; blank input stays blank. Storage remains kg. Existing records are not rewritten when changing the selector. Small numeric rounding differences are possible, not a unit reinterpretation.
3. **Pending requests:** leaving Add Food aborts and invalidates requests. Even a response implementation that ignores AbortSignal cannot update results or reopen the view after navigation. Editing and replacing form contents still cancel obsolete requests.
4. **Drafts:** food, recipe, diary/library edits, goals, weight, profile-name and rename inputs are retained during navigation. Destructive replacement/context changes ask for confirmation. Per-tab `sessionStorage` key `calorieiq-drafts-v1` supports reload recovery; an unload warning and draft download are also provided. Drafts record profile/date/edit identity, not the entire saved family database. A compact base stamp requests explicit review when saved data differs; it is not a security hash. Actual save conflict checks compare the full stored string. Session storage is not a permanent backup and a draft download is not a diary-import file. It contains unencrypted personal draft information. Closing/clearing a tab may erase its session drafts.
5. **Recipes:** library recipes are validated against ingredient snapshot totals divided by yield (and multiplied by base servings), including propagation of unknown nutrients. A relative tolerance of 1e-8 accommodates floating-point round trips. Inconsistent recipes are rejected with a specific message before restore. The app never silently recalculates imported library recipes or historical diary/template/saved-food snapshots. Valid checkpoint-created v2 backups and v1 migrations remain supported; inconsistent or externally altered recipes must be corrected explicitly in a copy of the backup. Mass/volume recipe yields cannot be validated without additional yield data and are rejected; the existing recipe builder uses serving yields.
6. **Tabs:** an origin-scoped Web Lock named `calorieiq-v2-writer` grants one editing session. Other tabs can prepare/export drafts and read the saved diary but cannot save, restore or write migration data. Close the editing tab, enable editing in the other tab, and reload if its snapshot is stale; session drafts recover and need review before applying. Unsupported locking fails closed. No lock-stealing or lease timeout permits concurrent writes. A background tab can continue owning the lock until closed. Mixed old/new app tabs are not coordinated: close old-version tabs before an upgrade.

Data keys remain `calorieiq-v1`, `calorieiq-v2`, and `calorieiq-recovery-v2`; schema version stays 2. New product-cache metadata `requiresUnitConfirmation` is additive. Old applications do not enforce the new metadata or locking, so they must not be used to validate the safeguards. No user diary files were used for testing.

## Offline assets

The service-worker cache is bumped to `calorieiq-shell-v2.0.1-reliability` and includes `writer.js` so the app is cached coherently. No hosted update was performed. The existing local offline reload check passes; upgrading an actual old installed site still needs physical-device acceptance testing.

## Verification

- Core/lease tests: `node --test tests/*.test.js` (24 tests).
- Original browser suite plus reliability scenarios: `node tests/browser.cjs`, with an installed Playwright package supplied via PLAYWRIGHT_PATH and Microsoft Edge. No new package is needed. `tests/reliability.cjs` is invoked by that script.
- The browser scenarios cover label confirmation, no mass/volume relabeling, entered/edited kg/lb conversion, actual request abort plus ignored-abort late responses, draft retention/recovery and profile cancellation, recipe edits, goal/weight drafts, invalid recipe restore, unchanged historical recipe snapshots, simultaneous two-tab save attempts, lock takeover/draft review, unsupported locks and restoration of corrupt startup data.
- External food-service requests in tests are mocked or blocked. Tests use temporary browser contexts and synthetic local data. The original script writes the ignored diary screenshots.
- During development, an old error-message assertion needed updating. Two initial reliability checks needed waits for asynchronous UI completion. A later run exposed a real status-message race: first service-worker installation could overwrite a blocked-data warning. First installation no longer reports an update, and background update messages preserve blocked/read-only warnings. Subsequent complete runs passed. Physical iPhone camera performance and production API behavior remain unverified.

## Remaining acceptance work

Test real iPhone 16 Safari/Home Screen camera and Web Locks behavior, session-draft recovery after iOS interruption, kg/lb rounding over realistic inputs, real Open Food Facts field/unit variants, actual user-backup copies, and upgrades from an existing installed service worker. No live website, family account service, subscription, advertisement, analytics or paid dependency was added. Profiles remain organizational separation on one browser, not private authenticated accounts.
