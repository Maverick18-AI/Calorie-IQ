# CalorieIQ multi-source nutrition update

This is the original implementation assessment before release authorization.
See [V2.4-RELEASE.md](V2.4-RELEASE.md) for the subsequent independent release review.

Local candidate: **2.4.0-dev.1**, generation **4**. Starting/published checkpoint:
`8a0a06eb4787481c001c4d5fa6e6418f983d86df` (2.3.0-dev.1).
Work is on `development/v2`; existing 2.3 work was clean and preserved. This
update is **uncommitted and unpublished for review**. Main and the existing live
site were not modified. No credentials, accounts, backend, proxy, paid service,
analytics, dependency installation or destructive Git operation was added.

## 1. Sources integrated and record counts

| Source | Local usable records | Release |
|---|---:|---|
| USDA Foundation | 364 | 2026-10-29 |
| USDA SR Legacy | 7,793 | 2018-04 |
| USDA FNDDS | 5,431 | 2021–2023, 2024-10-31 export |
| **Total local USDA** | **13,588** | Separate identifiable source records |
| USDA Branded | 0 | Evaluated; not downloaded/imported |
| Canadian Nutrient File | 0 | Evaluated; deferred |
| Open Food Facts | Live/cached queries, not a bundled catalogue | Existing provider retained |

The official exports contained 424/7,793/5,432 records respectively. Foundation
excluded 50 without usable energy and 10 with invalid/negative tracked nutrients;
FNDDS excluded one without nutrition. 169 included records carry conservative
quality warnings. None were silently repaired. Counts describe real reference
records/variants, not distinct manufacturer products or artificially generated foods.

USDA Branded's current JSON archive is listed around 187 MB compressed / 3 GB
expanded. It was not downloaded, and no live keyed USDA API runs in the browser.
A future option is an approved desktop import of a limited product selection,
using an owner's API key only in that local process, or an approved large-export
filter. Neither requires embedding a key in Pages. New private credentials or
large downloads would need approval. Current packaged-food coverage remains OFF
plus saved physical-label corrections. Cross-USDA-Branded barcode coverage is
therefore not claimed or tested as a shipping feature.

The CNF 2026 name/source tables contain 5,993 records, including **3,529 marked by
Health Canada as unchanged USDA data**. The other records are not automatically
2,464 new unique foods. CNF offers regional/changed foods and up to 173 nutrients,
but a third relational nutrient/portion import and separate release/licence
maintenance are deferred until concrete Canadian coverage gaps justify it.
`data/cnf-evaluation.json` records the official source classifications/licence;
no Canadian nutrient values were fabricated or counted as integrated.

## 2. Unified search and provider architecture

- `search.js` handles normalization, relevance, source combination, cancellation
  and barcode identity. Provider adapters live in `providers/`.
- Saved foods/corrections/recipes are searched first; USDA and OFF run independently
  and update the same result list. An unavailable provider cannot erase working
  results. Internet failures retain local USDA/saved matches.
- Relevance uses query words, phrase/short-name matches and source weighting.
  Potato/plural and yogurt/yoghurt normalization are supported. Explicit preparation
  words remain significant. Raw/cooked/skin variants are not merged.
- Results retain source/record IDs and release; review details expose retrieval,
  licence, original basis and a validated original-record link.
- Barcode lookup prefers the latest saved exact/canonically padded correction,
  then the local product cache, then OFF. UPC-A/EAN-13/GTIN-14 zero padding is
  recognized; ambiguous short codes are not guessed into another barcode format.
- Same-provider record duplicates and overridden barcodes are suppressed. Different
  records with different values remain separate; values are never averaged.
- Selecting USDA loads the complete reference detail before food review/logging.
  Diary entries, saved foods, meals and recipes retain snapshots/provenance.

## 3. Nutrients and accuracy

The existing ten fields remain. New optional tracked fields are **calcium, iron,
magnesium, vitamin C, vitamin D, vitamin B12 and total folate**. New daily rows
appear only when supplied/configured and are grouped under More micronutrients.
Missing values stay unknown; recorded zeros stay zero.

USDA original per-100-g values, nutrient IDs/numbers, units, energy variant,
reference portions/measurement IDs, release and retrieval metadata are preserved.
OFF retains its original standardized field names/values/units as well as declared
and selected bases. Gram/milligram/microgram and kJ/kcal conversions are explicit;
no gram/ml density or missing nutrient is inferred. Specific Atwater energy is
preferred when present, without averaging energy variants. First documented usable
household portions are offered by default; other portions remain in provenance.

