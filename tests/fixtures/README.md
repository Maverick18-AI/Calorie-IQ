# Dated nutrition reference fixtures

`usda-references.json` contains seven real records selected from the pinned
official FDC exports, with the source definitions/releases/retrieval date:

| Example | FDC ID | Reference kcal / 100 g |
|---|---:|---:|
| Egg, whole, raw | 2707152 | 143 |
| Cooked braised skinless chicken breast | 331960 | 166 |
| Raw russet potato, without skin | 2346401 | 81 (specific Atwater) |
| Cooked enriched long-grain white rice | 168878 | 130 |
| Banana, raw | 173944 | 89 |
| Raw ground beef, 90% lean / 10% fat | 2514743 | 190 (specific Atwater) |
| Plain nonfat Greek yogurt | 330137 | 61 |

USDA source: FoodData Central, Agricultural Research Service, CC0-1.0. Record
URLs are `https://fdc.nal.usda.gov/food-details/<ID>/nutrients`. Full provenance and
archive hashes are in the fixture and `data/usda/sources.json`. These are averages
for the stated food/preparation, not guaranteed values for a particular package.

`off-products.json` is **separate Open Food Facts data**, retrieved 2026-10-29:
Ritz-related barcodes 044000077174 and 044000077365, and reference product
3017620422003. Each fixture records the request URL, requested barcode, original
response and retrieval date. Database licence: ODbL-1.0; individual contents:
DbCL-1.0. Attribution: [Open Food Facts](https://world.openfoodfacts.org/).
See [licensing guidance](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/).

The Ritz records intentionally retain their erroneous source serving/nutrient
information. Tests do not repair them to make assertions pass. The 130-kcal,
26-g manual-label fixture in earlier serving tests comes from the user's package
label and is distinct from these provider responses. Synthetic malformed data in
unit tests is explicitly for validation, not presented as nutritional fact.
