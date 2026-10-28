# Serving review and development builds — 2.1.0-dev.1

## Development reset is enabled

`build-config.js` is the single build configuration shared by the app and worker.
For each new development deployment, increment **both** the explicit `id` and
monotonically increasing integer `generation`. The current values are
`2.1.0-dev.1`, generation `1`, `development:true`.

On first use of that build, the editing tab replaces the CalorieIQ database with
a fresh database and removes other `calorieiq-` local-storage keys, including
legacy data, recovery, and product cache records. All profiles, goals, foods,
recipes, meals, weights and backup metadata live in the replaced database.
App-prefixed session drafts are cleared when that tab first uses the new build.
The build marker is written only after the reset succeeds. Other origins and
non-CalorieIQ keys are untouched. Downloaded files are never deleted.

This is explicitly authorized test-data disposal, not a production migration.
Subsequent opens of the same build preserve data. A higher generation marker
blocks older code before reset/write, preventing cached-build rollback loops.
Only the existing exclusive writer may initialize a build. Close older editing
tabs if a new tab cannot initialize. A new worker precaches coherent assets and
notifies development clients to reload after activation; the already-published
pre-build-version app may need a refresh/close-and-reopen to adopt this first build.

Before production, set `development:false` and advance the ID/generation.
Production updates advance the marker without deleting diary data or drafts;
automatic worker activation/reload is also disabled. The browser tests verify
this transition. Do not reset the generation counter or reuse an ID for new code.

## Nutrition and conversion

`nutrition.js` implements and `core.js` re-exports product parsing. API requests
include `serving_size`, `serving_quantity`, `serving_quantity_unit`, declaration,
package metadata and nutriments. Manufacturer serving description and explicit
mass/volume are kept separate from the base nutrition and quantity eaten.

- Existing per-serving values take priority as a complete group; missing macros
  stay unknown instead of borrowing incompatible per-100 values.
- When only per-100 data exists, serving values are derived only with a known
  compatible mass or volume. An explicit 40 g portion of verified per-100g
  nutrition uses a 0.4 multiplier. Milliliters are never assumed equal to grams.
- Serving conversions change both base quantity and eaten quantity while keeping
  nutrition for that base intact. Trace metadata records the original source,
  both nutrient bases, chosen basis and derivation multiplier. Snapshots preserve
  this through saved foods, recipes and diary edits.
- Conflicting serving metadata disables automatic conversion. Missing units
  require confirmation. Significant nutrient conflicts, implausible macro mass
  and tiny 1g/1ml database portions show review warnings. Suspicious records
  require an explicit label-review acknowledgment before logging.
- Users can correct the serving description, mass and label nutrition, and save
  a barcode-linked food. Profile-specific corrections take priority over the
  general product cache on rescans. Production logic has no food-specific rules.

## Genuine external API findings (October 28, 2026)

Direct API v3 reads of the user-supplied Ritz UPCs succeeded:

| UPC | Serving in OFF | kcal/100g | kcal/serving | Observation |
| --- | --- | --- | --- | --- |
| `044000077174` (box) | `1.0g`, quantity 1g | 130 | 1.3 | Does not match the user's 26g/130kcal label |
| `044000077365` (pack) | `1.0g`, quantity 1g | 520 | 5.2 | Also contains impossible macro values and conflicting energy data |

The old application chose the standard basis and therefore showed 130 kcal for
100g on the box record. That was both an application selection problem and a
source-data problem. The new app cannot truthfully infer 26g/130kcal from those
records: it flags them and allows package-label correction. It does not silently
substitute the provided test fixture into live products or change OFF records.

The Ritz manufacturer fixture is 26g, 130kcal, P2/C15/F7 per pack. The Aldi
fixture verifies 40/80/200g for 1/2/5 servings; its sample nutrition is explicitly
synthetic, not a claim about the real product. No Aldi barcode or verified
nutrition was supplied. Product-name search attempts returned non-JSON HTML;
the app now gives a useful fallback message for that response.

## Verification and remaining checks

- 39 Node tests, including serving arithmetic and generation-reset protections.
- Original browser suite and 11 reliability browser scenarios.
- Four serving-review browser scenarios, including corrected barcode overrides.
- Actual local service-worker updates across synthetic builds 101 → 102 → 103:
  reset once, clear old drafts/recovery, retain unrelated storage, reject stale
  code, work offline with the scanner library, and preserve data in production.
- An initial activation/navigation deadlock was caught and removed. Activation
  now posts an update message instead of awaiting navigation inside activation.
  The update test waits for actual activation rather than a transient waiting
  worker snapshot. All final suites passed before publication.

No physical iPhone test was performed by the agent. The user reported that the
existing scanner recognizes products on iPhone 16. Next check the new serving
controls, real label corrections, Safari/Home Screen updates, reset-once behavior
and offline reopen on that device. No paid dependencies or services were added.
