# Master prompt: rebuild Redfin's Sold Standard on a new Claude account

Paste everything below the line into a new Cowork conversation on the Enterprise account. Attach the handoff packet (stale-listing-dashboard-handoff.zip) or point Cowork at the unzipped folder. If no packet is available, the prompt still contains the full build spec and Cowork rebuilds from scratch.

---

## ROLE

You are my senior product engineer and real estate operations analyst. I am Orlando Jimenez-Ford, Redfin Powered by Rocket Sales Manager in Los Angeles / Southern California (32-agent South LA team, market-wide view). You are rebuilding a production dashboard called **Redfin's Sold Standard** (also called the Stale Listing Command Center) on this account, with identical functionality, execution logic, data model and insights to the original. Work autonomously, make reasonable assumptions, state them briefly, and deliver production-ready output I can share with my team. Do not fabricate market data, listing facts, rates or statistics; mark anything you cannot verify.

## WHAT YOU ARE BUILDING

A published Claude Artifact (single HTML page, light theme by default with a dark toggle) backed by the artifact's shared database, plus a repeatable weekly data pipeline. The page turns three weekly sheet exports into a tiered, coachable view of every active listing, layers public Redfin.com data and market context on each property, tracks open house investment, surfaces pre-market Early Access inventory, and produces copy-ready coaching and share-out content.

Capabilities to declare on the artifact: `db` (shared database), `user` (viewer identity), `sample`/Claude (page can ask Claude to draft coaching text), `downloads` (file exports). Everyone with the link can use it; the page writes viewer activity to the database.

## STEP 0: CHECK FOR THE HANDOFF PACKET FIRST

If a folder or zip named `stale-listing-dashboard-handoff` is available, use it and do not rebuild from scratch:

1. `dashboard.html` is the finished page. Publish it as a new artifact with the capabilities above. Keep `brand/logo.svg`, `brand/logo-reversed.svg`, `brand/mark.svg` as the only logos.
2. `data/db/<date>/` holds every database document already generated (listings, photos, meta, weeks, openhouses, ohweeks, earlyaccess, eaweeks, playbook, market). Load the newest date into the new artifact's database collection by collection, 50 documents per batch, in this order: playbook/current, market/current, listings, photos, weeks (all dates), meta/current, openhouses, ohweeks (all dates), earlyaccess, eaweeks (all dates). Older `data/db/<date>/week.json`, `ohweek.json` and `eaweek.json` files must also be loaded so the trend boards have history.
3. `pipeline/*.py` is the weekly pipeline. Read `README.md` for the weekly cycle and run it as written when I send new sheets. If this environment cannot run Python, replicate each script's logic with your own tools and write the same JSON documents.
4. Confirm the page renders with the loaded data, then give me the link and a Monday Slack post.

If there is no packet, build everything from the specification below.

## INPUTS (three weekly sheet exports, Sundays, plus a Wednesday Early Access refresh)

**1. Active listings sheet** (one row per listing). Columns, exactly:
`Deal Id, Deal Status, List Date, Check In Date, Listing Expiration Date, Agent Name, Street Address, City, State Code, Price Drop?, Price Drop Amt, Last Price Reduction Date, Days On Mkt, Deal URL, Suggested Price Amount, Original Price Amount, Current Price, Current Redfin Estimate, Predicted Close Price Amount, Hot Home Score`
Deal Id is the primary key everywhere. Rows with blank addresses still count. Statuses seen: Active, Temporarily Removed, Offer Received (include all unless I say otherwise).

**2. Open house sheet** (trailing six months, one row per deal that passed the open house norm). Columns:
`Business Market, Deal Agent Role, Deal Agent Name, Address, Deal ID, Deal URL, Listing Price, Redfin Commission, Convertable Sign Ins, Estimated OH Costs, Sign Ins, Diff from Norm, Norm Opens, Open Houses, Price Drop Open Houses`
Rows are forward-filled by deal (repeat rows for the same Deal ID belong to one deal). An optional event-level export (one row per open house: deal id, date, host, host role) may arrive later; design for it.

**3. Exclusives sheet** (Redfin private exclusive inventory). Columns vary by week in case and order; read headers case-insensitively:
`Address, SQFT, Beds, Baths, Price, Market, URL, Description`
URL may be absolute (`https://www.redfin.com/xx/home/<propertyId>`) or relative (`/xx/home/<propertyId>`). The property id in the URL is the key.

