# Redfin's Sold Standard

Redfin Powered by Rocket dashboard (the Stale Listing Command Center) for the weekly stale listings hour. It turns the
weekly "active listings" sheet into a tiered, coachable view of every listing,
pulls each property's public Redfin.com page (photos, remarks, price history,
competition), layers on live market context, and produces shareable coaching
output per property.

**Live dashboard:** https://claude.ai/artifact/81ALWMGv7Ku9ATQf1iHA2T

## Tiers

| Tier | Days on market | Posture |
|---|---|---|
| Watch | 1 to 29 | protect the launch window, log traffic weekly |
| Stale | 30 to 59 | diagnose, fix non-price causes, one decisive move before day 60 |
| Ultra Stale | 60 to 89 | second launch: reprice 7 to 10%, new media, financing play |
| Extremely Stale | 90+ | full reset meeting: new band, withdraw and relist, or pause |

## What is in the repo

```
stale-listing-dashboard/
  dashboard.html          the published page (db + Claude + downloads capabilities)
  brand/                  official Redfin Powered by Rocket logo SVGs
  data/
    weekly/<date>.csv     the sheet export for each week
    raw/<dealId>.json     cached Redfin payloads (refetched after 6 days)
    snapshots/<date>.json enriched records for the week
    db/<date>/            documents pushed to the dashboard database
    playbook.json         coaching framework, moves, scripts, stats (sourced)
    market.json           rates, local stats, narrative, talking points (sourced)
  pipeline/
    fetch_listings.py     CSV -> Redfin enrichment -> snapshot
    seed_db.py            snapshot -> db documents + manifest (with week-over-week history)
```

## Weekly cycle

1. Export the sheet as CSV into `data/weekly/<date>.csv` (or upload it in the
   dashboard's Weekly upload tab, which updates tiers and history immediately).
2. Enrich: `python3 pipeline/fetch_listings.py --csv data/weekly/<date>.csv --asof <date> --refresh-core`
   (re-pulls price, photos count, remarks and history for every listing; comps and photo sets refresh after 6 days)
3. Build docs: `python3 pipeline/seed_db.py --snapshot data/snapshots/<date>.json --prev-db data/db/<previous date>`
4. Push `data/db/<date>/manifest.json` to the artifact database (Claude does this
   with the ArtifactData batch tool, 50 documents per call).
5. Refresh `data/market.json` rates and stats; it is pushed as `market/current`.

Sending Claude the new sheet link runs steps 1 to 5.

## Database layout

| Collection | Written by | Holds |
|---|---|---|
| `listings/<dealId>` | pipeline, CSV upload | sheet fields, Redfin data, competition, derived gaps, `history[]` |
| `photos/<dealId>` | pipeline | up to 8 thumbnails as data URIs |
| `coaching/<dealId>` | the page | engagement entries, action plan, notes, AI coaching, share-out edits, sent log |
| `meta/current` | pipeline, CSV upload | as-of date, tier counts, week-over-week changes |
| `weeks/<date>` | pipeline | one KPI snapshot per week (active, stale 60+, stale %, tiers, volume, DOM, drops); the Overview builds trailing-four-week trends from these |
| `market/current` | Claude | rates, stats, narrative, talking points |
| `playbook/current` | Claude | moves, diagnostics, tier plays, pricing rules, scripts, stats |


## Model assumptions (editable in the page under ⚙ Assumptions)

30-year rate (defaults to the market doc), 20% down, carrying cost 1.8%/yr,
market drift -0.4%/mo, stale discounts 1.5 / 3 / 5% by tier, reprice urgency
premium 0.5%, closing costs 6%. These drive the pricing paths and the cost of
waiting projection. They are planning estimates, not appraisals.
