# Nutrition API decision — 29 October 2026

## Decision and verified scope

**Live FatSecret is disabled. No Worker was created or deployed.** Permanent
nutrition retention is not clearly licensed, and a compatible approved-IP route
has not been established on Cloudflare's free plan. These are release gates,
not missing credentials that can safely be worked around.

Official documentation was reviewed; no FatSecret account, credential, API call,
contract acceptance, external registration or billable service was used. The
separate [search demonstration](dev/provider-demo.html) contains **three fictional
records**, not FatSecret results. There is no OAuth implementation hidden behind
it. Actual production coverage remains **13,588 USDA reference foods**, existing
Open Food Facts access, and the user's saved/custom foods. This release improves
searching; it does **not** add a live branded/restaurant database.

## FatSecret capabilities and conditions

| Relevant capability | Published availability and engineering consequence |
| --- | --- |
| Basic registration | Free self-signup, US dataset, English, 5,000 API calls/day; attribution required. Registration and terms acceptance require the owner's participation. |
| Food search | `GET /rest/foods/search/v1`, method `foods.search`, `search_expression`, bounded `page_number`, `max_results` up to 50, `format=json`. Returns Brand/Generic, brand name, serving summary and source URL. The documentation includes a restaurant-brand example; coverage of particular meals is untested. |
| Food details | `GET /rest/food/v5`, method `food.get.v5`, `food_id`, `format=json`. The base method is not marked Premier-exclusive; optional advanced/localized fields require their entitlements. Multiple portions/metric units and nutrients are documented. Confirm actual account scopes before activation. |
| Modern search/autocomplete | Search v5, autocomplete and advanced brand/category tools are Premier features; do not quietly call them with a Basic account. |
| Barcode | `food.find_id_for_barcode` is Premier-exclusive, including verified Premier Free; Basic does not provide it. Existing OFF barcode lookup remains the production route. |
| Premier Free | Application and verification required; published categories include qualifying startups, nonprofits and students. A personal hobby app is not automatically eligible. Paid Premier pricing requires a quote. |
| Temporary content caching | The editions comparison marks caching for Premier, not Basic. The 24-hour retention ceiling is not affirmative Basic cache permission. Obtain written clarification before even a temporary content cache. |