Quality checks cover invalid/negative values, missing energy, macro/energy
disagreement, excessive macro mass, saturated fat greater than total fat,
contradictory portions/packages and stale manufacturer dates. Source warnings and
local label corrections remain visible. Boolean/whitespace nutrient input no
longer becomes a fabricated numerical value. USDA warnings use a reference-record
review acknowledgment, rather than falsely asking for a manufacturer package label.

## 4. Storage, performance and offline behaviour

| Measurement | Result |
|---|---:|
| Search index, raw | 1,326,952 bytes |
| Search index, calculated gzip | 299,940 bytes |
| Manifest | 11,589 bytes |
| Detail shards | 76 |
| All detail data, raw | 9,667,791 bytes |
| Largest individual detail shard | 128,000 bytes |
| All detail data, calculated gzip | 1,058,268 bytes |
| USDA disk-cache budget | 8 MB per catalogue version |
| USDA detail shards retained in JS | 4 |
| OFF response cache | At most 24 entries / 4 MB; search 30 minutes, products 24 hours |

Calculated gzip is not a measured cellular transfer size or hosting guarantee.
The first USDA search needs manifest + index; selecting a food needs its detail
shard. Later searches reuse the index. OFF may add one online query. No large
catalogue is precached by the service worker; only provider code joins the shell.
Hash checks detect index/detail mismatch and discard a corrupted derived cache
entry. A cached index alone does **not** make every food available offline.
Offline tests verified downloaded egg details work while an uncached rice detail
shows an explicit reconnect message. Saved food snapshots remain independent.

Final representative Edge run at 393×852, **4× desktop CPU throttling**, local HTTP:
about **190 ms cold**, **80–92 ms warm**, and **4.0 MB retained JS-heap increase**
for the catalogue. This is neither physical iPhone performance nor total/peak
Safari process memory. The ignored `test-results/search-performance.json` records
exact run values; timings vary. Three USDA requests covered initial search plus
one detail selection. No raw archive is sent to a phone.

## 5. Reproducibility and development storage

`scripts/download-usda.ps1` fetches only the three pinned official archives, about
18 MB compressed, with size bounds and checksums. Extracted input plus archives
is about 304 MB of ignored PC scratch space in `.source-data/`, not a repository
or app download. The input is retained for reproducibility, not deleted.
`scripts/import-usda.mjs` validates source hashes, maps official exports, emits
versioned assets, and records exclusions. A separate rebuild matched all **78**
manifest/index/detail files byte-for-byte. See `data/usda/README.md` for commands.

Imports do not read/reset localStorage or advance build IDs. The build was kept at
2.3 throughout research/import and advanced to 2.4/generation 4 only when preparing
this tested release candidate. The existing development reset remains one-time
per installed build; actual browser data was not reset by these isolated tests.
Production-mode preservation, v1/v2 backup support, the writer lock and revision
checks remain. No migration or historical-nutrition rewrite was introduced.

## 6. Testing performed

- **68 Node tests passed**, including 15 new provider/search/cache tests.
- Original browser suite, **11 reliability**, **4 serving**, **8 adapted 2.2**,
  **6 existing 2.3**, **7 new multi-source scenarios**, and the service-worker
  development/production update scenario passed in the final full run.
- Real USDA fixtures cover egg, cooked chicken breast, raw potato, cooked white
  rice, banana, ground beef and plain Greek yogurt with FDC IDs and retrieval date.
- Quantities cover 1/.5/2 reference servings, 100 g, 40 g, missing nutrients,
  differing sodium conventions, mixed-dataset recipes, and saved history snapshots.
- Three dated OFF fixtures cover the two inaccurate Ritz records and a real
  packaged reference product. Saved correction priority is verified for padded UPCs.
- Tests cover 429, 503, timeouts, malformed JSON/HTML, cancellation, unknown products,
  rate budgets, cache retrieval dates, hash corruption, all detail shards and cache
  size limits. No nutritional constants were invented to make fixtures pass.
- Full search→review→log→save/edit→Nutrition/export flow, partial offline behaviour,
  camera accessibility, five-tab responsive layouts and light/dark checks passed.