**4. Redfin.com public data** (enrichment, best effort). Redfin exposes JSON endpoints under `https://www.redfin.com/stingray/...` that return `{}&&` followed by JSON. Used endpoints:
- `/stingray/do/location-autocomplete?v=2&location=<city>` to resolve a city to a region id (type "2" city → search `region_type=6`; type "6" LA neighborhood → `region_type=1`).
- `/stingray/api/gis?al=1&region_id=<id>&region_type=<t>&status=1&v=8&num_homes=350` for active + coming-soon homes in a city (coming-soon rows appear first; fields `mlsStatus:"Coming Soon"`, `isEarlyAccess`, `earlyAccessType`, sashes 46 EARLY ACCESS, 47 "<BROKERAGE> COMING SOON", 48 "REDFIN COMING SOON" in Redfin red #DE3341; `unitNumber` is a dict with `value`; `timeOnRedfin` is milliseconds).
- `/stingray/api/home/details/aboveTheFold?propertyId=<pid>&listingId=<lid>&accessLevel=1` for photos, remarks, price history, listing agent.
Redfin intermittently returns 403 on detail endpoints and 202 empty on listing pages. The pipeline must tolerate this: keep cached payloads up to 30 days, never overwrite a good cache with a failed fetch, carry forward last week's Redfin block for a listing whose refresh fails (mark `carriedFrom`, `carryReason`), and list unresolved deal ids in `meta/current.unresolved`.

**5. Market and playbook content** (two documents you author with sources): `market/current` (current 30-year rate, local LA stats, narrative, talking points) and `playbook/current` (coaching framework, diagnostics, tier plays, pricing rules, scripts, sourced stats). Cite sources; mark anything needing verification.

## DATA MODEL (artifact database collections)

| Collection | Written by | Holds |
|---|---|---|
| `listings/<dealId>` | pipeline, CSV upload tab | sheet fields, Redfin data (price history, photos count, remarks, agent, lat/lng, sqft, beds, baths, year built), radius competition (active comps within ~1 mile, fresher and cheaper count), derived gaps (vs Redfin estimate, vs suggested price, $/sf vs comps), `history[]` of weekly snapshots (dom, price, tier, status), status "Removed from sheet" + `removedAt` when a listing leaves |
| `photos/<dealId>` | pipeline | up to 8 thumbnails as data URIs (letterbox-cropped, ~40 KB each max) |
| `coaching/<dealId>` | the page | engagement entries, action plan, notes, AI coaching, share-out edits, sent log |
| `meta/current` | pipeline, CSV upload | asOf, prevAsOf, count, tier counts (this and prev), changes {added, gone, newStale, newUltra, newExtreme, priceDrops}, enriched count, carried, unresolved[] |
| `weeks/<date>` | pipeline | KPI snapshot: active, stale60, stale60Pct, stale30, stale30Pct, volume, staleVolume, avgDom, medianDom, priceDrops, hot, added, gone, newStale, newUltra, newExtreme, weekPriceDrops, agents, expiring45, tiers{} |
| `openhouses/<dealId>` | pipeline | opens, normOpens, priceDropOpens, cost, paidOpens, unpaidOpens, commission, spendPct, active flag, agent, role, signIns, convertableSignIns, events[] when the event export exists |
| `ohweeks/<date>` | pipeline | rollup: deals, activeDeals, opens, paidOpens, cost, commission, activeCost, spendPerActiveListing, spendPerActiveDeal, avgOpens, aboveNorm, highSpend10, associateOnly, stale60NoRecord, duplicates, byTier, eventsLoaded |
| `earlyaccess/<propertyId>` | pipeline | stage (exclusive, redfin, other, live), badge, address/city/zip/area, price, beds, baths, sqft, pricePerSqft, yearBuilt, up to 6 thumbs, firstSeen, stageChangedAt, daysUsed, daysLeft, clock (green/amber/red), listingAgent, fingerprint, nearbyCities, features[], url, dealId when matched to the active sheet, graduated{} |
| `eaweeks/<date>` | pipeline | total, byStage, exclusives, redfinComingSoon, otherComingSoon, graduated, preMarketVolume, newThisWeek[], gone[], byArea, eaDays:21 |
| `eameta/<propertyId>` | the page | editable listing agent, prompt copy counts, tally {matches, outreach, showings, offers}, feedback, activity log |
| `market/current`, `playbook/current` | you | sourced content |

Every write to an existing document must carry its version pin. Keep a local `versions.json` map of `collection/docId → version` and bump it after each successful push. When a document leaves (listing gone, Early Access home gone), listings get `status:"Removed from sheet"`; Early Access docs are deleted so the page shows only current inventory.

## EXECUTION LOGIC (must match exactly)

**Tiers by Days On Mkt:** Watch 1 to 29, Stale 30 to 59, Ultra Stale 60 to 89, Extremely Stale 90+. "Stale 60+" is the Redfin definition used for the headline share. Tier penalties for the health score: watch 0, stale 15, ultra 28, extreme 40, unknown 10.

**Week-over-week:** compare the new sheet to the previous week's documents by Deal Id: added, gone, crossed 30, crossed 60, crossed 90, price drops this week (Last Price Reduction Date within the week or Price Drop Amt changed), expiring within 45 days.

**Derived per listing:** gap to Redfin estimate, gap to suggested price, $/sf vs active comps, fresher-and-cheaper competition count, days since last reduction, reduction size as % of original, listing agreement days remaining, online traffic trend when available, photo count vs tier norm, remarks quality flags.

**Diagnosis engine:** each listing gets ranked causes with evidence and recommended moves. Cause library (reproduce all): Priced above what the market is saying; Slightly above market with no urgency signal; No price response to market feedback; Reductions have been too small to re-rank the home; Last reduction has worn off; Price per square foot is above the active competition; Fresher and cheaper competition came on after this listing; Photo set is not pulling its weight; Remarks describe the house but do not sell the deal; Buyers look but do not save; Buyers save it but do not tour; Buyers may be reacting to perception, not the house; Online traffic is falling week over week; Already relisted once without a visible change; Listing agreement is close to expiring; No action plan on file; Listing agent has not hosted an open house; No open house record at 60+ days; Already past the open house norm; Open house spend is outrunning the commission. Primary driver resolves to price, presentation or perception; Extreme listings with multiple high-severity causes get path D (full reset); otherwise A (price), B (presentation), C (perception). Moves include PRICE_ADJUST, RELAUNCH (required for Extreme), new media, financing play, seller conversation, withdraw and relist, pause.

**Health score:** 0 to 100 from tier penalty, pricing gaps, competition, reductions, traffic, presentation, engagement and open house alerts; color banded.

**Pricing paths and cost of waiting:** three paths per listing (hold, adjust, relaunch) with projected net to seller using editable assumptions: 30-year rate (defaults to market doc), 20% down, carrying cost 1.8%/yr, market drift -0.4%/mo, stale discounts 1.5 / 3 / 5% by tier, reprice urgency premium 0.5%, closing costs 6%. Label as planning estimates, not appraisals.

**Open house rules:** only associates are paid, $165 per open; paid opens = round(cost ÷ 165) capped at opens (estimated until the event export supplies hosts); norm 4 opens per listing; high-spend alert at spend ≥ 10% of Redfin commission; alerts: oh-spend, oh-above-norm, oh-associate (associate-hosted only), oh-duplicate (listed more than once), oh-zero, oh-none (60+ days with no record). Match to listings by Deal Id; the Open Houses tab, listing badges and cards, diagnosis, health score, listing filters and agent sections all read the same alerts. Single scoped entry point `ohScope({agents:[...], status})` so a team-scoped view reuses everything.

**Early Access rules:** two categories under one banner. (a) Private exclusives from the sheet, tracked by days since first seen (carry firstSeen across weeks). (b) Coming soon on Redfin.com, crawled city by city across the LA business market: LA County zips 900 to 918, Orange 926 to 928, Ventura 930/932/933, Central Coast 931 and 934 to 936 (tagged "Central Coast"); anything else is excluded. Redfin.com wins on stage: a home live on the MLS (or matching the active sheet by address) graduates to `live` and leaves the page with a note on its listing page; Redfin's own coming soon (sash 48, or isRedfin and listing type 6) is stage `redfin` with the red REDFIN COMING SOON badge and counts as exclusive inventory; other brokerages are stage `other` (blue badge) in a collapsed list for buyer-side awareness. 21-day clock: green 0 to 7 days used, amber 8 to 14, red 15 to 21. Buyer-match fingerprint: price -10% to +5%, beds -1, baths -1, city plus nearby cities from centroids, type mapped from Redfin property type, features regex from remarks. Dedupe unit numbers in addresses. Single scoped entry point `eaScope({stage, area, agents})`.

## PAGE STRUCTURE (navigation order is fixed)

Header: brand line with the Redfin Powered by Rocket logo (reversed logo in dark mode), button-style tabs with a glint sweep on hover, round icon tools (theme toggle saved to localStorage key `slcc-theme`, assumptions ⚙, help), wide search.

1. **Overview**: KPI rows grouped 2 + 4 + 4 (Active listings, Stale 60+ share; then tiers Watch/Stale/Ultra/Extreme; then New this week, Left the list, Crossed 60, Price drops this week), red/green arrows vs last week with "bad up" semantics for stale tiers; open house tile row directly under the listing tiles (Open houses held, Open house spend, Spend ≥ 10% of commission, 60+ with no record) with hover drill-downs; Early Access tile row (exclusives, Redfin coming soon, other brokerages, graduated, pre-market volume); inventory trend board as a two-column executive board (left: share/mix/moves charts; right: trailing-four-week metrics table with arrows and bold deltas); open house outliers table (red, at top: spend %, opens vs norm, associate-only); 3 to 5 direct insights per section written as reads, not labels; Studio section for team share-outs.
2. **Early Access**: hero with counts and refresh cadence (Sundays + Wednesdays), filters (stage, area, agent, search, sort), cards with badge, photos, facts, clock, editable listing agent, fingerprint line, links (Redfin, deal room, map), prompt panel with one-click copy counted per card (Ava prompts: find matches, draft outreach, work the listing agent's list, Slack team broadcast, ready text, ready email), activity tally form (matches, outreach, showings, offers, feedback), collapsed other-brokerage list, share assets (Slack post, email digest, printable one-pager, .xlsx for Google Sheets).
3. **Listings**: filterable, sortable table and cards by tier, agent, city, alerts, search; each row opens the property page.
4. **Open Houses**: filters, charts (spend by tier, opens vs norm), by-agent and by-listing tables with deal-room and Redfin links, insights.
5. **Agents**: per-agent scorecards (listings by tier, stale share, price-drop responsiveness, open house posture, action plans on file), coaching language.
6. **Market**: rates, local stats, narrative, talking points from `market/current` with sources.
7. **Playbook**: tier plays, diagnostics, pricing rules, scripts from `playbook/current`.
8. **Weekly upload**: drop the active listings CSV to update tiers, history and meta immediately from the browser (no pipeline needed for the sheet fields).

**Property page** (from any listing): header with tier, health score, open house badge with hover popup, photos, facts, price history, competition, diagnosis with causes/evidence/moves, pricing paths and cost of waiting, open houses card, engagement log, action plan, notes, AI coaching draft (page asks Claude), share-outs (seller email, agent Slack note, manager summary) with edit and sent log.

Theme: light default, dark optional (brighter text, neon accent glow). Mobile: 16px gutters, no horizontal scroll. Colors as tokens on `:root` with dark overrides. Logos only from the brand files.

## WEEKLY CYCLE (what you do when I send new sheets)

1. Save the three exports with the as-of date in the filename.
2. Enrich listings from Redfin (cache-first, tolerate 403s as above).
3. Build documents and week-over-week changes against the previous week.
4. Build open house documents and the weekly rollup.
5. Build Early Access documents: crawl coming soon, parse exclusives, apply stage rules, carry first-seen, compute clocks, mark graduated, delete gone.
6. Push to the database in pinned batches of 50; record versions.
7. Refresh market rates and stats with sources.
8. Report: what changed (counts table), anything blocked (Redfin block, unresolved listings), the Monday Slack post, and what inputs are still missing.

## DELIVERABLES FOR THIS FIRST SESSION

1. The published artifact link.
2. The database loaded (from the packet if present; otherwise from the sheets I attach).
3. The pipeline (packet scripts, or your equivalent) saved where I can rerun it.
4. A README with the weekly cycle and collection table.
5. A Monday Slack post for the current week.
6. A short list of assumptions you made and anything you could not verify.

## ACCEPTANCE CHECKLIST

- Headline numbers on Overview equal the sheet: active count, stale 60+ count and share, tier counts.
- Every listing page opens from the table and shows diagnosis, health score, pricing paths and open house card.
- Open house tiles, outliers and listing badges agree with each other for the same deal.
- Early Access shows only current inventory; a home live on the MLS is not on the page; clocks match days used.
- Theme toggle persists; page works on a phone.
- All copy buttons work and copies are counted per card.
- Weekly upload tab updates tiers and history without the pipeline.
- No fabricated stats; every market and playbook claim has a source or a "verify" tag.

Start with Step 0. Then proceed phase by phase, telling me in one line what you are doing at each step, and finish with the deliverables list above.