Sources: [editions](https://platform.fatsecret.com/api-editions),
[search v1](https://platform.fatsecret.com/docs/v1/foods.search),
[food details v5](https://platform.fatsecret.com/docs/v5/food.get),
[barcode](https://platform.fatsecret.com/docs/v1/food.find_id_for_barcode).

The v5 details expose sodium/cholesterol/potassium in mg, macros in g; do not
apply OFF's standard g-to-mg adapter to those fields. New derived branded
100 g/100 ml/oz portions can have `serving_id=0`, which is not accepted by
`food_entry.create`. An eventual approved adapter must validate portions and
keep absent nutrients unknown, using CalorieIQ's existing calculation engine.
No real FatSecret serving adapter was implemented or tested in this release.

## Permanent diaries and licensing

[Terms §1.5](https://platform.fatsecret.com/terms) require removing or
re-requesting content not designated indefinitely storable within 24 hours.
The [storable-data list](https://platform.fatsecret.com/docs/guides/storable-data)
includes `food_id` and `serving_id`, plus selected authentication/entry/category/
recipe/meal identifiers; it does not list food names, brands or nutrient values.
Permission for listed fields also has termination/revocation conditions.

CalorieIQ retains immutable nutrition in offline diary entries, saved foods,
recipes and exported backups. The public documents do not clearly grant the
permanent snapshot permission this requires. A fresh request cannot recover
the exact historical values if a manufacturer edits a food. Storing only IDs
or expiring previous diary nutrition would undermine accurate history.

The terms also describe publicly available applications (with a development/
testing exception), user-facing terms obligations, and restrictions involving
API-based nutrition/health advice. Confirm the intended individual-use case and
interaction with our independent calorie calculator in writing. Advertising a
diary capability does not settle the snapshot licensing question.

Request explicit written permission for perpetual offline values, derived recipe
totals, saved-food corrections, backups/restore, use after termination, and Basic
temporary caching. Do not register or accept terms on the owner's behalf.
No scraping, bulk export, relabeling provider values as Custom, or erasing source
metadata is an acceptable workaround.

If integration is approved, use the required linked badge/text wherever actual
provider content appears and the applicable site/app listings; comply with
user terms obligations. The fictional demonstration is not attributed as actual
FatSecret data. See the [attribution policy](https://platform.fatsecret.com/attribution).

## Cloudflare feasibility and costs

The [OAuth guide](https://platform.fatsecret.com/docs/guides/authentication/oauth2)
requires server-side client credentials and token requests from a finite approved
IP list. Basic uses specified IPs; Premier/Premier Free can specify CIDR ranges.
Do not place a client secret or provider bearer token in GitHub Pages.

An ordinary free Worker has no verified dedicated outbound IP for this account.
Cloudflare documents [dedicated CDN egress as Enterprise](https://developers.cloudflare.com/smart-shield/configuration/dedicated-egress-ips/),
with [Workers compatibility when configured](https://developers.cloudflare.com/smart-shield/configuration/dedicated-egress-ips/other-products/).
[Gateway dedicated egress](https://developers.cloudflare.com/cloudflare-one/traffic-controls/egress-policies/dedicated-egress-ips/)
also needs Enterprise/add-on arrangements. Newer Workers VPC/Gateway routing
does not by itself establish a free reserved egress IP. A self-hosted fixed-IP
proxy would introduce another availability/security dependency; none is approved
or running. Do not allowlist all Cloudflare shared IPs or enable paid plans as a shortcut.

[Workers Free limits](https://developers.cloudflare.com/workers/platform/limits/):
100,000 requests/day, 10 ms CPU/request, 128 MB memory, 50 subrequests/request,
six simultaneous outgoing connections/request. Network wait does not count as
CPU time. Free request exhaustion can return Error 1027; this is not an
unlimited service. FatSecret's smaller quota would still govern upstream calls.
[Pricing](https://developers.cloudflare.com/workers/platform/pricing/) lists Free
at $0 and Workers Paid starting at $5/month plus applicable usage. No payment
plan, account, billing or backend resource was enabled. This release adds no cost.

## Conditional backend design — not implemented

Only after both gates are resolved and the owner authorizes setup:

1. Keep the GitHub Pages frontend. Allow only bounded food-name search and numeric
   food-detail IDs at fixed routes; no arbitrary URLs, forwarding headers or
   user-selected upstream methods. Reject unexpected fields, long queries/pages,
   oversized requests and malformed responses. Send no profile, diary, weight,
   user ID or camera data to the food provider.
2. Store the client secret with [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/),
   never a browser/public environment file. Token URL is
   `https://oauth.fatsecret.com/connect/token`, server-side `client_credentials`
   with minimum entitled scope. Keep tokens in server memory, honor `expires_in`,
   use one concurrent acquisition and bounded retries; reacquire credentials
   before expiry rather than assuming a refresh-token grant. Never return tokens.
3. Verify callers using an owner-approved authentication solution (for example
   private authenticated access for personal use). A shared browser secret is
   public. CORS/Origin checks are not caller authentication; non-browser clients
   can spoof headers. Use exact origin `https://maverick18-ai.github.io` (origins
   have no `/Calorie-IQ/` path), bounded methods/headers, correct preflight/Vary,
   and reject disallowed origins. Keep localhost permission development-only.
4. Enforce a global daily upstream budget below 5,000, per-caller/IP limits,
   bounded concurrency, timeout, circuit breaker and Retry-After. An in-memory
   per-isolate counter cannot guarantee a shared global quota. Choose a
   consistent, demonstrably free solution before deployment; no cost assumption
   is made for future bindings/auth services. No anonymous unrestricted proxy.
5. Return small source-specific errors with `Cache-Control: no-store`. Default
   to no food-content cache until expressly licensed. Never log query strings,
   tokens, credentials or personal data. Use status/count/timing diagnostics.
   Test auth bypass, expired-token reacquisition, CORS, quotas across isolates,
   load, timeouts, secret redaction and failure recovery against authorized
   staging credentials before any public route is activated.

Cloudflare's ordinary `wrangler secret put` creates and deploys a new version;
stage secrets/versions deliberately when deployment is authorized. No Wrangler,
environment/secret file or Worker deployment configuration is included now.

## Safe shipped components and limitations

`search.js` handles ranking, source failures, two-provider concurrency, query
validation, deadlines and cancellation. `app.js` debounces submitted searches
200 ms, invalidates requests on text changes/navigation and labels approximate
matches. Existing production providers remain saved/USDA/OFF. English-centric
normalization handles brands, apostrophes, accents, plurals and one-edit typos
only as a fallback; preparation words do not fuzzy-match incompatible states.
The spelling heuristic does not establish that two foods are equivalent.

`providers/policy.js` blocks explicitly restricted records and nested ingredients
at shared food/backup validation, recipe creation and the food-review boundary.
It is a persistence safeguard, not DRM or defense against someone deliberately
removing provenance. Existing unrestricted version-1 migration/version-2 backups
remain valid; no such FatSecret records existed in the prior implementation.

`providers/mock-nutrition.js` simulates 401/expiry, 429, outages, malformed data
and timeout. These test error presentation/fallback only, **not real OAuth,
token refresh, CORS or deployed abuse controls**. It uses no secrets or network.
The standalone demo reads no diary/profile and writes no localStorage,
sessionStorage or persistent caches. Its USDA adapter disables CacheStorage.
Preview uses `totals` and `changeFoodUnit`; incompatible mass/volume conversion
is rejected. Demo files are not in the offline app-shell cache.

Only food names/barcodes go to existing OFF calls; live queries require internet
and disclose that query to OFF. USDA catalogue requests go to this Pages site.
No analytics, ads, cloud diaries, profiles or account synchronization were added.
The existing version-2 profile separation is retained for future family work;
local profiles/backups are not authenticated private accounts.

## Recommended route to real coverage expansion

The best compatible next candidate is a **bounded, reproducible import of an
official USDA Branded CC0 subset**, retaining release/source/portion metadata
and known label-quality warnings. It can preserve snapshots and run on Pages
without a permanent paid backend. Evaluate download/device/cache budgets before
importing; no large archive or new database was added in this task. It may not
provide the desired restaurant completeness. Manual physical-label foods and
existing OFF remain available. Do not promise particular brand/restaurant
coverage without inspecting real licensed records.

Alternatively, the owner can first seek the written FatSecret permissions above
and a verified free approved-egress/authentication arrangement. Credentials alone
do not resolve either gate. Submit any eventual credentials directly through
the approved server-secret mechanism, never in chat or repository files.