- Live browser Nutella lookup succeeded. Live banana search kept 24 USDA results
  despite an OFF search transport failure. Source repro/syntax/Git whitespace checks
  passed. No package or browser installation was performed.

Intermediate failures were fixed rather than hidden: pending empty results no
longer create an empty-state paragraph; an old search test now selects its named
fixture among multiple sources, and its outage test uses an uncached query.
These changes retain the original assertions about parsing and outage handling.

## 7. OFF availability, identification and licensing

The documented Search-a-licious endpoint returned real JSON to a server-side
request, but lacked browser CORS permission and failed the browser fetch test.
It is not used by the app, and no unauthorized proxy was added. Structured API v2
was not substituted for full-text search. CGI remains the online name-search path.

Requests are explicit submissions, not search-as-you-type. The client budget is
8 searches and 12 product queries/minute, coordinated across supported same-origin
tabs with Web Locks/local rate state. Server/IP limits still apply. 429 causes a
cooldown; 503/malformed/timeout/network failures give source-specific explanations
without discarding USDA/saved results. Cache hits avoid additional API requests.

Requests include public app name/version identification and configure the project
URL in User-Agent. **Desktop Chromium dropped the custom User-Agent**, as observed
in the live check; app query identification remained. Do not claim full custom-UA
delivery on all browsers. An anonymous OPTIONS check confirmed the product endpoint
allows User-Agent in CORS; the CGI search check returned 503. This is not a
physical Safari verification. Owner completion of OFF's usage/registration form and
confirmation of its preferred browser identification are still needed before
broader public use. No form, account, message or private credential was submitted.

USDA is CC0/public domain; OFF remains ODbL/DbCL with attribution and provenance;
OFF data/fixtures are separate from the USDA catalogue and not relabelled CC0.
CNF is Open Government Licence – Canada 2.0 and deferred. Mixed-source personal
recipes retain ingredient provenance; exporting/sharing provider-derived data must
respect its original licence. No paid API/infrastructure is required for this build.

## 8. Files and Git status

Modified: `.gitignore`, `app.js`, `build-config.js`, `index.html`, `nutrients.js`,
`nutrition.js`, `package.json`, `sw.js`, `README.md`, `DEVELOPMENT.md`,
`tests/browser.cjs`, `tests/v22.cjs`.

Added: `search.js`, `providers/{usda,catalogue,off}.js`, three `scripts/` import/
evaluation tools, versioned `data/usda/` files and source report/README,
`data/cnf-evaluation.json`, `tests/providers.test.js`, `tests/multisource.cjs`,
dated `tests/fixtures/` reference files/README, and this report.

The final review covered 107 modified/untracked files (about 11.2 MB), including
78 intentional generated catalogue assets. Automated secret-pattern and artifact
checks found no credentials or generated test artifacts among these files.
Raw exports, rebuilds, screenshots and runtime measurements remain ignored; no
significant files were deleted. Review remains uncommitted on `development/v2`.
No push, deployment, force operation, other task's work or `main` change occurred.

## 9. iPhone testing readiness and remaining limits

Ready for **approved HTTPS deployment and physical iPhone testing**; the current
public site is not this candidate. iPhone Safari/Home Screen/VoiceOver/camera and
real cellular/low-memory performance were not physically tested here. Check common
ingredients, fractions/grams, labels, saved UPC corrections, mixed recipes, extra
nutrients, reload/offline cache gaps, backup restore and installed-worker update.

USDA reference averages do not guarantee a package's label. Branded USDA coverage
and CNF nutrient integration remain explicitly deferred. Only the first useful
USDA portion is offered directly; alternate measures remain in provenance and can
be checked against the source. Browser storage may be evicted. OFF can remain
unavailable or incorrect. No claim of MyFitnessPal-scale manufacturer coverage,
complete offline catalogue, new private accounts or synchronization is made.

## Official references

- [USDA downloads](https://fdc.nal.usda.gov/download-datasets/) and
  [API/key/licensing guide](https://fdc.nal.usda.gov/api-guide/).
- [OFF API limits, identification and search](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/),
  [Search-a-licious](https://openfoodfacts.github.io/search-a-licious/users/ref-openapi/),
  [licensing](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/).
- [Health Canada CNF 2026](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/canadian-nutrient-file-about-us.html),
  [dataset](https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109),
  [Canadian licence](https://open.canada.ca/en/open-government-licence-canada).
