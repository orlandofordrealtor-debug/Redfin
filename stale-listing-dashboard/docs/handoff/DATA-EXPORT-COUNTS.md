# Data export: Redfin's Sold Standard shared database

Exported on 2026-10-26 from artifact https://claude.ai/artifact/81ALWMGv7Ku9ATQf1iHA2T (artifact id 81ALWMGv7Ku9ATQf1iHA2T).
Latest weekly snapshot (meta/current.asOf): 2026-10-26 (previous: 2026-10-13).
Weekly snapshots on file (weeks collection): 2026-10-07, 2026-10-13, 2026-10-26.

Every document in every collection was read with the ArtifactData list action (paged with cursors until no next_cursor remained).

## Record counts

| Collection | Documents | What it holds |
|---|---|---|
| listings | 211 | one per Deal Id on any weekly sheet (active and removed) |
| photos | 175 | up to 8 thumbnails per listing as data URIs |
| coaching | 2 | coaching notes, plans, engagement, share-out edits written by the page |
| meta | 1 | as-of date, tier counts, week-over-week changes |
| weeks | 3 | one KPI snapshot per weekly sheet |
| openhouses | 112 | one per open house deal (trailing six months) |
| ohweeks | 2 | one open house rollup per week |
| earlyaccess | 393 | one per Early Access home (exclusive, Redfin coming soon, other brokerage, live) |
| eaweeks | 2 | one Early Access rollup per week |
| eameta | 2 | per-home Early Access activity written by the page |
| market | 1 | market context (market/current) |
| playbook | 1 | coaching framework (playbook/current) |

Total documents: 905.

## Files

- json/<collection>.json: array of documents; each carries _id, _version and _updatedAt from the database.
- csv/<collection>.csv: one row per document, one column per top-level field; nested objects and arrays are JSON text in the cell (photos CSV cells hold data URIs and are large).
- raw-documents/<collection>/<id>.json: the exact per-document export as returned by the database (id, data, version, updatedAt).

## Notes

- The per-viewer private subtree data/users/<id> was checked for the exporting user and was empty. Other viewers' private subtrees cannot be read by anyone but that viewer; whether any exist is UNVERIFIED.
- Listings with status "Removed from sheet" are kept in the listings collection with removedAt so history survives; the page excludes them from active counts.
- Photo documents are the largest records (up to about 160 KB each).
