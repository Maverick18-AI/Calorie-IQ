# USDA catalogue — CC0 reference data

Source: U.S. Department of Agriculture, Agricultural Research Service.
[FoodData Central](https://fdc.nal.usda.gov/), [downloads](https://fdc.nal.usda.gov/download-datasets/),
[CC0 licensing](https://fdc.nal.usda.gov/api-guide/#bkmk-6).

`sources.json` pins official archive URLs, release dates, retrieval date, and
SHA-256 hashes of both ZIPs and extracted JSON. `import-report.json` records
included/excluded counts. No Open Food Facts or Canadian food records are in
this directory.

The `usda-2026-10-v1/` bundle contains a small search index and 76 detail shards,
not the raw export. It includes 364 Foundation, 7,793 SR Legacy and 5,431 FNDDS
records. These are reference records/variants, not a claim of 13,588 distinct
manufacturer products. Similar names from different references remain distinguishable.

## Reproduce

From the project root, with existing PowerShell and Node (no installs):

```powershell
.\scripts\download-usda.ps1
node scripts/import-usda.mjs
node --test tests/*.test.js
```

Downloads are about 18 MB compressed. Each archive is bounded at 20 MB and its
single JSON entry at 260 MB; changed hashes/contents stop the process. Raw files
remain in ignored `.source-data/` and are not application or GitHub Pages assets.
The three JSON exports total 286,402,592 bytes before ZIPs; this is PC import
scratch space, not a phone download. No user database or build configuration is
read or changed by the importer.

The output is deterministic. A rebuild into `test-results/catalogue-rebuild`
matched all 78 manifest/index/detail files byte-for-byte. To refresh, review new
official releases and units, pin new hashes/retrieval metadata, choose a new
catalogue version, regenerate, update `CATALOGUE_VERSION` in
`providers/catalogue.js`, and run the tests. Advance the app build only when
preparing a new release. Never reuse an immutable catalogue version for changed data.

## Normalization

- USDA values are per **100 grams**, including milk and other liquids. No ml
  density is inferred. Only explicit source gram weights establish portions.
- Tracked nutrient IDs and definitions appear in the manifest. IDs 2048, 1008,
  2047, then 1062 are the energy preference order: specific Atwater, ordinary
  reported kcal, general Atwater, then kJ converted by 4.184. Energy values are
  not averaged. Original alternative IDs/values remain in provenance.
- g/mg/µg conversions are dimensionally explicit. Missing values remain null.
  Negative/invalid tracked nutrients reject the import record. Records lacking
  usable energy are excluded. Known zeros stay zero.
- The first documented usable household portion is offered by default; RACC and
  unspecified quantities are not presented as household portions. Other source
  portions and original measure IDs/descriptions remain in provenance. Grams and
  fractional servings remain available through the existing controls.
- Duplicate nutrient IDs are rejected; exact same-source description/value/portion
  duplicates are removed. No such duplicates occurred in these pinned exports.
  Raw/cooked/skin/preparation variants are not combined. Quality warnings are
  preserved instead of silently repairing the source.

## Loading and cache

No catalogue file is in the service worker's precache list. The first USDA search
loads the manifest and index; selecting a result loads its detail shard. SHA-256
checks protect index/detail consistency. The current cache is bounded at 8 MB,
and only four detail shards are retained in JS memory. An offline index does not
mean every food's details are offline. A missing detail shard requires a connection.

Raw sizes: index 1,326,952 bytes; details 9,667,791 bytes; largest shard 128,000
bytes. Locally calculated gzip sizes are 299,940 bytes for the index and 1,058,268
bytes for all detail shards; these are compression measurements, not a guarantee
of actual cellular transfer size. USDA's API/key is never used by the app.
