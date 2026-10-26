# Data refresh: how the weekly snapshot gets loaded

One rule per line. Anything not confirmed from the code or the working history is marked UNVERIFIED.

## Cadence and ownership

- The dashboard refreshes once a week, on Sunday, from three sheet exports, plus an optional Wednesday Early Access refresh.
- Orlando Jimenez-Ford (orlandofordrealtor@gmail.com) exports the three sheets and shares their Google Sheet links in the Claude conversation.
- Claude (the session running the pipeline) downloads the sheets, runs the pipeline scripts, pushes the documents to the artifact database with the ArtifactData batch tool, records versions, and commits the week's files to the repository.
- No human edits the database directly; the page and the pipeline are the only writers.
- The page's Weekly upload tab is the fallback path: it loads the active listings CSV in the browser and updates listings, tiers, history and meta/current immediately without the pipeline.
- Internal report names inside Redfin's tooling that produce these exports are UNVERIFIED; the sheets below are identified by their column headers.

## Report 1: active listings sheet (required)

- Source: the weekly active listings report for the business market, exported to Google Sheets and then CSV.
- Saved as data/weekly/<as-of date>.csv (example data/weekly/2026-10-26.csv).
- Columns, in order: Deal Id, Deal Status, List Date, Check In Date, Listing Expiration Date, Agent Name, Street Address, City, State Code, Price Drop?, Price Drop Amt, Last Price Reduction Date, Days On Mkt, Deal URL, Suggested Price Amount, Original Price Amount, Current Price, Current Redfin Estimate, Predicted Close Price Amount, Hot Home Score.
- Deal Id is the primary key for listings, photos, coaching and openhouses.
- Deal Status values seen on the 2026-10-26 sheet: Active, Temporarily Removed (4 rows), Offer Received (1 row); all rows are loaded as active listings unless Orlando says otherwise.
- Rows with a blank Street Address are still loaded (two on the 2026-10-26 sheet: Deal Ids 4232541 and 5448544) and the page shows a data issue banner for them.
- The as-of date is the date in the filename; when the sheet does not carry its own date the date it was shared is used (2026-10-26 was assumed from the share date; UNVERIFIED as the sheet's true pull date).

## Report 2: open house sheet (required for the open house views)

- Source: the trailing-six-month open house report, one row per deal that passed the open house norm.
- Saved as data/weekly/openhouse-<as-of date>.csv.
- Columns, in order: Business Market, Deal Agent Role, Deal Agent Name, Address, Deal ID, Deal URL, Listing Price, Redfin Commission, Convertable Sign Ins, Estimated OH Costs, Sign Ins, Diff from Norm, Norm Opens, Open Houses, Price Drop Open Houses.
- The sheet is forward-filled: repeated rows for the same Deal ID belong to one deal and are merged by the pipeline.
- An optional event-level export (one row per open house: deal id, date, host, host role) is saved as data/weekly/openhouse-events-<date>.csv and passed with --events; it has never been supplied, so paid-host counts are estimated from cost divided by $165.

## Report 3: exclusives sheet (required for Early Access)

- Source: the Exclusive Early Access Inventory sheet (Redfin private exclusives).
- Saved as data/weekly/exclusives-<as-of date>.csv.
- Columns on 2026-10-26: Address, SQFT, Beds, Baths, Price, Market, URL, Description.
- Columns on 2026-10-15: ADDRESS, SQFT, BEDS, BATHS, PRICE, URL, MARKET, DESCRIPTION (different case and order; the pipeline reads headers case-insensitively).
- URL may be absolute (https://www.redfin.com/xx/home/<propertyId>) or relative (/xx/home/<propertyId>); the property id is the key for earlyaccess and eameta.

## Report 4: Redfin.com coming soon (crawled, no export)

- The pipeline crawls Redfin.com city by city for coming-soon homes; no sheet is needed.
- The crawl result is cached at data/raw/ea/crawl-<date>.json and reused with --no-crawl.

## Pipeline steps in order (Sunday)

1. Save the three CSVs with the as-of date in the filename.
2. python3 pipeline/fetch_listings.py --csv data/weekly/<date>.csv --asof <date> --refresh-core [--cache-days 30 when Redfin is blocking]: enriches each listing from Redfin.com and writes data/snapshots/<date>.json; raw payloads cache in data/raw/<dealId>.json.
3. python3 pipeline/seed_db.py --snapshot data/snapshots/<date>.json --prev-db data/db/<previous date>: writes data/db/<date>/listings, photos, meta.json, week.json, manifest.json and carries history forward.
4. python3 pipeline/pin_batches.py --db data/db/<date> --versions data/db/versions.json: writes data/db/<date>/batches/batch00.json onward with version pins.
5. A removal batch (batches/batch-gone.json) marks listings that left the sheet as status "Removed from sheet" with removedAt; it is built by a short Python snippet from meta.changes.gone with pins from versions.json (not yet a pipeline script; the snippet is in the session history and is reproduced in SPEC.md section 16).
6. python3 pipeline/openhouse.py --csv data/weekly/openhouse-<date>.csv --db data/db/<date>: writes openhouses/, ohweek.json, oh-manifest.json and batches/batch-oh*.json.
7. python3 pipeline/early_access.py --exclusives data/weekly/exclusives-<date>.csv --db data/db/<date> --prev-db data/db/<previous date> [--no-photos] [--no-crawl]: writes earlyaccess/, eaweek.json, ea-manifest.json and batches/batch-ea*.json including delete batches for homes that left Early Access.
8. Claude pushes every batch file with the ArtifactData batch action (50 writes per call, pinned with if_version; a batch that fails on rate limit is retried unchanged).
9. python3 pipeline/pin_batches.py ... --bump (covers the listing, removal and open house batches) and python3 pipeline/early_access.py ... --no-crawl --no-photos --bump (covers the Early Access batches) record the new versions in data/db/versions.json; do not also run openhouse.py --bump, which would bump the open house versions a second time.
10. Claude refreshes data/market.json (rates and stats with sources) and pushes it as market/current when it changed.
11. Claude commits data/weekly, data/snapshots, data/db/<date>, data/db/versions.json and any pipeline changes and pushes the branch.
12. Claude reports what changed, what is blocked, the Monday Slack post, and the inputs still missing.

## Wednesday refresh (optional)

- python3 pipeline/early_access.py --exclusives data/weekly/exclusives-<latest>.csv --db data/db/<latest> --prev-db data/db/<previous> --no-photos re-crawls coming soon so the 21-day clocks stay current; push batch-ea*.json and bump.

## What each weekly load changes on the page

- listings/<dealId>: sheet fields, tier, history[] entry for the week, Redfin block when enrichment succeeded (or carried from last week), status "Removed from sheet" for departures.
- photos/<dealId>: only when new photos were pulled.
- meta/current: asOf, prevAsOf, counts, tiers, changes, unresolved[], carried.
- weeks/<date>: the week's KPI snapshot; the Overview trend board reads the trailing four.
- openhouses/<dealId> and ohweeks/<date>.
- earlyaccess/<propertyId> (sets and deletes) and eaweeks/<date>.
- coaching/<dealId> and eameta/<propertyId> are never touched by the pipeline.

## Failure handling

- Redfin returned HTTP 403 on detail endpoints during the 2026-10-26 run; the pipeline reused cached payloads up to 30 days old, carried 3 listings forward from the previous week, and left 26 listings unenriched (listed in meta/current.unresolved).
- A fetch that fails never overwrites a good cached payload.
- A new listing with no cache shows sheet fields only, with "enrichment pending" on its page, until a later run succeeds.
