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
    weekly/openhouse-<date>.csv          trailing-six-month open house sheet (one row per deal)
    weekly/openhouse-events-<date>.csv   optional event-level export (one row per open house: deal id, date, host, host role)
    raw/<dealId>.json     cached Redfin payloads (refetched after 6 days)
    snapshots/<date>.json enriched records for the week
    db/<date>/            documents pushed to the dashboard database
    playbook.json         coaching framework, moves, scripts, stats (sourced)
    market.json           rates, local stats, narrative, talking points (sourced)
  pipeline/
    fetch_listings.py     CSV -> Redfin enrichment -> snapshot
    seed_db.py            snapshot -> db documents + manifest (with week-over-week history)
    openhouse.py          open house sheet (+ optional event export) -> openhouses/ docs + weekly rollup
    pin_batches.py        adds version pins to push batches (data/db/versions.json)
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
6. Open houses: save the trailing-six-month sheet as `data/weekly/openhouse-<date>.csv`
   (and the event-level export as `openhouse-events-<date>.csv` when available), then
   `python3 pipeline/openhouse.py --csv data/weekly/openhouse-<date>.csv --db data/db/<date> [--events ...]`
   and push `batches/batch-oh*.json`; run again with `--bump` after the push to record versions.

Sending Claude the new sheet links (listings + open houses, Sundays) runs steps 1 to 6.

## Database layout

| Collection | Written by | Holds |
|---|---|---|
| `listings/<dealId>` | pipeline, CSV upload | sheet fields, Redfin data, competition, derived gaps, `history[]` |
| `photos/<dealId>` | pipeline | up to 8 thumbnails as data URIs |
| `coaching/<dealId>` | the page | engagement entries, action plan, notes, AI coaching, share-out edits, sent log |
| `meta/current` | pipeline, CSV upload | as-of date, tier counts, week-over-week changes |
| `weeks/<date>` | pipeline | one KPI snapshot per week (active, stale 60+, stale %, tiers, volume, DOM, drops); the Overview builds trailing-four-week trends from these |
| `openhouses/<dealId>` | pipeline | trailing-six-month open house record per deal: opens, norm, price-drop opens, sheet cost, paid (associate) vs agent-hosted opens, commission, spend % of commission, active flag, events[] when the event export is loaded |
| `ohweeks/<date>` | pipeline | one open house rollup per week (opens, paid opens, spend, spend per active listing, high-spend count, by tier); feeds tile trends and the inventory trend table |
| `market/current` | Claude | rates, stats, narrative, talking points |
| `playbook/current` | Claude | moves, diagnostics, tier plays, pricing rules, scripts, stats |


## Model assumptions (editable in the page under ⚙ Assumptions)

30-year rate (defaults to the market doc), 20% down, carrying cost 1.8%/yr,
market drift -0.4%/mo, stale discounts 1.5 / 3 / 5% by tier, reprice urgency
premium 0.5%, closing costs 6%. These drive the pricing paths and the cost of
waiting projection. They are planning estimates, not appraisals.

Open house assumptions: norm 4 opens per listing, associate host rate $165 per
open (only associates are paid; the sheet's cost ÷ $165 estimates paid opens until
the event-level export supplies hosts), and the high-spend alert at 10% of the
Redfin commission.

## Open houses

The sheet lists every deal that passed the open house norm in the trailing six
months, active or not, matched to listings by Deal ID. The Overview carries the
executive view (red outliers first, four tiles with hover drill-downs, spend by
tier, time on market vs profitability, three to five direct reads); the Open
Houses tab holds the full breakdown (filters, charts, by-agent and by-listing
tables with deal-room and Redfin links); every listing page shows a header badge
with a hover popup plus an Open houses card, and the diagnosis, health score,
listing filters and Studio agent sections pick up the alerts (spend at or above
the threshold, past the norm, associate-hosted only, listed more than once, 60+
days with no record).

`ohScope({agents:[...], status:"active"|"inactive"})` is the single entry point
every open house view uses, so a team-scoped coaching dashboard can reuse the
same functions, filters and insights by passing its agent list.
