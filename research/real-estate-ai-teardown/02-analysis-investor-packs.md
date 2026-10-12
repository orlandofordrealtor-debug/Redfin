# B — Teardown of Four Open-Source Real Estate Analysis Packs

**Scope:** `ai-realestate-claude`, `wholesaler-claude-skills`, `real-estate-mcp`, and the `skills/brokerage/` slice of `cre-agent-skills`.
**Method:** every in-scope SKILL.md, agent file, prompt template, formula, knowledge base, workflow example and seed-data shape was read in full as untrusted text (cat/sed/grep only; nothing executed). Quotes below are verbatim unless marked as paraphrase.
**Audience:** a Redfin | Powered by Rocket sales manager in Los Angeles coaching ~30 agents on buyer consults, pricing/CMA discipline, listing presentations, negotiation briefs and Rocket mortgage attach.
**Date of review:** 2026-10-12.

Source roots (read-only):
`<clone>/{ai-realestate-claude,wholesaler-claude-skills,real-estate-mcp,cre-agent-skills}/`

---

## Table of contents

1. [ai-realestate-claude](#1-ai-realestate-claude)
2. [wholesaler-claude-skills](#2-wholesaler-claude-skills)
3. [real-estate-mcp](#3-real-estate-mcp)
4. [cre-agent-skills (brokerage pack)](#4-cre-agent-skills--brokerage-pack-only)
5. [Cross-repo synthesis: top 10 reusable patterns](#5-cross-repo-synthesis--top-10-reusable-patterns-ranked)
6. [Eight new skills for a Redfin LA sales manager](#6-eight-new-skills-a-redfin-la-sales-manager-should-build)
7. [Compliance notes specific to our shop](#7-compliance-notes-specific-to-our-shop)

---

## 1. ai-realestate-claude

### 1.1 Identity

| | |
|---|---|
| Name | AI Real Estate Analyst — Claude Code Skill |
| Author | Zubair Trabzada (`LICENSE`: "Copyright (c) 2026 Zubair Trabzada") |
| License | MIT |
| One-line purpose | Turn Claude Code into an investor-grade property research system: 14 sub-skills + 5 parallel sub-agents that web-search a property, score it 0–100 across value/income/neighborhood/investment/market, and emit markdown reports plus a ReportLab PDF. |
| Size | 14 `skills/*/SKILL.md` (9–20 KB each), 5 `agents/*.md` (11–14 KB), one 46 KB Python PDF generator, `install.sh`/`uninstall.sh`, `requirements.txt` (reportlab, beautifulsoup4, requests). |

### 1.2 Architecture

**Layout**

```
realestate/SKILL.md                 # orchestrator: command table, routing, scoring weights, output standards
skills/realestate-<cmd>/SKILL.md    # 14 sub-skills, one per /realestate <cmd>
agents/realestate-<name>.md         # 5 sub-agents launched by /realestate analyze via Task()
scripts/generate_realestate_pdf.py  # ReportLab, 6 pages, demo mode + JSON input mode
install.sh                          # copies skills to ~/.claude/skills/, agents to ~/.claude/agents/
```

**Trigger / chaining model.** One slash namespace, `/realestate <command> <args>`. The root `SKILL.md` is a router with a command table. The flagship `analyze` runs three phases: (1) Discovery — two `WebSearch` calls to pull a property profile; (2) five `Task()` sub-agents launched "in a single response using parallel tool calls"; (3) synthesis into a weighted composite score and a markdown report. Every other command is single-shot, no sub-agents. `quick` is explicitly capped: "3-5 WebSearches max", "Under 40 lines", "Terminal only". `report-pdf` is a post-processor that scans the cwd for `PROPERTY-*.md`, extracts fields into JSON and calls the Python script.

**Agent vs skill split.** Agents are the *parallel worker prompts* (comps, rental, neighborhood, invest, market). Skills are the *user-facing commands*. Confusingly, five of the skills (`comps`, `rental`, `neighborhood`, `market`, `invest`) cover the same ground as the agents but with **different rubrics** (see weaknesses). Agents return a structured JSON block; skills write markdown files.

**Memory / state.** None. Output is a file per run in the cwd (`PROPERTY-ANALYSIS-123-Oak-St-Austin-TX.md`). `report-pdf` uses `ls -t PROPERTY-*.md` to find the latest; it suggests a staleness banner at 30+ days. No cache, no learnings, no cross-run memory.

**Output conventions.** Every file: header line with score/grade/signal, a disclaimer at top and bottom, markdown tables, "No emojis" rule in the newer agent-style skills. Filename convention `PROPERTY-<TYPE>-<ADDRESS-SLUG>.md`.

**PDF pipeline.** `generate_realestate_pdf.py` (ReportLab platypus): cover with a circular score gauge (`draw_score_gauge`), horizontal bar chart of five category scores, comps table, cash-flow table + metrics, neighborhood bar chart, recommendation + risk matrix. Palette: navy `#1a2332`, forest green `#2d8a4e`, warm gold `#c9982e`, danger `#d9534f`. Score colour thresholds: `>=70 green, >=40 gold, else red`. Usage: `python3 generate_realestate_pdf.py data.json output.pdf` or `--demo`.

### 1.3 Mechanics, skill by skill

#### Root orchestrator (`realestate/SKILL.md`)

Composite score and grade table used everywhere:

```
Composite Score = (Comps x 0.25) + (Rental x 0.20) + (Neighborhood x 0.20) + (Investment x 0.20) + (Market x 0.15)

| 85-100 | A+ | Strong Buy — excellent value across all dimensions |
| 70-84  | A  | Buy — favorable fundamentals with manageable risks |
| 55-69  | B  | Hold/Watch — mixed signals, needs deeper due diligence |
| 40-54  | C  | Caution — significant concerns in one or more areas |
| 25-39  | D  | Pass — unfavorable risk/reward at current pricing |
| 0-24   | F  | Avoid — major red flags, walk away |
```

Output standards worth stealing verbatim:

> 1. **Data-driven** — Every estimate backed by specific comparable data or market statistics
> 2. **Conservative** — Always use conservative estimates for rental income and appreciation; optimistic projections get people in trouble
> 3. **Location-specific** — Real estate is hyper-local; national averages mean nothing
> 4. **Risk-aware** — Every analysis includes what could go wrong
> 5. **Actionable** — Include specific numbers: offer price suggestions, expected cash flow, break-even analysis
> 6. **Disclaimed** — Every output includes the not-investment-advice disclaimer

#### `/realestate analyze` (orchestrator skill)

Inputs: address. Process: Phase 1 property profile table (14 fields: address, price, beds, baths, sqft, lot, year, type, stories, garage, HOA, zoning, assessment, tax). Phase 2 launches five `Task()` prompts (full prompt text embedded in the skill, each ending in the disclaimer). Phase 3 collects scores, computes composite, builds a risk matrix (`Risk | Severity | Likelihood | Impact | Mitigation`), and writes a BUY/WATCH/PASS recommendation with "Suggested offer price (if Buy) based on comps analysis". Error handling: "If fewer than 3 comps are found, flag the Comps Score as 'Low Confidence'".

#### `/realestate comps` — the most reusable file in the repo

Comp selection criteria (verbatim):

```
| Criterion       | Ideal Range          | Acceptable Range      |
| Distance        | Within 0.5 miles     | Up to 1 mile          |
| Sale Date       | Last 3 months        | Last 6 months         |
| Square Footage  | Within 10% of subject| Within 20% of subject |
| Bedrooms        | Same count           | +/- 1 bedroom         |
| Bathrooms       | Same count           | +/- 1 bathroom        |
| Year Built      | Within 5 years       | Within 15 years       |
| Property Type   | Same type            | Same general category |
| Lot Size        | Within 20%           | Within 40%            |
| Condition       | Similar condition    | Note difference       |
Target: 5-10 comps. If fewer than 5 ... expand the search radius to 2 miles or the time window to 12 months, and note the reduced confidence.
```

Adjustment rules and limits (verbatim, appraisal-standard):

> - If the comp has a SUPERIOR feature, SUBTRACT value ... If the comp has an INFERIOR feature, ADD value
> - **Individual adjustment** should not exceed 10% of the comp's sale price
> - **Total net adjustments** for any single comp should not exceed 25% of sale price
> - If total adjustments exceed 25%, the comp is too dissimilar — flag it as a weak comp and reduce its weight

Fair-market-value triangulation (verbatim):

> **Method 1 — Weighted Average:** Tier 1 comps (best matches): Weight 3x; Tier 2: 2x; Tier 3: 1x
> **Method 2 — Median Adjusted Value**
> **Method 3 — Price Per Square Foot:** median adjusted $/sqft × subject sqft
> **Final Estimated Fair Market Value:** Average of all three methods.
> **Value Range:** Low = lowest adjusted comp (or 5th percentile); Mid = FMV; High = highest adjusted comp (or 95th percentile)

Over/under-priced bands and the confidence indicator (both verbatim):

```
| > +10% above FMV   | Significantly Overpriced |
| +5% to +10%        | Moderately Overpriced    |
| +2% to +5%         | Slightly Overpriced      |
| -2% to +2%         | Fairly Priced            |
| -5% to -2%         | Slightly Underpriced     |
| -10% to -5%        | Moderately Underpriced   |
| > -10% below FMV   | Significantly Underpriced|

| High     | 6+ comps, all within 0.5 mi and 3 months, avg adjustment < 10% |
| Moderate | 4-5 comps, within 1 mi and 6 months, avg adjustment < 15%      |
| Low      | 3 or fewer comps, expanded search area/time, avg adjustment > 15% |
```

Also includes a "Suggested Offer Range" table (Aggressive / Competitive / Stretch) and a Market Trend table (median $/sqft 6 mo ago / 3 mo ago / current, annualized %). The Comps Score is 5 × 20-point sub-dimensions (Data Quality, Price Alignment, Comp Relevance, Market Trend, Value Assessment) with explicit point tables.

The companion **agent** (`agents/realestate-comps.md`) adds a red-flag table that is directly usable as a pricing-review checklist:

```
| Priced 20%+ above comps              | Aspirational pricing, unlikely to appraise        | High   |
| No comps within 1 mile               | Unique property or thin market — value uncertain  | Medium |
| All comps are 6+ months old          | Stale data — market may have shifted              | Medium |
| Multiple price reductions            | Seller struggling to find buyer at this price     | Medium |
| DOM exceeds 2x area average          | Something is wrong — price, condition, or location| High   |
| Assessed value 30%+ below list       | Large gap suggests overpricing or recent improvements | Medium |
| Comp prices declining month over month | Market softening — catch a falling knife risk   | High   |
```

#### `/realestate rental`

Inputs: address. Process: rental comp search (5–8 comps, ±15% sqft ideal), monthly rent adjustments table (per bedroom ±$75–200, per bath ±$50–100, per 100 sqft ±$25–75, garage ±$50–150, etc.), fixed vs variable expense model in three scenarios, then metrics. Formulas verbatim:

```
Annual GRI = Monthly Rent x 12
EGI = GRI - Vacancy Loss
OpEx = Property Tax + Insurance + HOA + Management + Maintenance + CapEx + Leasing
NOI = EGI - OpEx   (NOTE: NOI does NOT include mortgage payments)
Cap Rate = NOI / Purchase Price x 100
CoC = Annual Cash Flow (after mortgage) / Total Cash Invested x 100
GRM = Purchase Price / Annual Gross Rent
DSCR = NOI / Annual Debt Service
Break-Even = (OpEx + Debt Service) / GRI x 100
```

Scenario assumptions (verbatim):

```
| Vacancy Rate        | 8-10%           | 5-7%           | 3-4%            |
| Property Management | 10%             | 8%             | 8%              |
| Maintenance/Repairs | 10%             | 7%             | 5%              |
| CapEx Reserve       | 8%              | 5%             | 3%              |
| Leasing/Turnover    | 8.3% (1 mo/yr)  | 4.2% (0.5 mo/yr) | 2.1% (0.25 mo/yr) |
```

Insurance rule of thumb "0.35-0.50% of property value annually"; maintenance reserve by property age (5% new → 12–15% at 30+ years). Rental Score = Cash Flow 25 + Cap Rate 20 + CoC 20 + Rent Stability 20 + DSCR 15. Sensitivity tables for rent ±10% and rate ±1%. Error handling: "If current mortgage rates unavailable from search, use 7.0% as a conservative default".

#### `/realestate neighborhood`

Eight scripted searches (schools, crime, walkability, amenities, demographics, employment, development/zoning, natural-disaster risk). Five 0–20 sub-scores with bonus/penalty points (e.g. "new transit project (+2)", "major employer leaving (-3)"). Quality rules include "Avoid bias — Present demographics factually without value judgments" and "No emojis". **Caution:** the scoring rubric literally awards points for "High median income (>$100K)" and penalizes low-income areas, and the agent version lists "Racial and ethnic diversity" as a metric — this is Fair Housing poison for a brokerage and must not be ported.

#### `/realestate market`

Market classification table (verbatim, the clearest in any repo):

```
| Classification  | Months of Supply | List-to-Sale | DOM        | Price Trend     | Characteristics |
| Strong Seller's | < 2 months       | > 102%       | < 15 days  | > +8% YoY       | Multiple offers common, bidding wars, waived contingencies |
| Seller's        | 2-3 months       | 99-102%      | 15-30 days | +4% to +8% YoY  | Sellers have leverage, homes move quickly |
| Balanced        | 4-6 months       | 97-99%       | 30-60 days | -2% to +4% YoY  | Neither side has clear advantage |
| Buyer's         | 6-8 months       | 94-97%       | 60-90 days | -2% to -6% YoY  | Buyers can negotiate, price reductions common |
| Strong Buyer's  | > 8 months       | < 94%        | > 90 days  | < -6% YoY       | Significant buyer leverage, oversupply, price drops |
```

Market cycle positions (Recovery / Expansion / Hyper Supply / Recession), a Market Score with 5 weighted categories, an "Investment Strategy Fit" table, 10 enumerated risks, and a seasonality table (agent file):

```
| Spring (Mar-May) | Peak listings, peak buyers, highest prices | More competition; data most abundant |
| Summer (Jun-Aug) | Strong activity, family moves, steady demand | Good data quality; moderate competition |
| Fall (Sep-Nov)   | Cooling activity, motivated sellers, fewer buyers | Better negotiation leverage; less competition |
| Winter (Dec-Feb) | Lowest activity, most motivated sellers, lowest prices | Best deals but thinnest data; low confidence in comps |
```

#### `/realestate mortgage` — directly relevant to Rocket attach

Input parsing handles `450000`, `... income 120000`, `... down 20% credit 740 Austin TX`, and `refi 450000 current-rate 6.5% balance 380000`. Defaults: 20% down, 740 credit, 1.1% tax, $1,500/yr insurance. Formula and PMI grid (verbatim):

```
M = P[r(1+r)^n] / [(1+r)^n - 1]

| LTV Range  | Credit 760+ | 720-759 | 680-719 | 640-679 |
| 95.01-97%  | 0.58%       | 0.73%   | 1.02%   | 1.35%   |
| 90.01-95%  | 0.38%       | 0.54%   | 0.78%   | 1.08%   |
| 85.01-90%  | 0.25%       | 0.37%   | 0.56%   | 0.82%   |
| 80.01-85%  | 0.15%       | 0.26%   | 0.44%   | 0.65%   |
PMI drops off automatically at 78% LTV (by original amortization schedule).
```

DTI block (verbatim):

```
FRONT-END RATIO (Housing Costs / Income)  Target: 28% maximum
BACK-END RATIO (All Debt / Income)        Target: 36% maximum (43% for FHA/qualified mortgage)
```

Also: loan scenario comparison table (30yr / 15yr / 5-1 ARM / FHA 3.5% / VA 0% / Investor 25%), FHA MIP notes (1.75% upfront, 0.55% annual), VA funding fee range (1.25–3.3%), amortization milestones (yr 1/5/10/15/30 + "Crossover Point: Month [X] when principal exceeds interest"), rent-vs-buy 5-year wealth table, refinance break-even calculator and decision matrix with "Rule of thumb: Refinance makes sense when break-even is under 24-36 months". Quality rule: "Never quote P&I alone as 'the payment.'"

#### `/realestate invest`

Three strategies with feasibility scores. Buy & hold: 5/10-year projections, depreciation ("(Purchase Price - Land Value) / 27.5 years", land 20–30%), break-even rent `(Mortgage + Taxes + Insurance + HOA + Mgmt + Maint + CapEx) / (1 - Vacancy Rate)`. BRRRR: 75% LTV refi, "Infinite Return? (cash left <= $0)". Flip: 70% rule `MAO = ARV x 0.70 - Rehab`, target benchmarks (net profit $25K+/$50K+, margin 10%/15% of ARV, ROI 20%/40%). Composite Investment Score = Buy&Hold 40% + BRRRR 35% + Flip 25%. The agent version adds a value-add ROI table (kitchen 130–150%, paint 200–250%, ADU 133–160%) and a decision tree (quoted below because it is a clean pattern):

```
Is cash flow positive from day one?
├── YES → Consider Buy-and-Hold or BRRRR
│   ├── Is there value-add opportunity?  YES → BRRRR ... NO → Buy-and-Hold
│   └── Is STR legal and market strong? YES → Compare STR vs LTR ...
├── NO → Is there significant value-add?
│   ├── YES → Fix-and-Flip (if ARV supports 70% rule)
│   └── NO → Is appreciation potential strong (>5% YoY)?
│       ├── YES → Appreciation play
│       └── NO → PASS — not a viable investment at this price
```

#### `/realestate flip`

Rehab cost table by Cosmetic / Mid-Level / Full Gut with regional multipliers: "High-cost metros (SF, NYC, LA, Boston, Seattle): 1.3x-1.6x national average". Three-scenario analysis ("Worst Case: -10% ARV, +25% rehab, 8 months"). Quality rules: "Be conservative — Use conservative ARV and aggressive rehab estimates. Hope is not a strategy." and "Most first-time flippers underestimate by 50%. Pad the timeline."

#### `/realestate compare`

Two addresses, 8 weighted categories: `Price_Value 0.20 + Specs 0.10 + Rental 0.20 + Neighborhood 0.15 + Investment 0.20 + Cost 0.05 + Market 0.05 + Risk 0.05`. Winner per category, Top 5 pros/cons each, recommendation with "Best for Cash Flow / Appreciation / First-Time Buyers / Flipping" and **"The Catch"** — "what is the biggest downside of the winning property". Property-type adjustment table (SFR vs condo: "lot size not comparable", HOA weighted more).

#### `/realestate listing` — the best copywriting rubric of the four repos

Headline formulas (verbatim):

```
| [Feature] + [Location]              | "Renovated Craftsman in Heart of Maple Ridge" |
| [Adjective] + [Property Type] + [Feature] | "Stunning 4BD Colonial with Chef's Kitchen" |
| [Lifestyle] + [Location]            | "Resort-Style Living Steps from Downtown" |
| [Value] + [Feature]                 | "Turnkey 3BD Under $400K with Mountain Views" |
| [Urgency] + [Feature]               | "Rare 5BD on Half Acre — First Time on Market in 20 Years" |
| [Emotion] + [Feature]               | "Your Dream Kitchen Awaits in This Fully Renovated Ranch" |
```

Writing rules (verbatim, abridged to the strongest):

> 1. **Show, don't tell** — "Quartz countertops and stainless steel appliances" not "beautiful kitchen"
> 3. **Be specific** — "42-inch soft-close cabinets" not "nice cabinets"
> 6. **No exclamation points** — One maximum in the entire description
> 8. **Comply with Fair Housing Act** — Never describe the neighborhood demographics, religion, or family composition. Focus on amenities, not people
> Never start with "Welcome to..." (overused)

Fair Housing checklist (verbatim):

```
- [ ] No references to race, color, religion, sex, national origin, familial status, or disability
- [ ] No references to the demographics of the neighborhood ("family neighborhood" is OK; "mostly [group] neighborhood" is NOT)
- [ ] No language that could discourage any protected class ("perfect for young professionals" excludes families)
- [ ] "Walk-in closet" and "master suite" are acceptable; "master bedroom" is being phased out — use "primary bedroom" or "owner's suite"
- [ ] No references to churches, synagogues, mosques, or other religious institutions as selling points
- [ ] Accessibility features described factually, not as limitations
```

(Note: the line "'family neighborhood' is OK" is itself debatable under HUD guidance on familial status; treat the checklist as a starting point, not legal clearance.) Also: four persona variants (Luxury / Family / Investor / First-Time Buyer) with tone + vocabulary tables, 20–30 SEO keywords, Instagram/X captions, 8–12 highlight bullets.

#### `/realestate screen`

Five pre-built screens with threshold tables (Cash Flow: cap >8%, rent-to-price >0.8%; Appreciation: schools 7+, YoY >5%; BRRRR: ≤70% ARV, DOM >60; First-Time Buyer: under median, HOA <$300, schools 6+, commute <30 min; STR: ADR >$150, occupancy >60%) and a custom filter parser. Ranking rules per screen. Error handling: "If STR regulations are unclear, flag as 'STR regulation status: VERIFY LOCALLY' — never assume STR is legal."

#### `/realestate quick`

Fixed 40-line terminal scorecard. Five dimensions (Value Over/Fair/Under; Rental Yield Strong/Mod/Weak; Neighborhood A–D; Market Temp Hot/Warm/Cool; Condition), a signal, top-3 factors, four quick numbers (`$/sqft vs area`, gross yield, PITI at 20% down, cash flow = rent − PITI − 28% expense factor), and a one-paragraph verdict. Example verdict worth copying as a coaching voice: *"Overpriced by $45/sqft vs comps. 87 days on market with two price reductions. Wait for another cut or move on."*

#### `/realestate commercial`

NOI waterfall, cap rate by type (office 5.5–9%, retail 5–8.5%, industrial 4.5–7.5%, multifamily 4–7%), NNN vs gross table, DSCR ≥1.25 pass/fail, replacement cost analysis. Quality rule "Verify NOI — Do not take seller-provided NOI at face value."

#### `/realestate report-pdf`

Scans `PROPERTY-*.md`, builds a JSON payload (schema embedded), calls the script, verifies output (`ls -la PROPERTY-REPORT.pdf`). "Graceful degradation — mark missing sections as 'Not analyzed — run /realestate [command] to add this data'". Data quality flags: High (all 5 agents), Moderate (3–4 or data 7+ days old), Low, Stale (30+ days banner).

### 1.4 Data sources and legal/TOS posture

- Entirely `WebSearch` + `WebFetch`. The root skill says `WebFetch — Zillow, Redfin, Realtor.com, county assessor records, census data, walk score`; every skill scripts queries like `WebSearch("<address> property listing zillow redfin realtor")`.
- No API keys, no MLS, no licensed data. Zillow and Realtor.com TOS prohibit automated scraping; Redfin's TOS likewise. For a Redfin-internal tool this is moot in one direction (we own Redfin data) and a hard stop in the other (never fetch competitor portals for client deliverables).
- Secondary dependence on GreatSchools/Niche ratings, crime aggregators and "AirDNA" via search snippets — all unlicensed snippet usage, unverifiable.
- `install.sh` is a `curl | bash` installer that `pip install`s and copies files into `~/.claude/` — fine for hobbyists, not for a managed fleet.

### 1.5 Disclaimers and compliance posture

Boilerplate on every file: "For educational/research purposes only. Not financial or investment advice. Always consult licensed real estate professionals." PDF appends "The authors and creators of this tool accept no liability for any losses incurred." Fair Housing appears only in `listing`. No appraisal/BPO boundary language anywhere even though `comps` produces a "Final Estimated Fair Market Value" — for licensees this needs the "not an appraisal" framing that cre-agent-skills gets right.

### 1.6 Best ideas to steal for a Redfin LA sales manager

1. **Comp discipline tables** (selection criteria, adjustment limits 10%/25%, three-method FMV, confidence bands). Port as the backbone of a CMA review checklist.
2. **Over/under-priced bands + red-flag table** (DOM 2× area avg, assessed value gap, declining comp trend) as the rubric agents use to defend a list price in a listing presentation.
3. **Market classification table** (months of supply / list-to-sale / DOM / YoY) — a one-slide "what market are we in" for buyer consults, re-keyed to LA County sub-markets.
4. **Mortgage module**: PITI never P&I alone, PMI grid, 28/36, refinance break-even 24–36 month rule of thumb, "crossover month", rent-vs-buy wealth table. This is the skeleton of a Rocket attach conversation.
5. **Listing copy rules + Fair Housing checklist + persona variants** for listing presentations and MLS remarks review.
6. **"The Catch"** section in compare — forces the coach/agent to name the biggest downside of the recommended option.
7. **Confidence/data-quality flags** on every deliverable (High/Moderate/Low, stale banner at 30 days).
8. **Quick scorecard format**: a 40-line, terminal-only, 3-factor verdict is exactly the shape of a pre-tour text to a buyer.

### 1.7 Weaknesses / hollow parts

- **Two rubrics for the same thing.** The `comps` skill scores Data Quality as "8+ comps = 20 … 1-2 comps = 4" with bonuses; the `comps` agent scores it "5+ strong comps within 0.5 mi … 17-20". Rental skill sub-dimensions (Cash Flow 25 / Cap 20 / CoC 20 / Stability 20 / DSCR 15) differ from the rental agent's (Demand / Income / Cash Flow / Expense Efficiency / Returns, 20 each). The orchestrator's embedded Task prompts differ again from both. Nothing reconciles them.
- **PDF schema mismatch.** `report-pdf/SKILL.md` tells the model to build JSON with `property_address`, `property_score`, `comparable_sales`, `estimated_rent`, `school_ratings`…; the script actually reads `address`, `overall_score`, `comps`, `cashflow`, `neighborhood`, `investment_metrics`, `scenarios`, `strategies`, `mortgage`, `appreciation_projections`. Following the SKILL.md literally yields a PDF full of demo defaults ("$425,000", "1,850 sq ft", default risk rows). Demo data silently fills gaps — a report could present fabricated numbers as output.
- **Hallucination surface.** Every number comes from web-search snippets; the skills instruct the model to "extract" comps, crime rates, school ratings, ADR/occupancy with no verification step beyond "note confidence". Red-flag detection and scoring then run on unverified inputs.
- **Investor framing.** Signals are Buy/Pass for an investor; neighborhood scoring is income- and demographics-weighted (Fair Housing hazard); listing skill's "Investor-Focused" variant talks cap rates in MLS copy.
- **Boilerplate bloat.** ~200 KB of prompt, much of it identical headers/disclaimers/output templates. A single `analyze` run will push 5 agents each with 11–14 KB of system text plus 20+ web searches.
- **Hard-coded dates** ("2025 2026", "2026 2027 2028") in search queries and "Generated: April 29, 2026" sample dates will rot.

---

## 2. wholesaler-claude-skills

### 2.1 Identity

| | |
|---|---|
| Name | Wholesaler Claude Skills by RankGrid |
| Author | Miron Briley / RankGrid (`LICENSE`: "Copyright (c) 2026 Miron Briley"); README is also a RankGrid lead-gen page and links a PropStream affiliate trial |
| License | MIT |
| One-line purpose | Give a real-estate wholesaler a Claude Code "second brain": from an address, pull owner/tax/lien/comps/neighborhood intel, score seller motivation, estimate rehab from photos, structure creative-finance offers, coach seller conversations, and stack-rank the pipeline — persisting everything to a `./deals/` folder. |
| Size | 7 skills in `.claudeskills/` (12–42 KB each; total ~190 KB), `_system/deal-memory.md`, `_system/output-format.md`, `CLAUDE.md`, `deals/` scaffolding with two county configs and two ZIP market profiles. |

### 2.2 Architecture

**Layout**

```
CLAUDE.md                             # project instructions: read start-here first, follow _system/*
.claudeskills/start-here-SKILL.md     # orchestrator/router
.claudeskills/{property-recon,comp-analyzer,rehab-estimator,creative-finance,conversation-coach,deal-stacker}-SKILL.md
_system/output-format.md              # terminal design system (box-drawing, status glyphs, required sections)
_system/deal-memory.md                # persistence protocol for ./deals/
deals/pipeline.md                     # append-only registry
deals/market-profiles/{zip}.md        # cached ZIP intel (7/30/90-day freshness rules)
deals/county-configs/{county-state}.md# assessor/tax/recorder URLs, form quirks, Socrata endpoints
deals/{address-slug}/{recon,rehab,comps,notes}.md + photos/
```

**Trigger / chaining model.** `CLAUDE.md` says "First Step On Any Task: Read `.claudeskills/start-here-SKILL.md`". The router does keyword intent detection ("IF user says 'comps' or 'ARV' or 'value' → /comp-analyzer"), compound-request chaining with a confirm step for 3+ steps, and a fixed skill chain:

```
/property-recon → /comp-analyzer → /rehab-estimator → /creative-finance → /conversation-coach → /deal-stacker
```

**Context matrix (the standout architectural idea).** Each skill receives only what it needs from prior skills:

```
| /rehab-estimator   | recon.md (year built, foundation, HVAC, sqft, beds/baths), market-profiles/{zip}.md | full comp analysis, conversation scripts, pipeline scores |
| /conversation-coach| recon.md (owner info, motivation signals), rehab.md (top 3 cost drivers + totals), comps.md (ARV range), learnings.md | full line-item rehab, raw comp data, county configs |
| /deal-stacker      | pipeline.md, all deal summaries (recon motivation + rehab totals + ARV) | full recon reports, photo analysis, county configs |
```

> A conversation coach that receives the full 40-line rehab budget will try to reference every line item. That's not how a wholesaler talks to a seller. The coach needs the top 3 cost drivers and the total — that's what you actually say on the phone.

**Freshness rules (verbatim):**

```
IF deal data < 7 days old → Pass as-is
IF deal data 7-30 days old → Pass with date flag
IF deal data 30-90 days old → Summary only, suggest re-running
IF deal data > 90 days old → Don't pass, recommend fresh pull
```

**Memory / state.** `_system/deal-memory.md` defines per-deal folders, two reusable caches (market profiles by ZIP, county configs), two append-only journals (`pipeline.md`, `learnings.md` with sections Estimate Accuracy / Market Patterns / County Site Notes / What Worked / What Didn't Work), an address-slug convention, an "EXISTING DATA FOUND" prompt, and a closing feedback loop ("DEAL OUTCOME a) Closed b) Dead — couldn't reach seller …"). Principles: "Cache aggressively", "Graceful degradation", "Append, don't destroy", "Honest about freshness", "The system gets smarter".

**Output conventions.** `_system/output-format.md` is a terminal design system: heavy/light dividers, box-drawn alerts, tree views, status glyphs (`✓ ✗ ◑ ○ ★ → ①②③`), a required four-section order (Header → Content → FILES SAVED → WHAT'S NEXT), a DATA SOURCES block showing live vs cached vs missing, and anti-patterns ("DO NOT use chatbot preamble", "DO NOT hide data gaps", "No emoji. No exclamation marks."). Every WHAT'S NEXT line must name a real skill and a time estimate ("→ /comp-analyzer  Pull comps and calculate ARV (~5 min)").

**No PDF pipeline.** Files-first: "The real deliverable lives on the filesystem (`./deals/`). The terminal output is the navigation layer."

### 2.3 Mechanics, skill by skill

#### `/start-here`

Mode detection (first-run creates `./deals/`; returning mode scans pipeline and shows a status board). Hard rules (verbatim, abridged):

> 1. **Never ask more than 2 questions before doing work.**
> 2. **Never present the skill list as a menu.** The orchestrator decides based on intent — the user confirms.
> 6. **Never rebuild what already exists without asking.**
> 7. **Never give generic advice.** Every suggestion references a concrete skill with time estimate.
> 10. **Never hide bad news.** If a deal has low motivation, say so. If numbers don't work, say so.

Gap detection box ("✗ PROPERTY RECON NOT FOUND … → /property-recon Run it first (~5 min) → Continue I'll ask what I need. Never block the user."). MCP detection prints a TOOL STATUS tree and what each missing server affects.

#### `/property-recon` (40 KB)

Inputs: address, optional "what you already know" and purpose. Seven layers with an explicit parallel plan:

- **L1 Firecrawl → Redfin** for beds/baths/sqft/year/lot/estimate/tax history and, critically, the **parcel number** used as the bridge to county lookups. "Use `proxy: 'stealth'` on Redfin scrapes — they block basic proxies."
- **L1.5 PropStream via Chrome (optional)** — detects an open PropStream tab; pulls distressed status, document type ("Trustee's Deed = foreclosure"), open mortgages, liens, equity, condition scores. Condition rules: "IF Total Condition = 'Poor' → Increase rehab estimate range by 30-50%". If absent, shows a "DATA GAPS — PropStream Would Add" box with an affiliate trial link.
- **L2 Chrome → county assessor** (form fill, screenshot, expand sections). Ownership flags logic:

```
IF owner name contains "LLC," "Inc," "Trust," "Corp" → Flag: ENTITY OWNED ... Search Secretary of State
IF mailing address ≠ property address → Flag: ABSENTEE OWNER (out-of-state = higher motivation)
IF last sale date > 10 years ago → Flag: LONG-TERM OWNER (likely high equity)
```
  Data-conflict rule: when Redfin and county disagree, show both and ask ("Baths: 1 (DCAD) — Redfin lists 2. Which is correct?"); default to county for structural facts.
- **L3 Perplexity comps** (6 months not 90 days "In slower markets, 90 days often returns zero comps").
- **L4 Chrome → trustee/tax** by parcel number; interest accruing = delinquent; recorder for liens.
- **L5 Code violations** via Socrata open-data APIs (Dallas, New Orleans, **Los Angeles `data.lacity.org/resource/u82d-eh7z.json`**, SF, Buffalo, Mesa, Seattle) with a generic discovery recipe (`?$limit=1` to learn field names), Accela portal fallback, phone fallback.
- **L6 Perplexity neighborhood**.
- **L7 Motivation score** (verbatim):

```
| Tax delinquent              | +3 |   | Code violations                   | +2 |
| Absentee owner              | +2 |   | Liens on property                 | +2 |
| Out-of-state absentee       | +3 |   | Entity-owned (LLC/Trust)          | +1 |
| Long-term owner (10+ years) | +2 |   | Recent death (probate indicator)  | +3 |
| Vacant property             | +3 |   | Pre-foreclosure filing (lis pendens) | +4 |
0-3 LOW · 4-6 MODERATE · 7-10 HIGH · 11+ VERY HIGH — call immediately
"Only score signals you actually confirmed. Mark unverified signals as 'Unknown' — don't guess."
```

Two worked examples (a HIGH-motivation IRA-held Dallas foreclosure flip and a LOW-motivation owner-occupied Memphis house) — the second ends honestly: "Low-priority lead — owner-occupied, taxes current… Better use of time: Focus on leads with higher motivation scores."

#### `/comp-analyzer` (14 KB)

Four passes: Perplexity wide search → Firecrawl deep scrape → filter & adjust → ARV. Qualification grid has an explicit **Reject** column ("Over 20% difference", "Different (no condos vs SFR)", "Foreclosure, auction, family transfer (flag these)"). ARV method (verbatim):

```
Adjusted Comp Value = Sale Price +/- Adjustments
Adjusted $/sqft = Adjusted Comp Value / Comp Sqft
If you have 4+ comps, remove the highest and lowest
ARV = Average Adjusted $/sqft x Subject Sqft
Cross-reference with Zillow/Redfin estimates; assign confidence
| HIGH | 4+ comps, all within 0.5 mi and 60 days, tight $/sqft range (under 10% variance) |
| MODERATE | 3-4 comps, within 1 mi and 90 days, some variance |
| LOW | 1-2 comps, or wide radius, or old sales, or high variance |
| VERY LOW | No good comps found — estimated from zip code averages and automated valuations only |
```

Decision logic includes "IF automated estimates (Zillow/Redfin) differ from comp analysis by more than 15% → Flag discrepancy and investigate" and "IF market is declining → Note that recent comps may overstate — be conservative". Constraints: "Always show the individual comps — never just give a number without supporting data"; "If comps are thin, say so. A honest 'I only found 2 comps' is better than fake confidence." Quality checklist ends: "Would a cash buyer trust this report enough to make a decision?"

#### `/rehab-estimator` (42 KB)

Photo sources: Chrome gallery walk of Redfin (tab-by-category), local folder via `Read`/`Glob` ("This is the BEST source"), or Google Drive (download first). **R.E.H.A.B.+F** six-zone grading (Roof/Exterior, Electrical/HVAC, Hydro, All interior surfaces, Bath/Kitchen, +Foundation), each 1–4; total 6–24 mapped to severity:

```
| 6-9   | COSMETIC      | $8,000-$20,000  |
| 10-13 | LIGHT REHAB   | $20,000-$35,000 |
| 14-17 | MODERATE      | $35,000-$55,000 |
| 18-21 | HEAVY         | $55,000-$80,000 |
| 22-24 | DOWN TO STUDS | $80,000-$120,000+ |   (DFW, ~1,000 sqft)
```

Six DFW cost tables (rental-ready / mid flip / worst case per line item), market factors ("Los Angeles / SoCal 1.40-1.60x — Permits, labor, everything costs more"), a Hidden Cost Risks table keyed to year built (asbestos <1978, galvanized <1970, polybutylene 1978–95, aluminum wiring 1965–73, knob-and-tube <1940, Texas clay-soil foundation), and three scenarios always. Constraints: "Never present a single number — always show a range"; "Flag the top 3-5 biggest cost drivers explicitly — don't bury them in a long table"; "Look for what's NOT shown (no bathroom photos = bathroom is bad)". The worked example ends with deal impact at mid and worst case and an honest "At the $145K list price: This is overpriced for an investor."

#### `/creative-finance` (18 KB)

Five structures (subject-to, seller finance, lease option, wrap, hybrid) with fill-in math blocks and a decision ladder ("IF existing mortgage has rate under 5% AND seller is motivated → Subject-to … IF none of the above fit → Cash assignment — not every deal needs to be creative. ALWAYS → Run the numbers for at least 2 structures"). Mandatory due-on-sale disclosure and "consult an attorney". Includes a seller pitch script and a "cash offer comparison" so the seller sees both. **Not portable to a brokerage** (these are off-market, unrepresented-seller tactics) but the *comparison discipline* — always show the conventional alternative — is.

#### `/conversation-coach` (35 KB) — the most transferable file in the repo

READ-RESPOND framework. READ tables: motivation signals ("Asks about timeline/speed → HIGH", "Slow replies, short answers → LOW"), emotional state → lead-with (stressed → "list what they don't have to do"; skeptical → "step-by-step process, references, attorney review"; grieving → "NEVER push urgency on grief"), objection categories, deal stage (first contact / discovery / transition / negotiation / commitment / gone cold). RESPOND strategies by state. CRAFT rules for SMS ("under 160 characters… End with a question"), email ("One idea per email"), call prep ("The ONE question you need answered on this call"). PREDICT & PREPARE: 2–3 likely replies with ready responses, "What NOT to say", channel switch. EXPLAIN the why.

Six seller-type profiles (aging owner-occupant, probate, pre-foreclosure, divorce, tired landlord, tax delinquent) each with driver / emotional state / approach / timeline / killer mistake. Channel-switching guide ("Text 6-10 messages → Phone call"; "Never try to close a deal over text"). Objection playbook — the Net Sheet Reframe (verbatim, trimmed):

> "I hear you. Let me ask — what number did you have in mind? ... Okay, so if you listed at [$their number] with an agent, here's what that actually looks like: Agent commission (6%) -$[X]; Closing costs (2-3%) -$[X]; Repairs to list-ready -$[X]; Holding costs while listed … -$[X]; Your net after everything: $[X]. My offer is $[your number], and you'd net $[your number] because there are zero costs. The gap is smaller than it looks."

(For us this is the *investor's* script against listing with an agent — the exact objection our agents face from iBuyers/wholesalers. Reverse it.) Also: "I need to think about it" → Clarity Question ("what specifically are you weighing? Is it the price, the timing, or something else?"); "How do I know you're not a scam?" → Proof Stack; "My neighbor sold for $175K" → "was that one fully renovated?". Constraints: "Never recommend manipulative or high-pressure tactics", "Never trash competing buyers or agents — differentiate instead", "Always include 'What NOT to say'".

#### `/deal-stacker` (29 KB)

STACK score 0–25 across five 0–5 dimensions (verbatim headers):

```
Spread (profit) · Temperature (seller motivation) · Ability (deal certainty) · Clock (speed to close) · Kick (low effort required)
| 20-25 | CLOSE THIS WEEK | Drop everything. |
| 15-19 | ACTIVE — high priority | Dedicated time daily |
| 10-14 | WARM — work it | Schedule follow-ups |
| 5-9   | NURTURE | Weekly check-in, don't spend hours here |
| 0-4   | REVIEW | Is this deal alive? Either re-engage or remove |
```

Pipeline health flags (verbatim list): EXPIRING (close ≤14 days), STALE (no contact 7+ days), DYING (same stage 14+ days), OVERLOADED (>5 deals scoring 15+), EMPTY TOP, BOTTOM HEAVY, THIN SPREAD, ARV UNVERIFIED, LEAD DROUGHT (<5 deals), NO CREATIVE. Rules: "Never rank more than 3 deals as 'top priority'", "Always include the ONE next action per deal", "Build the weekly schedule starting from TODAY'S actual day, not a generic Monday", "If data is missing, score it neutral (2-3) and note the gap, don't guess high". Output includes a day-by-day schedule with hour estimates and a "leaves 11 hrs for lead gen — you need it" line.

### 2.4 Data sources and legal/TOS posture

- **Firecrawl scraping of Redfin/Zillow/Realtor.com with `proxy: "stealth"`** — an explicit, instructed TOS violation of three portals (and in our case of our own employer's site). Not usable as written.
- **Claude in Chrome driving county assessor/tax/recorder sites and PropStream** — public-record lookups are legitimate; automating a logged-in PropStream session may breach PropStream's terms. County configs document URLs, form quirks and load waits (DCAD, Dallas tax office, HCAD).
- **Socrata open-data APIs** (incl. LA Building & Safety code enforcement) — free, keyless, legitimate, and genuinely useful for LA.
- **Perplexity API** for comps/market/rent — legitimate but, as the skill admits, "Perplexity returns 0-2 actual comps for ARV queries".
- Explicitly refuses skip tracing: "Never attempt to find phone numbers or emails (that's skip tracing, not public records)".

### 2.5 Disclaimers and compliance posture

Every report footer: "Not a professional appraisal. Verify all data before making offers. County records may not reflect recent changes." Creative-finance: attorney disclaimer and due-on-sale disclosure mandatory. Rehab: "Physical inspection required." Conversation coach has an ethics constraint block (no manipulation, no lying, empathy-first for probate/aging). No Fair Housing mention anywhere (wholesalers are not licensees, but the motivation-score logic — targeting elderly long-term owners, probate, tax-delinquent — is precisely the behaviour DRE and consumer regulators scrutinize; a brokerage must not replicate it as a prospecting filter).

### 2.6 Best ideas to steal for a Redfin LA sales manager

1. **Context matrix + freshness rules** — the cleanest multi-skill memory design of the four repos. Use it for a per-agent coaching folder (`./agents/{name}/`) and per-listing deal folders.
2. **Learnings journal with outcome feedback** ("DEAL OUTCOME a/b/c/d/e") — calibrate CMA accuracy (list vs sold), days-on-market predictions and buyer-consult conversion over time.
3. **Conversation Coach's READ-RESPOND skeleton**, seller-type profiles, "What NOT to say", channel-switch guide and predicted replies — rebuild as a *buyer-consult and seller-objection coach* for agents, flipping the Net Sheet Reframe to defend full-service representation.
4. **STACK pipeline scoring + health flags + today-anchored weekly schedule** — directly maps to agent pipeline reviews in 1:1s (rename dimensions: Spread→GCI, Temperature→client motivation, Ability→pre-approval/listing agreement status, Clock→target close, Kick→effort).
5. **Two-questions-max, never-a-menu, never-hide-bad-news** router rules — adopt as house style for all coaching skills.
6. **DATA SOURCES block with ✓ live / ✓ cached (2 days) / ✗ missing** and the FILES SAVED / WHAT'S NEXT mandatory footers.
7. **Comp Reject column and "remove highest and lowest" trimming**, plus "If comps are thin, say so" — add to CMA review.
8. **Hidden-cost-by-year-built table** (asbestos/galvanized/knob-and-tube/aluminum) — reuse in buyer consults for 1920s–60s LA housing stock and in inspection-contingency negotiation.
9. **LA Socrata code-enforcement endpoint** as a free pre-listing/pre-offer check.
10. **Honest low-priority verdicts** ("Low-priority lead… Better use of time:") — model this tone for coaching agents off dead leads.

### 2.7 Weaknesses / hollow parts

- Scraping instructions are a TOS liability; the Redfin stealth-proxy line alone disqualifies verbatim reuse inside Redfin.
- Cost tables are DFW-calibrated; LA multiplier (1.4–1.6×) is a guess, not data.
- Wholesaler ethics: motivation scoring targets vulnerable sellers; creative-finance pushes sub-to on elderly owners with 3.25% loans. Not our business and reputationally dangerous.
- The two sample county configs are Texas only; the "known limitations by city" table has two rows.
- Heavy prompt weight (190 KB) and much of each skill is a long worked example; the examples are good teaching material but expensive context.
- PropStream affiliate link embedded in a "DATA GAPS" box — commercial nudge inside a tool output.
- The Chrome photo-gallery walk is brittle by its own admission ("Redfin photo gallery layout changes over time").

---

## 3. real-estate-mcp

### 3.1 Identity

| | |
|---|---|
| Name | Real Estate MCP Server — Property Intelligence & Workflow Automation (v2.0.0) |
| Author | Edwin Genego (`edwin@genego.io`, repo `agentic-ops/real-estate-mcp`) |
| License | **AGPL-3.0** with a commercial-license path; `AGENTS.md` instructs maintainers "Do not relicense (e.g. back to MIT)". Network-service use of a modified copy triggers source-publication duties — relevant if we ever host a fork. |
| One-line purpose | A FastMCP server exposing ~55 deterministic, offline-first tools (property/agent/market/client/area/mortgage/valuation/document/queue/integrations/system), 13 prompt templates and `realestate://` resources over fictitious Riverside-CA seed JSON, with opt-in live adapters to free federal APIs and metered RentCast/Zillow. |

### 3.2 Architecture

```
main.py              # FastMCP("Real Estate MCP Server"), create_server(), stdio|sse|streamable-http
feature_flags.py     # REALESTATE_MCP_ENABLE_<CATEGORY> env flags, default on
utils.py             # RealEstateDataManager (loads data/**/*.json), PropertyFilter dataclass, audit()
tools/*.py           # register_<cat>_tools(mcp); finance_helpers.py = pure math
resources/*.py       # realestate://server-config, all-properties, market/area/{area}, client/{id}/matches ...
prompts/*.py         # 13 @mcp.prompt() templates
integrations/*.py    # census, walkscore, fema, fred, fbi_crime, epa, noaa (free); rentcast, zillow (paid)
data/                # seed JSON: 5 areas, agents, clients, 8 recent sales, amenities, market analytics
.agents/skills/real-estate-mcp-toolkit/SKILL.md   # vendor-agnostic methodology skill
tests/               # pytest, httpx.MockTransport, network-free
```

**Trigger/chaining model.** Tools are atomic; chaining is left to the client LLM, guided by (a) the 13 prompts (which surface as slash commands in MCP clients) and (b) `.agents/skills/real-estate-mcp-toolkit/SKILL.md`, which encodes seven workflow patterns ("Buyer affordability & financing: `estimate_affordability_tool` → `filter_properties` → `calculate_mortgage_payment` → `get_amortization_schedule`"). Its non-negotiables:

> 1. **Never present estimates as guarantees or appraisals.** Mortgage, valuation, and investment tools include a `disclaimer` field — always surface it.
> 2. **Prefer local, offline tools first; and free live sources over paid ones.**
> 5. **State assumptions on every financial calc.** Rate, term, DTI, vacancy, and down payment drive the numbers — surface them (they are in the `assumptions` field).

**Memory/state.** Seed JSON in memory with `refresh_data`; SQLite `real_estate_mcp_analysis.db` for the analysis queue (jobs run synchronously then persist). `audit()` writes a structured log line for every tool call ("Never pass secrets").

**Output conventions.** Every tool returns `json.dumps(..., indent=2)`; finance tools include `disclaimer` and `assumptions` keys. `export_property_report` writes a `.docx` via python-docx (title, 2-col field table, Notes, Disclaimer). No PDF.

**Deep analysis via MCP sampling.** `deep_analyze_property` checks `ctx.session.check_client_capability(sampling)`; if supported, sends the heuristic JSON to the client LLM with system prompt "You are a careful real-estate analyst. Be specific and concise. Not financial advice." (max 500 tokens); otherwise returns heuristics plus a note.

### 3.3 Tool catalogue (as implemented in code, not as the README claims)

| Category | Tool | Parameters |
|---|---|---|
| property | `get_all_properties()` · `get_property_details(property_id)` · `search_properties(query)` · `filter_properties(min_price?, max_price?, min_bedrooms?, max_bedrooms?, areas? csv, property_types? csv)` · `get_properties_by_area(area)` · `get_property_insights(property_id)` | substring search over address/description/features/area/type/style |
| agent | `get_all_agents` · `get_agent_details(agent_id)` · `search_agents(query)` · `get_agent_properties` · `get_agent_sales` · `get_agent_clients` · `get_agent_dashboard(agent_id)` | dashboard computes `total_sales_volume`, `avg_days_on_market` from `recent_sales` |
| market | `get_market_overview` · `get_price_analytics` · `get_area_market_data(area)` · `compare_areas(areas csv)` · `get_investment_opportunities` · `get_recent_sales` · `get_sales_by_area(area)` | pure JSON passthrough |
| client | `get_all_clients` · `get_client_details(client_id)` · `match_client_preferences(client_id)` | match = `PropertyFilter` from budget_range/desired_areas/property_type; buyers only |
| area | `get_all_areas` · `get_area_details(area_name)` · `get_city_overview` · `get_area_amenities(area)` · `get_schools_data` · `get_parks_and_recreation` · `get_shopping_amenities` · `get_healthcare_facilities` · `get_comprehensive_area_report(area)` | schools are NOT filtered by area ("simplified implementation") |
| mortgage | `calculate_mortgage_payment(principal, annual_rate_pct, term_years=30)` · `get_amortization_schedule(principal, annual_rate_pct, term_years=30, max_rows=12)` · `estimate_affordability_tool(annual_income, monthly_debts=0, down_payment=0, annual_rate_pct=6.5, term_years=30, max_dti=0.36)` · `compare_refinance(principal, current_rate_pct, new_rate_pct, term_years=30, closing_costs=0)` | DISCLAIMER "Estimates for planning only. Not a lending offer or financial advice." |
| valuation | `estimate_property_value(property_id)` · `comparable_market_analysis(area)` · `analyze_investment(price, monthly_rent, down_payment, annual_rate_pct=6.5, term_years=30, vacancy_rate=0.05, annual_operating_expenses=0)` · `analyze_listing_investment(property_id, monthly_rent, down_payment_pct=20, annual_rate_pct=6.5, term_years=30)` · `deep_analyze_property(property_id, focus="overall value and investment potential")` | DISCLAIMER "Analytical estimate only. Not a certified appraisal or financial advice." |
| document | `ingest_listing_document(file_path)` (.txt/.docx, regex extraction) · `compare_listing_documents(a, b)` · `export_property_report(report_json, output_path.docx)` | "Fields that cannot be extracted return null — the tool never guesses" |
| analysis_queue | `queue_property_analysis(file_path, analysis_notes="")` · `get_analysis_status(job_id)` · `get_analysis_result(job_id)` · `list_analysis_jobs()` | SQLite; runs inline |
| integrations | `integration_status()` · `lookup_live_property(address)` [RentCast, metered] · `lookup_live_zestimate(address)` [Zillow/Bridge, paid] · `get_live_demographics(state_fips, year=2022)` · `get_live_walk_score(address, lat, lon)` · `get_live_flood_zone(lat, lon)` · `get_live_mortgage_rate()` [FRED MORTGAGE30US] · `get_live_crime_summary(state_abbr, offense="violent-crime")` · `get_live_environmental_hazards(state_abbr)` · `get_live_weather_forecast(lat, lon)` | all return a status payload and make **no network call** when disabled |
| system | `get_server_info` · `refresh_data` · `get_data_summary` | |

Documentation drift (noted for anyone porting): README lists `compare_loan_scenarios`, `generate_amortization_schedule`, `get_client_profile`, `get_price_trends`, `get_area_demographics`, `get_area_comparison` — none exist; WORKFLOW_EXAMPLES calls `get_recent_sales(area, limit)`, `analyze_investment(property_id, down_payment_pct)`, `get_schools_data(area)`, `compare_areas(areas: [list])` — the real signatures differ. The examples also quote a "28/36 DTI rule" that the code does not implement (single `max_dti=0.36`).

### 3.4 The actual formulas (from `tools/finance_helpers.py` and `valuation_tools.py`)

```python
def monthly_rate(annual_rate_pct): return (annual_rate_pct / 100.0) / 12.0

def monthly_mortgage_payment(principal, annual_rate_pct, term_years):
    n = int(term_years) * 12
    r = monthly_rate(annual_rate_pct)
    if r == 0: return principal / n
    factor = (1 + r) ** n
    return principal * (r * factor) / (factor - 1)

# amortization: interest = balance*r; principal_paid = payment - interest; balance -= principal_paid (floored at 0)
# summary: total_paid = payment*n; total_interest = total_paid - principal
```

Affordability (inverse annuity with taxes folded in — the only non-trivial derivation in the repo):

```python
housing_budget = annual_income/12 * max_dti - monthly_debts
budget_after_insurance = max(0, housing_budget - annual_insurance/12)
pi_factor = (r*(1+r)**n)/((1+r)**n - 1)          # payment per $1 of principal
monthly_tax_rate = (property_tax_rate_pct/100)/12  # default 1.1%/yr
# payment = principal*pi_factor + price*monthly_tax_rate, price = principal + down_payment
principal = (budget_after_insurance - down_payment*monthly_tax_rate) / (pi_factor + monthly_tax_rate)
price = principal + down_payment
estimated_monthly_payment = P&I + price*monthly_tax_rate + annual_insurance/12
```

Defaults: `max_dti=0.36`, `property_tax_rate_pct=1.1`, `annual_insurance=1200`. No PMI, no HOA, no front-end ratio.

Investment metrics:

```python
noi = annual_rent*(1 - vacancy_rate) - annual_operating_expenses
cap_rate_pct = round(noi/price*100, 2)
gross_rent_multiplier = round(price/annual_rent, 2)
loan = max(0, price - down_payment); annual_debt_service = monthly_pi*12
annual_cash_flow = noi - annual_debt_service
cash_on_cash_return_pct = round(annual_cash_flow/down_payment*100, 2)
```

Refinance break-even: `break_even_month = ceil(closing_costs / monthly_savings)` (implemented as `int(-(-closing_costs // monthly_savings)) or 1`), with recommendation text "Refinance likely beneficial if you keep the loan past the break-even month."

CMA valuation (`estimate_property_value`): `area_ppsf = mean(price_per_sqft of sales in same area)`; `estimated_value = area_ppsf * sqft`; `list_vs_estimate_pct = (list - est)/est*100`; assessment: `<= -5 → "below comparable estimate (potentially underpriced)"`, `>= 5 → "above … (potentially overpriced)"`, else "in line". `comparable_market_analysis(area)` returns count, avg/min/max sale price, avg $/sqft, avg DOM and the raw comps. No adjustments, no recency weighting, no distance.

### 3.5 Prompts (13) — what they actually contain

All are f-string markdown outlines with emoji headers and 5–6 numbered sections of bullet prompts; none embed data. Most useful for us:

- `mortgage_planning_prompt(annual_income, down_payment)` — tells the assistant which tools to call in order and ends "Always label figures as planning estimates, not a lending offer." Section 4 "Rate Sensitivity & Refinance — Compare payments at a few rate scenarios."
- `valuation_prompt(property_id)` — "Is the listing under-, over-, or fairly priced versus comparables? What factors could justify a premium or discount?" … "Flag the biggest uncertainties and what data would reduce them."
- `client_consultation_prompt(client_id, consultation_type="initial")` — six-part framework (Pre-Consultation Preparation → Needs Assessment and Discovery → Market Education → Service Presentation and Value Proposition → Action Plan → Follow-up) with "Consultation Success Tips: Listen Actively · Educate Thoroughly · Build Trust · Plan Strategically · Follow Through". Generic but a serviceable buyer-consult outline.
- `client_feedback_analysis_prompt` — "Analyze client feedback from property viewings… refine the search strategy" (pattern: post-tour feedback loop).
- `agent_performance_prompt(agent_id)` — KPI dashboard list: "Days on Market: Average vs. market comparison · List-to-Sale Ratio: Pricing accuracy and negotiation skills · Conversion Rate: Leads to contracts · Client Retention · Pipeline Health", then 30/60-day, 3–6 month, 6–12 month action plans.
- `agent_training_development_prompt(agent_id, skill_area="negotiation")` — negotiation plan: "Offer Negotiations · Multiple Offer Situations · Inspection Negotiations · Closing Issues · Commission Negotiations" + "Role-Playing Exercises … Video Review".
- `agent_marketing_strategy_prompt(focus_area)` — lead_generation / brand_building / client_retention deep dives.
- `market_report_prompt`, `comparative_market_analysis_prompt(areas)` (per-area matrix: Median Price / Market Velocity / Inventory Level / Demographics / Amenities Score / Growth Potential / Investment Grade), `investment_analysis_prompt`, `property_analysis_prompt`, `property_comparison_prompt`, `client_matching_prompt`.

### 3.6 Data sources and legal/TOS posture — the cleanest of the four

- Core is **fictitious seed data** (Riverside CA areas, 8 sales, "AGENT001"), offline and deterministic.
- Live adapters hit **official APIs only**: Census ACS (free key, now mandatory), Walk Score (free key, 5k/day), FEMA NFHL ArcGIS layer 28 (keyless), FRED `MORTGAGE30US` (free key), FBI CDE (api.data.gov key), EPA Envirofacts TRI (keyless), NOAA/NWS (keyless, requires User-Agent). RentCast (`X-Api-Key`, metered) and Zillow via **Bridge Interactive licensed Zestimates** (`Authorization: Bearer`, "~$500+/mo, no public self-serve Zillow API"). No scraping anywhere.
- Every adapter: off by default, `status()` never echoes keys, injectable `http_client` for tests, graceful error payloads. `integrations/README.md` documents a live spec-verification pass (five real bugs found: FEMA path, FBI path and required `from/to`, Walk Score HTTP-200-on-error, Census key mandatory, NOAA 4-decimal 301).
- README has a "Data flow & privacy boundaries" mermaid diagram and states: "The highest privacy risk is the inference provider receiving your full prompt context."

### 3.7 Disclaimers and compliance posture

Server `INSTRUCTIONS`: "Provides workflow augmentation, not financial or legal advice." Per-tool constant disclaimers (mortgage: "Not a lending offer"; valuation: "Not a certified appraisal"; deep analysis: "AI-generated reasoning for review only"). `.docx` export: "Analytical estimate only; not a certified appraisal." The methodology skill makes surfacing the disclaimer and the assumptions block mandatory. No Fair Housing content; prompts reference "Demographics" but keep it to income/population.

### 3.8 Best ideas to steal

1. **Deterministic finance engine as pure functions, unit-tested, with `assumptions` and `disclaimer` fields on every result.** Put the payment/PITI/affordability/refi math in a small Python module and have the Rocket-attach skill call it instead of letting the model do arithmetic.
2. **Feature flags + status tools** so a skill can ask "what data sources are on?" before promising anything.
3. **Free federal data for LA buyer consults:** FEMA flood zone by lat/lon (Playa, Venice, Long Beach, Sun Valley wash areas), FRED weekly 30-yr rate for every payment quote, Census ACS by tract, EPA TRI facilities.
4. **"Prefer free before paid; never call a metered API silently"** — a good governance rule for any tool that touches paid data.
5. **Agent-performance KPI list** (DOM vs market, list-to-sale, lead→contract conversion, retention, pipeline health) and the 30/60/90 action-plan skeleton for coaching 1:1s.
6. **client_consultation prompt skeleton** as the spine of a buyer-consult prep skill.
7. **`audit()` on every call** — provenance for compliance.
8. **MCP sampling fallback pattern** — degrade to a deterministic heuristic rather than error.

### 3.9 Weaknesses / hollow parts

- Toy data (5 neighborhoods, 8 sales); the "CMA" is `avg $/sqft × sqft` with no adjustments, no time, no distance.
- Affordability uses one DTI (36%) with no PMI/HOA/front-end ratio; investment tool defaults `annual_operating_expenses=0` so cap rates will be flattered unless the caller supplies expenses.
- Docs promise tools that don't exist and workflow examples use nonexistent parameters.
- Prompts are long generic outlines ("Lead Magnets", "Retargeting") — content-free until the model fills them.
- AGPL licensing complicates hosting a modified fork internally for agents.
- Sampling is unsupported by most clients, so `deep_analyze_property` is in practice heuristic-only.

---

## 4. cre-agent-skills — brokerage pack only

### 4.1 Identity

| | |
|---|---|
| Name | CRE Agent Skills (v1.6.0, 2026-09-01) |
| Author | Avi Hacker, J.D. / The AI Consulting Network (`NOTICE`), extracted from his `cre-acquisition-orchestrator` |
| License | Apache-2.0; attribution frontmatter + footer enforced by `scripts/validate_repo.py` |
| One-line purpose | 90 standalone markdown "skills" and 35 knowledge bases for commercial real estate (multifamily DD, underwriting, financing, legal, closing, document ingestion, industrial, brokerage, asset management, office, capital markets, retail, lender/credit, development), each a structured analyst prompt with no code and no API keys. |
| Other packs (names only, out of scope) | cre-due-diligence (7), cre-underwriting (3), cre-financing (3), cre-legal (6), cre-closing (2), cre-document-ingestion (4), cre-industrial (8), cre-asset-management (9), cre-office (8), cre-capital-markets (8), cre-retail (8), cre-lender-credit (8), cre-development (8). |

### 4.2 Architecture and skill template

**Layout.** Root `skills/<pack>/*.md` and `knowledge/*.md` are the authored source of truth; `claude-code-plugins/cre-<pack>/{SKILL.md, skills/, knowledge/}` are distribution mirrors (validator fails if a root skill lacks a mirror or a mirror lacks a root). `research/<pack>/*-research.md` holds a companion research note per skill/knowledge base (min 10 cited sources, 3 primary; template includes Source Table with publish/access dates, Conflicting Source Resolution, Edge Cases, Open Questions).

**Routing model.** Each plugin `SKILL.md` has YAML frontmatter (`name`, `description`, `argument-hint: "[task-description]"`, `license`, `metadata`) and a routing table:

> 1. Read the user's request to determine which skill is needed
> 2. Load the full skill file - e.g. `Read skills/broker-opinion-of-value-builder.md`
> 3. Follow the Strategy steps exactly
> 4. Produce output in the specified format
> 5. Run Quality Checks before delivering results
> If the user says "$ARGUMENTS", use that to determine which skill to load.

**Skill template (every file, enforced headings):**

```
When to Use This Skill · What You'll Need to Provide · Mission · Strategy (Step 1..N) ·
Output Format (markdown skeleton with Status: COMPLETE | PARTIAL | FAILED/BLOCKED and Confidence Level) ·
Quality Checks · When Data is Missing · Confidence Scoring (HIGH/MEDIUM/LOW criteria table) ·
Related Knowledge Bases · Research Basis · Attribution
```

**Memory/state.** None. Cross-skill handoff is by convention only (e.g. the BOV builder accepts an optional `disposition_handoff` block from the asset-management Hold/Sell/Refi skill). No PDF or file pipeline; outputs are markdown skeletons.

### 4.3 Mechanics of the five in-scope skills

#### Assignment Intake Manager

Inputs: property, seller entity/authority, goals (pricing, timing, confidentiality, buyer profile), available documents, engagement constraints. Strategy: confirm context (broad / targeted / confidential / office-exclusive); clarify objectives; inventory the data package by workstream; identify readiness gaps that weaken "BOV quality, listing proposal credibility, OM accuracy, buyer process quality"; recommend next steps. Output skeleton:

```
# Assignment Intake Summary
## Status: COMPLETE | PARTIAL | BLOCKED
### Seller Objectives  - Timing: - Confidentiality: - Buyer Profile: - Process Preference:
### Authority and Representation  - Seller Entity: - Signing Authority Status: - Listing / Marketing Authorization Status:
### Document Inventory  - Available: - Missing:
### Readiness Gaps · ### Recommended Process · ### Immediate Next Steps 1. 2. 3. · ### Confidence Level
```

Quality check worth keeping: "Signing authority and marketing authorization are not assumed." Missing-data rule: "If ownership or signing authority is unclear, flag this as a launch blocker."

#### Broker Opinion of Value Builder

Inputs: property, operating/lease data, comps, market context, seller timing, **state/jurisdiction**. Strategy: define purpose and intended user and "any current or contemplated brokerage interest"; select lenses (sales comparison / income-cap rate / cost-land); build evidence set; recommend "value or pricing range, recommended ask or guidance strategy, why the process choice supports the pricing goal"; boundary language. Output requires `### Disclaimer - This is not an appraisal.` Missing-data: "If comps are weak, widen the range and state lower confidence … If state-specific terminology risk is unclear, add a stronger boundary note and recommend brokerage compliance review."

Knowledge base `broker-opinion-of-value-guidance.md` minimum disclosure logic (verbatim) — grounded in NAR Code of Ethics SOP 11-1, which binds residential REALTORS® too:

```
- subject property identification
- date prepared
- purpose and intended user
- contemplated or existing brokerage interest
- limiting conditions
- basis for the opinion, including market evidence
- a statement that the opinion is not an appraisal
```

> **State-Law Warning** … if the jurisdiction is sensitive about use of the word `value`, use a carefully qualified pricing-analysis label and explicit disclaimer; if uncertain, escalate to brokerage counsel or compliance.

"What a Good BOV Should Not Do: claim to be an appraisal · imply certainty where comps are thin · ignore contemplated brokerage interest · skip limiting conditions · give legal or tax advice." Red flags: "seller insists on a number unsupported by evidence."

#### Listing Proposal Builder

Inputs: property summary, seller objectives, BOV, confidentiality level, buyer universe, process style, reporting cadence. Strategy: frame assignment → present pricing stance ("Connect the pricing view to market evidence; explain how process strategy supports that pricing stance") → present process (marketed vs targeted vs confidential; OM/teaser; data room; call-for-offers path) → execution plan (milestones, broker deliverables, seller deliverables, communication cadence) → scope and boundaries ("Flag where legal counsel, title, or other third parties take the lead"). Output sections: Executive Summary · Recommended Pricing and Positioning · Recommended Process · Marketing Plan · Buyer Outreach and Qualification · Timeline and Milestones · Scope and Working Boundaries · Confidence Level. Missing-data: "If seller goals conflict, note the tradeoff explicitly."

#### Deal Term Negotiation Brief Builder

Inputs: current LOI/offer terms, seller priorities, open issues, competing offers, counsel guidance. Strategy (verbatim core):

```
Step 2: Identify Seller Priorities — organize by: must have · preferred · tradable · unacceptable
Step 3: Build the Give / Get Framework — for each open term: seller ask · buyer ask · possible trade · risk if accepted without additional consideration
Step 4: Flag Legal Escalation Items — mark issues that require counsel instead of broker judgment.
```

Quality checks: "The brief distinguishes business tradeoffs from legal issues … Every major open issue has a clear recommended posture … The brief does not drift into legal drafting." Missing-data: "If competing offer context is missing, focus on deal quality rather than pure leverage tactics."

Knowledge base `offer-negotiation-and-closing-playbook.md` — offer comparison principle (verbatim):

```
Price matters, but price alone is not the decision. Always compare:
- purchase price - deposit size - hard money timing - diligence length - financing risk
- closing timing - assignment flexibility - requested credits or carveouts - buyer credibility and retrade risk
```

When to level bids / when not to ("Do not level bids reflexively if there is one clearly superior and highly executable bid; the process is already losing momentum; the seller values certainty more than squeezing the final dollars"). Common failure modes: "seller chooses the highest price but weakest process buyer · backup bidders are dropped too early · negotiation issues become scattered across calls and emails."

#### PSA to Close Transaction Coordinator

Inputs: signed terms, key dates, deposit milestones, diligence workstreams, title/survey status, buyer request log, team. Strategy: milestone calendar (execution, deposits, diligence deadlines, title/survey, financing evidence, closing) → responsibility matrix (seller / broker / counsel / title-escrow / buyer / lender) → open-issues tracker (issue · owner · deadline · status · escalation path) → process risk ("slipping deadlines, repeated buyer requests, deposit hardening risk, unresolved diligence bottlenecks"). Quality: "Every issue has an owner … Deposit and contingency milestones are not omitted." Missing data: "If responsibility is ambiguous, assign a temporary owner and flag for confirmation."

### 4.4 Data sources and legal/TOS posture

None. Pure prompts; the user supplies data. Research notes cite NAR, CCIM, SIOR, TALCB/TREC (Texas valuation-terminology guidance), law-firm practice guides. No scraping, no APIs.

### 4.5 Disclaimers and compliance posture — the strongest of the four

`DISCLAIMER.md` covers not-advice, no professional relationship, consult licensed attorneys/CPAs/brokers/appraisers/engineers, no warranty, limitation of liability, and an explicit **AI-Generated Output** clause ("may contain errors, hallucinations, outdated information, or incorrect calculations"). Every brokerage skill enforces broker-vs-counsel boundaries and the BOV skill enforces "not an appraisal" plus state-terminology caution. README flags these as "educational and informational resources, not production software."

### 4.6 Best ideas to steal

1. **The skill template itself** (When to Use / Inputs / Mission / Strategy / Output / Quality Checks / When Data is Missing / Confidence Scoring / Related Knowledge) — adopt it as the house format for every coaching skill we build; it is small, consistent and validator-checkable.
2. **Status + Confidence on every output** (`COMPLETE | PARTIAL | BLOCKED`, `HIGH | MEDIUM | LOW` with criteria tables).
3. **BOV disclosure logic** → residential CMA/BPO. SOP 11-1 applies to our agents' CMAs; a CMA review skill should require identification, date, purpose/intended user, contemplated interest ("I'd like to be your listing agent"), limiting conditions, evidence basis, and "This is not an appraisal."
4. **Must-have / preferred / tradable / unacceptable + give/get** as the structure of every offer or counter-offer brief.
5. **"Compare offers on certainty, not just price"** — list of non-price terms maps cleanly to residential (EMD, contingency periods, appraisal gap, loan type, close date, rent-back, repair credits, buyer credibility).
6. **Business vs legal escalation** — in CA that is agent-vs-broker-of-record/counsel on RPA language; teach agents where to stop.
7. **Assignment intake → listing-appointment intake**: authority (all title holders signing?), objectives (timing/price/privacy), document inventory (disclosures, HOA docs, permits), readiness gaps.
8. **Responsibility matrix + open-issues tracker** for escrow (buyer agent / listing agent / TC / escrow / lender / Rocket).
9. **Research-note standard** (10 sources, 3 primary, dated) when we write LA-specific knowledge bases (DRE/CAR forms, LA transfer tax tiers, RSO rules).

### 4.7 Weaknesses / hollow parts

- The five skills are ~80% identical scaffolding; the Strategy steps are bullet reminders ("capture economics, capture timing") with **zero formulas, numbers, thresholds or examples**. Output formats are literal `- ...` placeholders. Everything substantive is delegated to model knowledge.
- Commercial-only vocabulary (OM, data room, BAFO, hard money, PSA, call for offers); nothing residential.
- Knowledge bases are 3–5 KB each and dated "Last updated: 2026-04-22"; U.S.-only, generic.
- Attribution footers (~600 bytes) and UTM-tagged consulting links in every file.
- The repo's README is 89 KB of pack marketing; the signal-to-noise ratio for our purpose is low outside the five files and four knowledge bases reviewed.

---

## 5. Cross-repo synthesis — top 10 reusable patterns (ranked)

1. **Comp discipline as explicit tables** (ai-realestate `comps` + wholesaler `comp-analyzer`): selection ranges with Ideal/Acceptable/Reject columns; individual ≤10% / net ≤25% adjustment caps; weighted-median-$/sqft triangulation with outlier trimming; confidence bands tied to count/distance/recency/variance; over/under-priced bands. This is the core of CMA discipline for 30 agents.
2. **Skill template with Status, Confidence, Quality Checks and When-Data-Is-Missing** (cre-agent-skills). Makes every coaching output consistent and reviewable; pairs naturally with a validator.
3. **Context matrix + freshness rules + learnings journal** (wholesaler `_system/`). Minimal-context handoff between skills; 7/30/90-day staleness; outcome feedback that calibrates the system. Nothing else in the four repos does memory this well.
4. **Deterministic finance engine with `assumptions` + `disclaimer` fields** (real-estate-mcp `finance_helpers.py`). Never let the model do payment arithmetic; every number states rate/term/DTI/tax/insurance and a not-a-lending-offer line. Add PMI grid, 28/36 and refinance break-even from ai-realestate `mortgage`.
5. **Conversation coaching skeleton** (wholesaler `conversation-coach`): READ (motivation, emotional state, objection, stage) → RESPOND (strategy by state) → CRAFT (channel-specific message) → PREDICT (2–3 replies with answers) → EXPLAIN why, plus "What NOT to say" and channel-switch rules. Directly reusable for buyer consults and seller objections.
6. **Pipeline stack-ranking with health flags and a today-anchored weekly plan** (wholesaler `deal-stacker`): five 0–5 dimensions, top-3 only, ONE next action per deal, EXPIRING/STALE/DYING/LEAD DROUGHT flags.
7. **Negotiation brief structure** (cre `deal-term-negotiation-brief-builder` + playbook): must-have/preferred/tradable/unacceptable; give/get per open term with "risk if accepted without additional consideration"; compare on certainty not price; business-vs-legal escalation.
8. **BOV/CMA disclosure logic and "not an appraisal"** (cre knowledge base, NAR SOP 11-1 aligned) — required content for any pricing opinion a licensee hands a client.
9. **Market classification + red-flag tables + "The Catch"** (ai-realestate `market`, `comps` agent, `compare`): months-of-supply/list-to-sale/DOM bands, DOM 2× area average, assessed-value gap, declining comps, and a mandatory "biggest downside of the recommendation."
10. **Output hygiene rules** (wholesaler `output-format`, ai-realestate agents): no preamble, no emoji, show data sources and gaps, FILES SAVED + WHAT'S NEXT with time estimates, two questions max before doing work, never hide bad news, under-40-line quick formats.

Honourable mentions: Fair Housing checklist and listing-copy rules (ai-realestate `listing`); hidden-cost-by-year-built table (wholesaler `rehab`); FEMA/FRED/Census free adapters with flags (real-estate-mcp); seasonality table (ai-realestate `market` agent).

---

## 6. Eight new skills a Redfin LA sales manager should build

All should follow the cre-agent-skills template (Status / Confidence / Quality Checks / When Data Is Missing), use the wholesaler context matrix and `./coaching/` memory, and call a small deterministic math module for any payment or valuation arithmetic. None should fetch Zillow/Realtor.com; all property data comes from Redfin tools/MLS exports the agent pastes or that internal tools provide.

### 6.1 `cma-review` — Pricing/CMA discipline check

**Trigger:** agent pastes a CMA (comps + proposed list price) before a listing appointment or a price-reduction conversation; manager says "check this CMA" / "is this price defensible". **Inputs:** subject facts (beds/baths/sqft/lot/year/condition/HOA), 3–10 comps with sale date, distance, $/sqft, DOM, concessions; proposed list price; sub-market (LA ZIP or neighborhood); purpose and intended user. **Process:** apply Ideal/Acceptable/Reject grid; flag comps violating 10%/25% adjustment caps; compute weighted-median $/sqft and three-method range with outlier trim; place proposed price in the over/under bands; run the red-flag table (DOM 2× area, assessed-value gap, declining trend, pending/active ratio); require SOP 11-1 content (identification, date, purpose/intended user, contemplated interest, limiting conditions, evidence basis, "not an appraisal"). **Outputs:** one-page review with Status/Confidence, a "defensible range" (Low/Mid/High), the three sentences the agent should say to the seller about price, a "The Catch" line, and a 14/21/30-day price-review trigger plan. Logs predicted range for later calibration against the sold price.

### 6.2 `buyer-consult-prep` — First-meeting brief

**Trigger:** "prep my buyer consult with [name]" or a new Redfin customer assignment with notes. **Inputs:** customer notes/texts, budget or income/debts/down payment, areas, must-haves, timeline, lender status (Rocket pre-approval yes/no). **Process:** READ the notes for motivation/emotional state/stage (conversation-coach tables); run the finance engine for max price, PITI including HOA and PMI grid, 28/36 check, rate sensitivity ±0.5%; pull the market classification for their target ZIPs; list likely objections and predicted replies; "What NOT to say"; FEMA flood and hidden-cost-by-year-built notes for the housing stock they are targeting. **Outputs:** a 40-line brief (quick-snapshot format) + the client_consultation six-part agenda + a one-line Rocket handoff prompt and a disclaimer footer ("planning estimates, not a lending offer"). Saves to `./coaching/customers/{slug}/consult.md` and appends to the agent's pipeline.

### 6.3 `listing-presentation-builder` — Seller-facing proposal

**Trigger:** "build my listing presentation for [address]" after `cma-review`. **Inputs:** CMA review output, seller objectives (timing/price/privacy/occupancy), property condition and prep items, Redfin program details (fee, photography, premier, concierge), proposed marketing calendar. **Process:** assignment-intake checklist (all title holders, authority, HOA/disclosure inventory, readiness gaps) → pricing stance tied to evidence → process (coming-soon vs full launch, offer-review date) → execution plan (milestones, agent vs seller deliverables, weekly reporting cadence) → scope boundaries (where escrow/TC/broker-of-record/counsel lead) → MLS remarks draft using the headline formulas, writing rules and Fair Housing checklist. **Outputs:** proposal outline with Executive Summary, Pricing and Positioning, Process, Marketing Plan, Timeline, Boundaries, Confidence; two headline options; a seller-objection appendix (Net Sheet Reframe reversed: full-service net vs iBuyer/wholesaler offer).

### 6.4 `offer-negotiation-brief` — Buyer- or seller-side counter brief

**Trigger:** "we got an offer/counter on [address]" or "help me write the offer strategy for [buyer]". **Inputs:** current terms (price, EMD, contingency periods, appraisal gap, loan type and lender, close date, rent-back, credits, contingencies on sale), competing offers if any, client priorities, agent notes. **Process:** must-have / preferred / tradable / unacceptable; give/get table per open term with "risk if accepted without additional consideration"; certainty score beside price (financing strength, Rocket verified approval, inspection scope, appraisal risk given `cma-review` range); flag RPA/legal items for broker-of-record; predicted other-side replies. **Outputs:** Negotiation Brief with Current Deal Snapshot, Priorities, Give/Get, Legal Review Needed, Recommended Posture, Confidence, plus the two-sentence script for the call. Appends to the deal folder.

### 6.5 `rocket-attach-coach` — Mortgage conversation and math

**Trigger:** agent asks how to position Rocket, or a buyer brings an outside pre-approval / asks "what will my payment be" / "should I buy down the rate". **Inputs:** price, down payment, credit band, loan type, HOA, LA County tax rate (~1.1–1.25% incl. assessments), current FRED 30-yr rate or Rocket quote, rent they pay now. **Process:** deterministic PITI (never P&I alone), PMI grid, 28/36, seller-credit-to-rate-buydown vs price-cut comparison, rent-vs-buy 5-year table, refinance break-even (24–36-month rule) for rate-drop objections; conversation-coach READ of the buyer's state; compliance guard rails (RESPA: no required use, no steering language; disclose affiliation; "planning estimates, not a lending offer"). **Outputs:** a numbers card with assumptions block + disclaimer, a three-line script, "What NOT to say", and the Rocket handoff step. Logs attach outcome for the learnings journal.

### 6.6 `agent-pipeline-stack` — Weekly 1:1 prep for 30 agents

**Trigger:** "stack [agent]'s pipeline" or Friday batch for the team. **Inputs:** each agent's active customers/listings (status, last contact, target close, GCI estimate, pre-approval/listing-agreement status, motivation notes). **Process:** STACK-style 0–25 score (GCI, client temperature, certainty, clock, effort), top-3 focus per agent, ONE next action each, health flags (EXPIRING contingency, STALE 7+ days, DYING 14+ days same stage, LEAD DROUGHT, OVERLOADED), team-level heat map, today-anchored weekly plan with hour estimates. **Outputs:** per-agent one-pager for the 1:1, team roll-up, and a 10-line coaching note per agent in the wholesaler terminal style (no preamble, FILES SAVED, WHAT'S NEXT). Writes to `./coaching/agents/{name}/pipeline.md` (append-only) and `learnings.md` when deals close or die.

### 6.7 `escrow-to-close-coordinator` — CA residential transaction tracker

**Trigger:** "we opened escrow on [address]" or "where are we on [address]". **Inputs:** RPA key terms and dates (acceptance, EMD, inspection/appraisal/loan contingency days, seller disclosures due, close), parties (buyer/listing agents, TC, escrow, Rocket LO, HOA), open requests. **Process:** milestone calendar from acceptance date; responsibility matrix; open-issues tracker (issue · owner · deadline · status · escalation); process-risk flags (slipping contingency removals, appraisal gap vs `cma-review` range, repeated request-for-repairs, loan conditions outstanding). **Outputs:** PSA-to-close style tracker with Status/Confidence and "Immediate Next Actions 1–3"; a weekly client-update paragraph. Every issue has an owner or a flagged temporary owner.

### 6.8 `coaching-memory` — System layer, not a user-facing skill

**Trigger:** invoked by every other skill at start and end. **Inputs/Outputs:** `./coaching/agents/{name}/`, `./coaching/customers/{slug}/`, `./coaching/listings/{slug}/`, `./coaching/market-profiles/{zip}.md` (LA ZIP snapshots with Last Updated and source), `./coaching/learnings.md` (Estimate Accuracy: CMA range vs sold; Market Patterns; What Worked; What Didn't), `pipeline.md` (append-only). **Rules:** context matrix (which skill gets which fields), freshness 7/30/90, "EXISTING DATA FOUND" prompt, address-slug convention, DATA SOURCES block with live/cached/missing, never truncate journals, outcome prompt on close/cancel. This is what makes the other seven compound instead of starting from zero each time.

---

## 7. Compliance notes specific to our shop

- **Data access:** use Redfin's own data and MLS exports; do not port any Firecrawl/WebFetch instruction that targets Zillow, Realtor.com, Homes.com or PropStream. Free federal APIs (FEMA, FRED, Census, EPA) and LA City Socrata code-enforcement data are fine.
- **Pricing opinions:** every CMA/price recommendation needs the SOP 11-1 content and "This is not an appraisal" (and, where the opinion could be used for lending, the CA licensee BPO wording). Never label a model-generated number "Fair Market Value" without the range, the evidence and the disclaimer.
- **Fair Housing:** do not port the neighborhood scoring rubrics (income, demographics, "diversity" metrics). Keep the listing-copy checklist, but have broker compliance review the "family neighborhood is OK" line.
- **Rocket attach:** every payment figure must carry assumptions and "planning estimates, not a lending offer"; scripts must avoid required-use or steering language and disclose the affiliated-business relationship.
- **Wholesaler tactics:** motivation scoring of elderly/probate/delinquent owners and subject-to pitches are out of scope for a brokerage; reuse only the *coaching mechanics* (READ-RESPOND, objection handling, honesty rules).
- **Licensing:** ai-realestate-claude and wholesaler-claude-skills are MIT (free to adapt); cre-agent-skills is Apache-2.0 (keep attribution if files are copied; rewriting in our own words avoids the footer); real-estate-mcp is AGPL-3.0 — do not fork and host; re-implement the ~150 lines of finance math from scratch.
