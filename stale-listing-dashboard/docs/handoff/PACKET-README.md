# stale-listing-dashboard-handoff

Complete handoff packet for Redfin's Sold Standard (the Stale Listing Command Center), assembled 2026-10-26 for migration to a new Claude account. Nothing in this packet is summarised or shortened; the source tree is a byte-for-byte copy of the repository plus the gitignored caches.

Original artifact: https://claude.ai/artifact/81ALWMGv7Ku9ATQf1iHA2T
Original repository: github.com/orlandofordrealtor-debug/redfin, folder stale-listing-dashboard, branch claude/redfin-stale-listing-dashboard-fijdv3 (commit 8e3aea8 plus the docs added here).

## Contents

| Path | What it is |
|---|---|
| source/ | Full source code: dashboard.html (the page), brand/ (logo.svg, logo-reversed.svg, mark.svg), pipeline/ (five Python scripts), README.md, docs/, data/weekly (every sheet export), data/snapshots (every enriched snapshot), data/db/<date> (every database document ever pushed, with batches), data/db/versions.json, data/playbook.json, data/market.json, data/coach.json, data/raw (cached Redfin payloads and the coming-soon crawl cache) |
| data-export/ | Every record read from the live shared database on 2026-10-26: json/<collection>.json, csv/<collection>.csv, raw-documents/<collection>/<id>.json, plus README.md with record counts and the latest snapshot date |
| SPEC.md | Plain-English specification, one rule per line: fields, stale definition, tiers, every score and formula, every view, tab, filter, mode, insight, script and coaching line |
| DATA-REFRESH.md | Exactly how the weekly snapshot is loaded: which reports, which columns, who loads it, every pipeline step |
| DEPENDENCIES.md | Every library, CDN, font, runtime capability, storage key and endpoint |
| docs/MASTER-REBUILD-PROMPT.md (inside source/docs) | The prompt to paste into the new account to stand the dashboard up again |

## Standing it up on the new account

1. Publish source/dashboard.html as a new artifact with capabilities db, user, sample and downloads (the page's database is tied to the artifact, so the new artifact starts empty).
2. Load data-export/json into the new artifact's database collection by collection (50 documents per batch): playbook, market, listings, photos, weeks, meta, openhouses, ohweeks, earlyaccess, eaweeks, coaching, eameta. Strip the _id, _version and _updatedAt fields; _id is the document id.
3. Copy source/ into a repository or folder the new account can read, install Pillow (pip install pillow), and follow DATA-REFRESH.md each Sunday.
4. Reset source/data/db/versions.json to the versions the new database reports after the initial load (every document will be version 1).

## Marking convention

Any line in SPEC.md, DATA-REFRESH.md or DEPENDENCIES.md that could not be confirmed directly from the code or the working history ends with UNVERIFIED.
