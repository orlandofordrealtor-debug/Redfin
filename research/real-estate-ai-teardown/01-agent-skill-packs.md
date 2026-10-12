# A. Agent Skill Packs — Teardown of Four Open-Source Claude Skill Repos for Residential Real Estate

**Scope.** Four repos cloned read-only into a local `<clone>/` folder. Every SKILL.md, CLAUDE.md, command, template, example, and system file in scope was read in full (approx. 800 KB of markdown; the realtor-claude-skills pack alone is ~450 KB across 13 skill files). No scripts were executed. Stars and reuse posture come from `SOURCES.md`.

**Reader.** A Redfin | Powered by Rocket sales manager in Los Angeles coaching ~30 agents on conversion, follow-up, listings, buyer consults, and Rocket mortgage attach.

**Reuse posture note.** Repos 1–3 are MIT (patterns and short fragments OK with attribution). Repo 4 (agency-os) ships **no LICENSE file** — the manifest marks it "ideas only, no verbatim copying," so that section describes and paraphrases rather than quoting.

---

## Table of contents

1. realtor-claude-skills (RankGrid) — 12 skills + orchestrator
2. prosperity-real-estate-skills (The Prosperity Agent) — Fair Housing overlay + 3 skills
3. awesome-claude-cowork-plugins — `real-estate` and `mortgage-broker` plugins only
4. agency-os (sparkles-inc) — 6-specialist folder system
5. Cross-repo synthesis: top 10 reusable patterns, ranked
6. Recommended new skills for a Redfin LA sales manager (8 specs)

---

## 1. realtor-claude-skills — "Real Estate Agent Claude Skills, by RankGrid"

### 1.1 Identity

| Field | Value |
|---|---|
| Repo | github.com/miron-tech/realtor-claude-skills |
| Author | Miron Briley (RankGrid, rankgrid.ai) |
| License | MIT (LICENSE file present, © 2026 Miron Briley) |
| Stars / last commit | 15 stars; `7ef6154` 2026-10-07 "Rebrand to RankGrid; add MIT license; fix outdated setup steps" |
| One-line purpose | Turn Claude Code into a solo agent's back office: research leads, pull live comps, generate listing marketing, build follow-up sequences, run sphere/review programs — all saved to a local `./clients/` memory tree; every "sendable" skill ends with an upsell to the RankGrid automation platform. |

### 1.2 Architecture

**Layout**

```
realtor-claude-skills/
  CLAUDE.md                       <- entry point; says "read start-here first"
  README.md
  LICENSE (MIT), .gitignore (ignores clients/, deals/, .env, .mcp.json)
  _system/
    output-format.md              <- terminal visual design system (13 KB)
    client-memory.md              <- ./clients/ persistence protocol (18 KB)
  .claudeskills/
    start-here-SKILL.md           <- orchestrator/router (19 KB)
    lead-recon-SKILL.md           (43 KB)   nurture-coach-SKILL.md       (51 KB)
    comp-crusher-SKILL.md         (39 KB)   listing-presentation-SKILL.md(46 KB)
    listing-arsenal-SKILL.md      (37 KB)   open-house-machine-SKILL.md  (42 KB)
    market-intel-SKILL.md         (32 KB)   neighborhood-dominator-SKILL.md (49 KB)
    prospector-SKILL.md           (36 KB)   sphere-engine-SKILL.md       (26 KB)
    review-engine-SKILL.md        (23 KB)   investment-analyzer-SKILL.md (43 KB)
```

Note the non-standard `.claudeskills/<name>-SKILL.md` flat layout rather than `skills/<name>/SKILL.md`. Each file has YAML frontmatter (`name`, `description`) and then a long, uniformly structured body: Purpose → Prerequisites → What it does / does not do → Inputs table → Goal → Frameworks → MCP usage → Decision logic → Constraints → Output format → Complete worked example → Client memory → Quality checklist → Known limitations.

**Triggering and chaining.** `CLAUDE.md` instructs Claude to read `start-here-SKILL.md` on every task. `start-here` is a keyword router plus a pipeline scanner:

```
IF user provides an address (any format) ->
  Check if address exists in ./clients/
  IF exists -> Show existing data, offer update or next skill
  IF new -> Route to /lead-recon
IF user says "comps" or "CMA" or "what's it worth" or "pricing" -> Route to /comp-crusher
IF user says "follow up" or "cold lead" or "what do I say" or "ghosted me" -> Route to /nurture-coach
...
IF user says "analyze this listing" ->
  Chain: /comp-crusher -> /listing-presentation -> /listing-arsenal
```

Compound requests map to chains; chains of 3+ steps show a plan with time estimates and wait for "Run all / Just comps / Skip to 3". Two-step chains run without confirmation. A **Gap Map** says what upstream data each skill wants and the impact of running without it; the orchestrator surfaces a gap box but "Never block the user. Always offer 'continue without.'"

**Context Matrix** (the most transferable orchestration idea here): each skill receives *only* the files it needs from prior skills, with a "Does NOT Receive" column, and a stated rationale:

> A nurture coach that receives the full 30-comp analysis will try to reference every data point. That is not how an agent talks to a lead.

**Memory/state** (`_system/client-memory.md`):

```
./clients/
  pipeline.md               <- append-only registry: Buyer Leads / Seller Leads / Listings / Closed Deals
  learnings.md              <- append-only journal: Pricing Accuracy, Lead Conversion Patterns,
                               Market Patterns, Marketing Results, What Worked, What Didn't Work
  content-calendar.md
  market-profiles/{zip}.md  <- cached area data; MUST carry "Last Updated:" and "Scope:" lines
  sphere/contacts.md
  {lastname}-{address-slug}/   lead-recon.md, comp-analysis.md, nurture-sequence.md,
                               listing-presentation.md, listing-assets/, notes.md
```

Freshness rules are uniform and worth stealing verbatim:

```
| Age        | Status  | Action                                                   |
| < 7 days   | Fresh   | Use as-is                                                |
| 7-30 days  | Stale   | Use but flag: "Data is X days old — may have shifted"    |
| > 30 days  | Expired | Re-pull from source. Overwrite the cache file.           |
```

A **Market Data Consistency Protocol** makes `/market-intel` the authoritative writer of `market-profiles/{zip}.md`; other skills read it rather than issuing their own Perplexity queries, and the orchestrator shows a "MARKET DATA CONFLICT" box when two skills disagree on the same ZIP (likely cause: scope mismatch — "Lakewood neighborhood in 75214" vs "all of 75214").

A **Deal Outcome** prompt (a–h menu: closed buyer side / closed seller side / dead – ghosted / dead – lost to another agent / dead – fell through / still working) feeds `learnings.md`, moves the pipeline row, adds the client to sphere, and offers `/review-engine`. This is the "system gets smarter" loop.

**Output-format conventions** (`_system/output-format.md`): terminal-native, no markdown, no emoji, fixed Unicode palette (`━ ─ ┌│└ ├── ✓ ✗ ◑ ○ ★ ① →`), 55-char line width. Four mandatory sections in order: **Header → Content → FILES SAVED → WHAT'S NEXT** (2–4 next skills with time estimates). A DATA SOURCES tree shows `✓ live / ✓ cached (3 days old) / ✗ not available` for every pull. Anti-patterns are explicit ("DO NOT use chatbot preamble", "DO NOT hide data gaps"). A **RankGrid "MANUAL vs AUTOPILOT" callout** is mandatory on sendable skills (nurture, sphere, review, arsenal, open house, market intel) and forbidden on research skills (recon, comps, investment, presentation).

**External tooling.** Perplexity MCP (market/area data) and Firecrawl MCP (Redfin/Zillow scraping) are "recommended"; every skill degrades to manual input. A repeated, hard-won operational rule:

```
CRITICAL: Two-Step URL Pattern
Never construct Redfin/Zillow URLs directly — internal IDs cause
redirects to wrong properties. Always:
1. firecrawl_search → "[full address] site:redfin.com" (find URL)
2. Verify the URL path contains the correct address
3. firecrawl_scrape → the verified URL with proxy: "stealth", waitFor: 5000
```

Parallel execution plans ("Batch 1 fire simultaneously / Batch 2 after URL found / Batch 3 compile") appear in recon, investment, and dominator.

### 1.3 Mechanics, skill by skill

**/start-here (orchestrator).** Inputs: any message + `./clients/` state + MCP availability. Process: first-run vs returning mode (returning mode must scan `pipeline.md`, flag clients with no update >7 days, and print a Pipeline Status with ★ Hot / ◑ Working / ○ Nurturing tiers before routing). Max two questions before doing work. Outputs: routing decision, pipeline status, chain plan. Ten anti-patterns, e.g. "Never present the skill list as a menu", "Never sugarcoat a bad situation."

**/lead-recon.** Inputs: address (minimum), source, what they said, buyer/seller, mode. Fast Mode (one Firecrawl + one Perplexity call, 60-second target) vs Deep Mode (full scrape, neighborhood deep-dive, quick comps, equity position, talking points, investment lens). Two rubrics:

Lead Classification Matrix (7 types with response strategy):

```
| Ready Now Seller | "What's my home worth?" + owned 7+ years          | CMA offer within 24 hours        |
| Ready Now Buyer  | Pre-approved + specific area + timeline < 90 days  | Show homes this week             |
| Future Seller    | "Thinking about selling" + no timeline             | Monthly market updates for ZIP   |
| Future Buyer     | "Just starting to look" + no pre-approval          | Lender intro + education drip    |
| Investor         | Multiple property searches + cash buyer signals    | Investment analysis + deal flow  |
| Relocation       | Out-of-area phone number + job transfer mention    | Area guide + relocation package  |
| Sphere Referral  | Came from past client or sphere member             | Priority response + thank source |
IF ambiguous → DO NOT GUESS. Note: "Could not determine buyer/seller — ask in speed response"
```

Motivation Score (1–10), evidence-only:

```
| Pre-approved or owns free and clear              | +2 |
| Specific area/neighborhood search (not browsing)  | +2 |
| Timeline mentioned (under 90 days)                | +2 |
| Responded to a specific listing                   | +1 |
| Referral source                                   | +1 |
| Urgency words (relocating, divorce, estate...)    | +1 |
| Multiple inquiries / return visitor               | +1 |
| "Just browsing" / no timeline                     | -1 |
| Won't share contact info                          | -1 |
| Already has an agent                              | -2 |
8-10 HOT respond <5 min | 5-7 WARM <1 hr | 3-4 COOL <4 hrs | 1-2 COLD long-term drip | <=0 NOT A LEAD
> Only score signals you actually have evidence for. Don't assume.
```

Speed Response rules (reusable as a coaching checklist):

```
1. Reference at least ONE specific detail about their property or area (not generic)
2. Feel like a human texted it — no corporate language, no "Thank you for your interest"
3. End with a question (questions get replies)
4. Be under 300 characters for SMS / 3-4 sentences for email
5. Match the lead type (don't pitch a CMA to a buyer, don't pitch listings to a seller)
6. Never say "I'd love to help" or "I'm here for you" — just demonstrate you already know something useful
```

Seven lead-type templates follow. Decision logic adds source heuristics: "IF lead source is sign call → Classify as HOT (they drove to the property)"; "open house → WARM minimum"; "Zillow/Realtor.com → one level hotter". Outputs: property snapshot, area context, classification, score, SMS + email speed response, talking points (deep), files saved, pipeline row.

**/nurture-coach.** Inputs: name, buyer/seller, what happened, previous touches. Classifies into 6 buyer archetypes (First-Timer, Move-Up, Downsizer, Investor, Relocator, Price-Sensitive) and 5 seller archetypes (Ready Now, Testing Waters, Divorce/Estate, Upgrade Seller, Investor Exit), each with signal / psychology / follow-up angle / close timeline / typical objection / channel preference. Builds a 7-touch cadence:

```
| 1 | Day 0  | Text or phone              | Speed response — acknowledge, add value, set next step |
| 2 | Day 2  | Email                      | Value-add follow-up — market data, area insight, CMA recap |
| 3 | Day 5  | Different channel / video  | Channel rotation |
| 4 | Day 10 | Text (pattern interrupt)   | NOT about real estate — personal, human, memorable. Verify any local reference via Perplexity. |
| 5 | Day 21 | Email or text              | Re-engage with new info — new listing, price change, market shift |
| 6 | Day 45 | Video message or text      | Long-game check-in — no ask, just value |
| 7 | Day 90 | Text                       | Honest check — "Are you still thinking about it?" |
```

Each touch must specify: channel, the exact words (no brackets), why it works, if-they-respond, if-they-don't. Cadence compresses for Ready Now Sellers (Day 0/1/3) and Investors (0/1/3/7), extends for Testing Waters (0/7/21/45/75/120/180) and softens for Divorce/Estate. Objection playbook structure: **Acknowledge → Reframe with data → Soft next step**, for 10 objections (rates, already have an agent, friend is an agent, FSBO, commission, wait for spring, talk to spouse, cheaper elsewhere, market crash). Re-engagement templates at 3/6/12 months; four sub-45-second video scripts. Dead Lead Signals table defines stop conditions ("Stop contacting me" → remove immediately). Constraint: every SMS under 300 chars, "Never say 'just following up' or 'just checking in' — every touch must add value."

**/comp-crusher.** Inputs: address + optional beds/baths/sqft/condition/payoff/commission. Process: scrape subject → scrape 10–15 solds (0.5 mi → 1 mi → 1.5 mi; 6 → 9 → 12 months) → adjust → rank → weighted average → 3 tiers → net sheet per tier → market context (from cache first) → save. Adjustment transparency rules are strong:

```
- Every adjustment MUST show the full calculation (e.g., "566 sqft x $132/sqft = +$74,690")
- If an adjustment exceeds 15% of the comp's sale price, FLAG it as "LARGE ADJUSTMENT —
  reduces comp reliability" and reduce that comp's relevance score by 1 point
- The recommended list price MUST explain any deviation from the weighted average
```

Relevance scoring (weights): Recency 30% (0–6 mo = 10, 6–9 = 7, 9–12 = 4), Proximity 25% (<0.25 mi = 10 … 1.0+ = 3), Size 20% (within 5% sqft = 10 … 20% = 3), Condition 15%, Age 10%. Quality flags `[STRONG] [GOOD] [MARGINAL] [USE WITH CAUTION]`. Pricing tiers: Aggressive = 2–4% below adjusted average (DOM 7–14), Market = at average (21–35), Aspirational = 3–5% above (45–60+, likely reduction). Prices round to $5,000. Net sheet lines: buyer-agent commission, seller-agent commission, title/escrow, transfer tax ("TX = none, CA = $1.10 per $1,000"), recording, prorated taxes, warranty, payoff; mandatory disclaimer "Net sheet is an estimate for discussion purposes." Edge cases: new construction, flips (ARV), condos (same-complex first), rural, luxury ($750K+ widen early). Post-NAR-settlement note: buyer commission negotiable, default 2.5%/3%.

**/listing-presentation.** 10 sections: Cover, Why Me, Market Overview, Comparable Sales, Pricing Strategy, Marketing Plan, Communication Plan, Net Proceeds, Timeline, Next Steps. Seller-type tone detection (emotional / analytical / first-time / motivated / unknown). Honesty constraint: "If the agent does not provide stats... leave placeholder brackets: `[YOUR TRANSACTION COUNT]`. Do not invent numbers." Differentiator rules give good/bad examples ("I sell homes in Lakewood 11 days faster than the market average" vs "I work harder than anyone else"). The **Cost of Overpricing** block is directly reusable for seller consults:

```
Homes that start overpriced and reduce later sell for less than homes priced correctly from day one.
Data from {area}:
├── Homes priced right:        avg {X} DOM, sold at {Y}% of list
├── Homes with 1 reduction:    avg {X} DOM, sold at {Y}% of ORIGINAL list
└── Homes with 2+ reductions:  avg {X} DOM, sold at {Y}% of ORIGINAL list
Every 30 days on market costs approximately ${amount} in carrying costs.
```

Communication Plan section ("Sellers fire agents over communication failures, not marketing failures") specifies weekly written report day, 24-hour showing feedback, offer presentation SLA, response-time promise, and a Decision Framework line. Week-by-week marketing timeline (Launch / Momentum / Evaluate / Adapt). No RankGrid callout here (it is the agent's client document).

**/listing-arsenal.** One address + list price → 29 assets in 7 files: MLS short (250 chars hard cap) / full (<1,000 chars) / broker-to-broker remarks; 8 social (IG caption with 15–20 hashtags, 5-slide carousel, FB conversation post with no hashtags, FB lead-form ad with 2 A/B variants, TikTok/Reels 3-second hook, LinkedIn, GBP, Nextdoor); 3 emails (buyer database, sphere, agent-to-agent); 3 open-house pieces; 4 property marketing (feature→benefit highlight sheet, neighborhood selling points, price-positioning narrative, 2–3 min video script); 5-day Coming Soon drip (Mystery → Neighborhood → Feature 1 → Feature 2 + early access → Full Reveal); 3 graphic prompts (Just Listed, Open House, Price Reduced pre-built). Positioning logic by price band (`>= $750K` LUXURY, `< $300K` STARTER, investor, DIFFERENTIATOR, OPPORTUNITY, condo COMMUNITY). UTM scheme: `?utm_source=[platform]&utm_medium=social&utm_content=listing-arsenal`.

**/open-house-machine.** Three phases. Pre-event: 3-post countdown (teaser 5 days out / neighborhood 3 days / reminder day before), buyer and sphere email invites, 30-second door-knock script + leave-behind card, Facebook event copy, lead-form ad with radius targeting, graphic prompt. Day-of: sign-in sheet with qualifying questions (agent? what brought you? timeline 0–3 / 3–6 / 6–12 / curious) and conversation scripts for 5 visitor types (Nosy Neighbor → CMA; Buyer Without Agent → pre-approval + alerts; Buyer With Agent → be helpful, "DO NOT bad-mouth their agent, actively recruit them, push your services"; Investor; Lookie-Loo). Four seller-feedback questions. Post-event: category follow-ups with SLAs (hot buyer within 2 hours, neighbor within 4), seller OPEN HOUSE REPORT (attendance, breakdown, interest level, feedback themes, recommendations, follow-up status), social recap, non-attendee follow-up. Decision logic switches phase on phrases like "open house is done" or a visitor count.

**/market-intel.** ZIP/neighborhood → Perplexity pull of core stats + trends → market classification → report → 7 platform pieces → cache + calendar. Classification rubric:

```
IF DOM < 15 AND list-to-sale > 99%    -> HOT SELLER'S MARKET
IF DOM 15-30 AND list-to-sale 97-99%   -> BALANCED MARKET
IF DOM > 30 AND list-to-sale < 97%     -> COOLING / BUYER-FRIENDLY
INVENTORY OVERLAY: <2 mo thin | 2-4 healthy | >4 buyers have breathing room
TREND OVERLAY: price up YoY -> equity angle for sellers, urgency for buyers; DOM up -> note the shift
```

Report has WHAT THIS MEANS FOR BUYERS / SELLERS and a mandatory HOT TAKE ("must have an actual opinion, not a stat recap"). Platform rules are specific: IG hashtags in first comment; FB no links/no hashtags; GBP 75–100 words; Nextdoor 100–175 words, no links, no "DM me", mention your role once. Multi-ZIP comparison table mode.

**/neighborhood-dominator.** ZIP → 5 parallel Perplexity calls → (1) 10-section neighborhood guide lead magnet including "Best Streets + Micro-Neighborhoods", "The honest trade-off (every neighborhood has one)", and cost-of-living comparison; (2) 12-month content calendar with weekly rotation (Market Update / Local Business Spotlight / Seasonal / Best-Of / Wildcard) and monthly anchors; (3) 6 SEO page outlines with target keywords, meta title <70 chars, meta description <155, schema, internal-link graph; (4) GBP strategy: 8 weeks of posts, seeded Q&A, photo list, review strategy ("ask for a review that mentions the neighborhood by name"); (5) social kit. Constraint: "No 'hidden gem' or 'best-kept secret'."

**/prospector.** Three modes. EXPIRED: scrape original listing, then a Failure Analysis Framework scoring PRICING (OVERPRICED/MARGINAL/OK; "If first reduction came after 30+ days, they chased the market down"), MARKETING QUALITY (photo count <15 weak / 15–25 adequate / 25+ strong; description <100 words; virtual tour present?), MARKET TIMING, AGENT PERFORMANCE, CONDITION → verdict with confidence; 5-channel outreach (phone with ≥3 objections, 150–200-word email, <300-char text, handwritten note ≤5 sentences, 30-second video). "Never trash the previous agent." FSBO: price accuracy vs comps, exposure gaps, liability risks (disclosures, fair housing in advertising, contract risk), and a FSBO-vs-agent **net proceeds comparison** ("this is the data that converts"). CIRCLE: just-sold/listed trigger → neighbor letter, door-knock, social post, radius email. Batch mode ranks prospects by conversion probability.

**/sphere-engine.** Category cadences (past clients 0–2 yrs monthly; 2–5 yrs bi-monthly; 5+ quarterly; referral partners monthly; friends/family quarterly). 12-month rotation: anniversary → neighborhood market update → seasonal tip → local event → **soft referral ask (Month 5, only after 4 value touches)** → home value update → tip + resource → community content → market update #2 (compare to Month 2) → financial tip → **gratitude touch with ZERO ask (Month 11)** → year-end recap + direct referral ask (Month 12). Every touch in 4 formats (email <50-char subject, SMS <300 chars, social DM 2–3 sentences, handwritten note for VIPs only).

**/review-engine.** 3-touch review request (closing-day text 2–4 hours after keys, Day-3 email with 2–3 prompts so they know what to write, Day-7 text; "after 3, stop asking"), 5 rotating 5-star response variants ("Not start with 'Thank you for your kind words'"), 4-star template, and the HEARD framework for ≤3 stars:

```
H — HEAR       Acknowledge their specific concern. Repeat it back.
E — EMPATHIZE  Connect to their experience, not a scripted line.
A — APOLOGIZE  Take responsibility. Do not deflect. Do not explain.
R — RESOLVE    Offer to make it right. Take it offline.
D — DIAGNOSE   Explain what you will do differently — for the NEXT reader.
Keep it under 150 words. Never argue. The audience is the next client reading reviews.
```

3-touch referral sequence (closing-day gratitude card with zero ask → Day-14 settling-in value text → Day-90 direct ask). Testimonial extraction into 4 formats (website snippet, <80-char graphic text, presentation quote, signature line) preserving the client's words. Review velocity benchmarks via Perplexity.

**/investment-analyzer.** Address + price → rent comps (5–10) → cash flow at 20/25/30% down (vacancy default 8%, maintenance 1%/yr, management 10% even if self-managed) → cap rate (explicitly excluding mortgage), cash-on-cash (8–12% target), GRM (<10 strong), DSCR (>1.25 lender-friendly) → value-add (rent bump, ADU with lot ≥5,000 sqft, Section 8 FMR, STR legality) → 5/10-year hold with conservative/moderate/optimistic appreciation → BRRRR feasibility (cash back ≥ total invested = full cash-out; <80% = "BRRRR may not be the right strategy") → jurisdiction risk (landlord- vs tenant-friendly states; "IF city has rent control...") → Deal Scorecard (Cash Flow / Appreciation / Risk 1–10, STRONG BUY / BUY / HOLD / PASS) → "What Makes / What Kills This Deal". The worked example honestly returns HOLD on a negative-cash-flow property.

### 1.4 Compliance posture

Essentially absent, and in places actively risky:

- **Fair Housing: one mention in the whole pack** (a bullet in the FSBO liability checklist). No protected-class list, no steering guard, no banned-phrase list.
- Speed-response templates and MLS copy **lead with school names and ratings** ("Your home sits in the [school name] district which is pulling strong buyer interest right now"; "Stonewall Jackson Elementary (8/10)" in Facebook ad copy). Neighborhood guide includes "Crime rate relative to city average" and "Is Lakewood Dallas safe?" FAQ. Nurture profiles encode familial-status framing ("young families", "empty nest"). This is the opposite of the Prosperity overlay.
- **TCPA**: the entire nurture/prospecting engine texts cold expireds and FSBOs with no consent check. No opt-out language in any SMS template.
- **RESPA / lender**: Future Buyer template promises "I work with a lender who can get that done in 24 hours — want an intro?" with no affiliated-business or no-referral-fee language.
- Positives: net-sheet disclaimer; "Do not invent numbers" in presentation; "No HARD NO words" brand-voice list (but `brand-voice-SKILL.md` is referenced in four skills and **does not exist in the repo**); "Never bad-mouth other agents"; "Always recommend CPA and attorney" in investment analysis; honest about estimated vs confirmed data.
- Unsourced stats are presented as fact throughout: "78% of transactions go to the first agent who responds", "44% of agents give up after 1 follow-up", "referrals convert at 4x", "FSBOs sell for about 13% less (NAR data)". Treat as marketing copy, not research.

### 1.5 Best ideas worth stealing (Redfin LA sales manager)

1. **Evidence-only motivation scoring with a visible ledger** (+2/+1/−2 lines) is a perfect coaching artifact: agents can be taught to score Redfin-routed contacts in 30 seconds and the manager can audit why a contact was deprioritized.
2. **Speed Response rules 1–6** as a one-page SLA for first contact on tour requests and inquiries; adapt "sign call = HOT" to "tour request with time selected = HOT".
3. **Touch spec: channel / exact words / why it works / if-respond / if-not** — the discipline that makes follow-up coachable. Pair with the Dead Lead Signals stop table.
4. **Objection structure Acknowledge → Reframe with data → Soft next step**, especially "wait for rates to drop" and "already have an agent" (one respectful touch then stop).
5. **Comp adjustment transparency + 15% large-adjustment flag + relevance weights** for listing consults; agents defend pricing "at the kitchen table" with math.
6. **Cost of Overpricing block** and the **Communication Plan** section — both reduce listing cancellations.
7. **Open house visitor-type scripts + 2-hour / 4-hour follow-up SLAs + seller report.**
8. **learnings.md as a team journal**: outcome taxonomy (a–h) and sections (Pricing Accuracy, Lead Conversion Patterns, What Worked/Didn't) could become the manager's weekly retro format across 30 agents.
9. **Market cache with Scope + freshness** prevents two agents quoting conflicting numbers for the same LA sub-market in the same week.
10. **Output contract: FILES SAVED + WHAT'S NEXT every time** — makes skills composable and keeps agents moving to the next action.

### 1.6 Weaknesses / what is hollow

- Dangling references: `brand-voice-SKILL.md`, `/lead-magnet`, `/seo-content`, `/content-atomizer`, `/creative`, "the pdf skill" — none shipped. Quality checklists demand "No HARD NO words" against a list that does not exist.
- Example data is partly stale/fabricated (Dallas "Stonewall Jackson Elementary" was renamed in 2018; all market numbers are illustrative). Fine as templates, but the pack blurs example and fact.
- Marketing funnel baked into the skills: RankGrid callout is mandatory output, README/CLAUDE.md are sales pages. Strip before internal use.
- Heavily MCP-shaped (Perplexity + Firecrawl scraping of Redfin/Zillow). For a Redfin employee this is both unnecessary (first-party data) and likely a ToS problem.
- Single-agent, solo-operator mental model: no team roster, no manager view, no handoffs between people, no voice matching. "Pipeline status" is one person's pipeline.
- Length: 30–50 KB per skill, with the worked example often half the file. Token-expensive to load; several skills would be trimmed 60% with no loss.
- Compliance gap described above is disqualifying for a brokerage without an overlay.

---

## 2. prosperity-real-estate-skills — "Claude Skills for Real Estate Agents"

### 2.1 Identity

| Field | Value |
|---|---|
| Repo | github.com/TheProsperityAgent/prosperity-real-estate-skills |
| Author | Al & Victoria Pinder, "The Prosperity Agent" (eXp Realty ICON agents, NC licenses listed) |
| License | MIT (© 2026 Al Pinder and Victoria Pinder) |
| Stars / last commit | 10 stars; `b262bb9` 2026-07-26 "Scrub county-name references from skill examples (brand rule: no market names in Prosperity assets)"; plugin version 1.1.0 |
| One-line purpose | Four small, free, "Fair Housing compliant by default" skills — a compliance overlay, a 145-word listing description, an MLS-export workflow, and three quick-start prompts — positioned as the manual tier beneath a paid eXp-sponsorship relationship. |

### 2.2 Architecture

```
prosperity-real-estate-skills/
  .claude-plugin/plugin.json, marketplace.json   <- installable via /plugin marketplace add
  .github/workflows/banned-terms-check.yml        <- CI: fail push if any secret BANNED_TERMS appear
  README.md, CONTRIBUTING.md, LICENSE
  skills/
    fair-housing-overlay/SKILL.md + examples/{before-after,failure-modes}.md
    listing-description/SKILL.md  + examples/{before-after,failure-modes}.md
    quick-start-3-wins/SKILL.md   + examples/{before-after,failure-modes,sample-listing.txt}
    connect-mls-to-claude/SKILL.md
```

Standard `skills/<name>/SKILL.md` with frontmatter (`name`, `description`, `author`, `version`). **Every skill ships an `examples/` folder with `before-after.md` and `failure-modes.md`** — the pack's signature idea. CONTRIBUTING.md defines a SKILL.md template (When to use / What it does / Prompt / Compliance notes / Companion content) and PR compliance gates ("Pass Fair Housing review (no school refs, no demographic targeting)", "Avoid scarcity language", "Stay positive", "Not embed real client data").

**Triggering/chaining.** No orchestrator. The overlay is meant to be loaded *first* and alongside any task skill (`/skill load fair-housing-overlay` then `/skill load listing-description`); task skills repeat the compliance lines inline as a fallback and are told to place `REQUIRED COMPLIANCE` as the final instruction ("Final = highest priority"). No memory/state. Output format: plain prose; the listing skill demands "145 words exactly". Each skill ends with a mandated attribution/upsell line ("Built by Al and Victoria Pinder... The version that pulls your MLS automatically every morning... is what we set up with the agents who partner with us").

**CI as compliance.** `banned-terms-check.yml` greps every tracked file and the latest commit message for a comma-separated secret list and blocks the push. The purpose stated in the file: "Defense against accidentally leaking internal-only paid-tool names." The mechanism is reusable for brand/compliance lint.

### 2.3 Mechanics

**fair-housing-overlay.** Four rule sets, each with refuse + rewrite behavior.

Rule Set 1 (FHA) — refuses copy that "References schools by name, ranking, district, or perceived quality", describes demographics, implies steering, or uses coded language; rewrites:

```
- Schools → location/commute or specific drive times to employers
- "Family-friendly" → specific objective amenities (parks, sidewalks, lot size)
- "Quiet neighborhood" → "low-traffic street" (objective, measurable)
- "Safe area" → no replacement; this phrase is forbidden because safety perception varies by demographic
```

Protected classes are "the union of all federal + state-protected classes"; failure-modes item 10 lists state extensions (California: source of income, marital status, AIDS/HIV status).

Rule Set 2 (TCPA) — refuses cold-text/cold-call scripts and mass SMS without opt-in; redirects to opt-in lead magnets, owned channels, one-to-one replies to inbound. Failure mode 7 adds the consent flag: pass `consent_on_file: opted-in via website form 2025-11-14` so the overlay distinguishes "consent unknown (refuse)" from "consent on file (proceed)".

Rule Set 3 (MLS data quality) — banned clichés: must-see, won't last, act now, rare opportunity, once-in-a-lifetime, hidden gem, show stopper, priced to sell. Claimed rationale: aggregators downrank these (unsourced).

Rule Set 4 (Always positive) — never knock a town, builder, agent, brokerage, or platform; cites NAR Code of Ethics Article 12. Failure mode 8 shows how to state comparative data without comparative framing ("Two facts, no comparison phrase").

Before/after examples annotate each violation. The TCPA example output is the refusal itself:

> SKILL REFUSED. This pattern reads as cold-list re-engagement targeting non-currently-opted-in contacts... The skill outputs nothing for this prompt.

Failure mode 4 specifies the block message format, which is directly reusable:

```
If a rule set blocks content, output:
  BLOCKED — [rule set name]: [matched phrase]
  Suggested rewrite: [compliant alternative]
```

Other failure modes worth keeping: proper-noun masking (a subdivision named "Oakwood School District" trips `\bschool\s+district\b`), run the overlay on alt text/captions/meta descriptions too, single-source blocklist JSON shared by overlay and any supervisor.

**listing-description.** The whole prompt (under 25 lines, reusable):

```
You're writing a [CITY] [STATE] listing description for me, an agent.
REQUIRED COMPLIANCE (load fair-housing-overlay if available):
- NO clichés: never use "must-see", "won't last", "rare opportunity", "hidden gem", "priced to sell", "act now"
- NO school references
- NO demographic targeting or steering language
- NO "safe", "quiet" (replace with "low-traffic street")
- ALWAYS positive
REQUIRED OUTPUT:
- 145 words exactly (MLS field cap)
- Tone: warm, specific, factual
- Open with the strongest objective feature
- Middle: floor plan, indoor flow, key spaces
- End: ONE line about [CITY] life that doesn't mention schools
  (use commute time to a major employer, or a public park, or a downtown amenity...)
PROPERTY DATA: Address / Beds/Baths / Sqft / Lot / Year built / Standout features (pick 3) /
Major nearby employer / park / amenity for the close: [ANCHOR]
```

Variants: luxury ("restraint over hype"; failure mode: "NEVER 'stunning', NEVER 'exclusive'"), new construction, investor (close with cap rate/rent range). Failure modes include word-count drift, closing-line defaulting to schools when no anchor is passed, pattern over-use across listings ("maintain a 'patterns used recently' list"), and "Output reads as AI-generated" → add one small human detail ("The ceiling fan in the primary suite stays").

**quick-start-3-wins.** Three one-paragraph prompts: listing description (above, shorter), a **counter-offer reply email** ("holds my position on price but signals flexibility on close date / inspections / appliances. Tone: collegial, no pressure"), and three social posts from an MLS pull with platform caps (IG ≤2200 chars, FB ≤700, TikTok ≤300, 5 hashtags). The before/after on the counter-offer is a genuinely good negotiation lesson: the "before" leaks "young couple just starting out" (FHA-adjacent) and "absolute max they qualified for" (financing ceiling leak).

**connect-mls-to-claude.** Not an integration; an expectations-setting workflow: there is no national MLS, export CSV is the universal path, API/IDX only if your MLS offers it. Rules: "Use only the numbers in the agent's file. Do not invent a price, a comp, a school rating, or a trend"; respect MLS display rules; "No em dashes."

### 2.4 Compliance posture

The strongest of the four by far: FHA + state unions, TCPA consent gating, MLS cliché list, NAR Article 12 anti-disparagement, citations to 42 U.S.C. 3601, 47 U.S.C. 227, HUD, NAR. Also protects the seller's and buyer's privacy (never pass names into prompts). Weak spots: no RESPA/lender content; the "school district" ban is stricter than HUD guidance (naming a district factually is generally permitted — the cowork pack's "within [District Name]" is the more common compliant position); some claims unsourced ("feeds downrank these phrases"); "no em dashes" is stylistic dogma; failure-modes reference regexes and a "compliance supervisor" that are not in the repo (they belong to the paid stack).

### 2.5 Best ideas worth stealing

1. **Load-first compliance overlay with refuse/rewrite semantics and the `BLOCKED — [rule]: [phrase] / Suggested rewrite:` output contract.** Extend with CA protected classes (source of income, marital status, etc.), RESPA language for Rocket, and DRE advertising rules (license number, broker name).
2. **`examples/before-after.md` + `examples/failure-modes.md` per skill** — this is how you make skills coachable and debuggable for 30 agents of varying skill. Failure modes double as the FAQ for the manager's office hours.
3. **Consent flag on outreach skills** (`consent_on_file:`) — map to Redfin's contact source (customer initiated a tour/inquiry vs cold).
4. **"Anchor for the close"** input (employer/park/transit, never schools) — LA version: "12 minutes to UCLA Health", "two blocks to the E Line".
5. **Counter-offer email prompt** — small, high-leverage, and teaches the "hold price, flex terms, never leak the ceiling" lesson.
6. **CI banned-terms lint** for a shared skills repo (brand names, internal tools, banned phrases).

### 2.6 Weaknesses

- Very thin: four short prompts; the overlay is prose rules, not an enforceable mechanism (the regex/blocklist machinery is referenced but not shipped).
- No memory, no chaining, no orchestrator, no data.
- Every skill ends in an eXp recruiting pitch; the README is explicit about revenue share. Strip before internal use.
- "145 words exactly" is presented as a universal MLS cap; CRMLS limits differ (public remarks are character-count limited, not word-limited). Verify locally.
- Market-neutral by brand rule ("no market names in Prosperity assets"), so examples are generic "Springfield".

---

## 3. awesome-claude-cowork-plugins — `real-estate` and `mortgage-broker` plugins

### 3.1 Identity

| Field | Value |
|---|---|
| Repo | github.com/alexclowe/awesome-claude-cowork-plugins (44–47 profession plugins; only `real-estate/` and `mortgage-broker/` analyzed) |
| Author | The AI Career Lab (hello@theaicareerlab.com) |
| License | MIT (© 2026 The AI Career Lab) |
| Stars / last commit | 30 stars; `c75a5d8` 2026-09-25 "Sync 47 plugin(s) from ai-career-lab" (bot-synced from a private source) |
| One-line purpose | Install-in-one-command Claude Cowork/Code plugins per profession: a few slash commands with rigid output templates plus "auto-activating" background knowledge skills, all ending in disclaimers and links to a $19 prompt pack. |

### 3.2 Architecture (shared plugin structure)

Every profession folder is identical in shape:

```
<profession>/
  .claude-plugin/plugin.json      <- name, description, version, author, homepage, license, keywords, category
  README.md                       <- command table, skills, usage examples, disclaimer, install, upsell links
  commands/<verb>.md              <- frontmatter: description + user-invocable: true; body = full system prompt
  skills/<domain>/SKILL.md        <- frontmatter: name + description; body = "You have deep expertise in..."
```

Root `.claude-plugin/marketplace.json` lists all plugins with `source`, `category`, `tags`. Commands are explicit user invocations with a fixed output skeleton; skills are passive domain priors that "activate automatically when you're working on real estate tasks." No memory, no chaining, no routing; a command can rely on the skill being in context. Several commands end with a **"Print-ready page — always finish with this"** step: build a self-contained HTML sheet with a "Print / Save as PDF" button, rendered as an artifact when the surface supports it, with client-facing copy only (internal ledgers excluded).

### 3.3 Mechanics — `real-estate` plugin

**skills/real-estate-marketing.** Domain prior: MLS formula "Feature → Benefit → Lifestyle"; structure "Hook → Key features → Upgrades → Location highlights → CTA"; photography shot list; nosy-neighbor open house angle. Two CRITICAL blocks. Factual accuracy:

```
- Facts-only. Every objective claim must trace to a detail the user actually provided. Never invent,
  infer, or "round up" features. "Updated kitchen" does not become "chef's kitchen".
- Echo key numbers verbatim. Repeat price, square footage, bed/bath counts, year built, lot size,
  and HOA/fees exactly as given — never restate or round them. This makes a typo easy to catch.
- Fact vs. framing. Subjective framing is allowed ("bright," "open"); objective claims are not unless sourced.
- Name the gaps. "Square footage not provided — confirm from tax records or measurement."
- Flag anything unverifiable: square-footage source, permits on additions, school-boundary lines,
  HOA/fees, and the date behind any "new" or "updated" feature.
```

Fair Housing block lists the seven federal protected classes, prohibited concepts (school quality indicators, religious landmarks, age/familial preferences, "must be able to climb stairs", "exclusive"), and compliant alternatives ("Within [School District Name]" instead of "top-rated schools"; "Second-floor primary suite" instead of "must climb stairs"). "When in doubt, flag it."

**skills/client-communication.** Frameworks for price-reduction conversations ("Frame as strategic repositioning, not failure... include the cost of overpricing"), plain-language contingency explanations (inspection/appraisal/financing/sale-of-home — four one-sentence definitions), escrow expectation-setting ("Proactive updates even when there's nothing new"), multiple-offer handling for both sides incl. escalation clause discipline, cold-lead re-engagement (value first, reference the original connection, yes/no question, timing triggers = rate moves/seasonal shifts). Buyer vs seller audience adaptation. Same facts-only block.

**commands/listing-description.** Three styles from one input (MLS ~500 chars with count noted; Social with 5–8 hashtags; Luxury "editorial... sensory language") followed by an **Accuracy Ledger** below a horizontal rule:

```
- ✓ Facts-only — one line confirming every claim traces to a detail the agent provided.
- Not provided — only if standard fields were omitted (sqft, lot, HOA). Shows they were omitted, not invented.
- Verify before publishing — only the handful worth an independent check. Do not pad.
Do not print a full fact-by-fact trace by default. If the agent asks ("show me the trace"), then list each claim.
```

Then a mandatory Fair Housing Compliance Note and the print-ready HTML "listing copy sheet" (ledger excluded from the page).

**commands/cma-narrative.** Sections: Market Context (2–3 paragraphs), per-comp analysis (why selected, adjustments, what it says), Comp Summary Table (`Comp | Sold Price | $/SqFt | Adjustments | Adjusted Value`), Price Positioning Recommendation (range + target + strategy; "If the user's expectation differs significantly from the data, address this diplomatically but directly"), Supporting Data Points, and a **Data Accuracy Note** (comps echoed unaltered; label general commentary as context not local data; flag comps >6 months or >1 mile). Rule: "adjustments must be shown as explicit, labeled line items, not baked silently into a comp's stated price."

**commands/offer-comparison.** 14-row side-by-side table (price, financing, down %, pre-approval, EMD, each contingency, close date, escalation, concessions, special terms, **Estimated Net to Seller**), per-offer Strengths/Risks/Key consideration, comparative summary (strongest financially / most likely to close / best timeline / trade-offs), recommendation + counter strategy. Framework: net proceeds, certainty of close, timeline, contingency risk, escalation effective max, appraisal gap coverage. "Never recommend accepting an offer based solely on the highest price." "Do not include specific buyer demographic information that could create fair housing concerns." Net to seller "rough estimate only... confirm with a full settlement statement."

**commands/market-update.** Headline stat → 4-row snapshot table (Current / Previous / Change) → interpretation → What This Means for Buyers / Sellers → optional featured listing → specific CTA ("Reply to this email for a personalized market report for your street") → subject line. Tone: "Confident but not alarmist — present data without fear-mongering... or hype."

**commands/client-email.** Six types (offer update, price reduction, listing status, buyer congratulations, cold lead re-engagement, market check-in). Output: 2–3 subject options, body (no "I hope this email finds you well", point within two sentences), and **Notes for the Agent** (customize, timing, follow-up). Never include SSN/account numbers.

### 3.4 Mechanics — `mortgage-broker` plugin

**skills/mortgage-lending.** Compact but accurate product/underwriting prior: conventional vs jumbo, PMI at >80% LTV; FHA 3.5% + MIP + 203(k); VA zero-down, funding fee, COE, MPRs; USDA; ARM structure (caps, SOFR index, margin); non-QM (bank statement, DSCR, asset depletion). Rate locks (30/45/60, float-down, extensions), points vs credits break-even, APR composition. DTI norms (conventional 45–50%, FHA 43–57%, VA no front-end cap), credit minimums (conv 620, FHA 580/500), seasoning/gift/reserves. **Compliance list**: TRID (LE within 3 business days of application; CD 3 business days before closing; tolerance thresholds), RESPA ("prohibition on kickbacks and referral fees, affiliated business arrangements, and required disclosures"), HMDA, Fair Lending (ECOA, FHA, disparate impact), NMLS licensing. Style: "Always note that rate quotes are subject to change and formal lock."

**skills/client-communication (mortgage).** Borrower education via analogies; anticipated confusion points (rate vs APR; pre-qual vs pre-approval; fixed vs ARM); rate discussions framed as monthly payment deltas ("The difference between 6.5% and 6.75% on your loan is $X per month"); milestone communication per stage (application → processing → underwriting with jargon translation → appraisal → clear to close → post-closing); "Never guarantee rates."

**commands/pre-approval-letter.** Full letter template with PRE-APPROVAL DETAILS, BORROWER QUALIFICATIONS, CONDITIONS (appraisal, title, VOE at closing, no material change), VALIDITY, and the disclosure paragraph ("It is not a commitment to lend"). Guidelines: never include specific credit scores; NMLS placeholder "required by federal law"; print-ready HTML on letterhead.

**commands/rate-comparison.** Box-drawn 3-option table (type, term, rate, APR, P&I, PMI/MIP, total monthly, total interest, total cost, points/credits, closing costs) + PITI breakdown + KEY CONSIDERATIONS + ASSUMPTIONS + "does not constitute a loan commitment." "Calculate monthly payments using standard amortization formulas."

**commands/refinance-analysis.** Current vs proposed table; break-even = closing costs ÷ monthly savings; "Note the impact of resetting the amortization clock (e.g., 26 years remaining back to 30)"; separate rate/term savings from cash-out.

**commands/client-update.** Five stage templates (Application Submitted, Processing, Underwriting, Appraisal incl. low-appraisal options, Clear to Close) with a shared email skeleton and NMLS placeholder; "Avoid making promises about approval outcomes while the file is in underwriting."

### 3.5 Compliance posture

Good, consistent, and the only pack with lender-side compliance. Every command and skill ends with a "professional draft for agent review" disclaimer; real-estate commands carry Fair Housing blocks with compliant alternatives; offer comparison excludes buyer demographics; mortgage skill names TRID/RESPA/HMDA/ECOA and demands NMLS on every letter and "not a commitment to lend" language. Gaps: the **facts-only / accuracy ledger** is a stronger anti-hallucination control than anything in repos 1, 2, or 4, but there is no cross-command compliance overlay, no TCPA content, and RESPA appears as a knowledge bullet rather than a rule applied to real-estate-agent referral behavior.

### 3.6 Best ideas worth stealing

1. **Facts-only + echo-numbers-verbatim + Accuracy Ledger (exception-first, below a rule, excluded from the client-facing page).** This is the single best anti-hallucination control in all four repos and should be in every Redfin skill that produces client-facing numbers.
2. **Deliverable-then-page**: copy-ready text first, then a print-ready HTML/PDF artifact; internal notes never leak into the client page.
3. **Offer-comparison table + "most likely to close / strongest financially / best timeline" triad** — map directly to LA multiple-offer seller consults and to buyer "how do we win" coaching.
4. **Contingency plain-language definitions** and **price-reduction framing** for agent scripts.
5. **Mortgage skill as a Rocket-attach knowledge prior**: rate-vs-payment framing ("$X per month"), pre-qual vs pre-approval explainer, TRID timing, "never guarantee rates," NMLS/not-a-commitment language — all of which a Redfin agent should know to hand off cleanly to a Rocket LO without crossing into loan-officer activity.
6. **Plugin packaging** (`.claude-plugin/plugin.json`, `commands/*.md` with `user-invocable: true`, passive `skills/*/SKILL.md`) is the cleanest distribution format for 30 agents: one `/plugin install`.
7. **"Notes for the Agent"** block beneath drafts (what to customize, when to send, follow-up) — the manager-coaching channel inside the output.

### 3.7 Weaknesses

- Shallow: each command is a fixed template with no decision logic beyond "if missing, placeholder." No research, no data pull, no memory, no chaining, no routing.
- Generic market framing ("general market framing" is explicitly allowed in CMA narrative — a hallucination door the accuracy note only partially closes).
- Four upsell links per README plus an unsourced "52 percentage points" accuracy claim.
- Bot-synced from a private source (`Sync 47 plugin(s) from ai-career-lab`), so provenance and future maintenance are opaque.
- Real-estate skill allows "within [School District Name]" which conflicts with Prosperity's stricter stance; a team needs one rule.

---

## 4. agency-os — "The Agency OS"

### 4.1 Identity

| Field | Value |
|---|---|
| Repo | github.com/sparkles-inc/agency-os |
| Author | Ruby Sparks (built for "Clief Notes Weekly Competition #4"); fictional client "Diana Coleman Real Estate", Austin TX |
| License | **None** — no LICENSE file; `site/` is a Next.js companion app. Treat as ideas-only; no verbatim copying. |
| Stars / last commit | 21 stars; `c259431` 2026-05-17 "Embed Loom walkthrough video" |
| One-line purpose | A six-specialist "operating system" for a 4-person residential team, implemented purely as markdown folders (identity/rules/handoff/examples per specialist) that pass human-readable handoff cards; no code, no tools, no automation. |

### 4.2 Architecture

```
agency-os/
  00_orchestrator/            01_lead_qualifier/        02_property_research/
  03_client_communication/    04_transaction_coordinator/   05_market_intel/
    each: identity.md  rules.md  handoff.md  examples.md
  _shared/handoff-card-template.md   _shared/team-roster.md   _shared/glossary.md
  README.md  QUICK-START.md  WRITEUP.md  site/ (Next.js demo)
```

**Four-file specialist contract.** `identity.md` = who I am / What I Own / What I Don't Own / How I Think / My Quality Standard. `rules.md` = tables + "What I Always Do / What I Never Do" + tone. `handoff.md` = what I receive (required vs helpful fields, per upstream specialist), what I produce, where I route, back-handoffs I receive, what blocks me, data freshness. `examples.md` = 2–3 full worked interactions. One continuous story (a Zillow buyer "Sara M." → qualification → research → first-touch email → contract → inspection crisis → closing) threads through all 27 files, so examples are consistent with each other.

**Triggering and chaining.** Manual: the user pastes the orchestrator's identity+rules into Claude, pastes a raw request, receives a handoff card, opens a new conversation with the next specialist's files, pastes the card. The orchestrator uses a routing table (new lead → qualifier; property/comps → research; draft → comms; active deal → transaction coordinator; market → intel) with tiebreakers (a new lead always goes to qualification first even if it mentions a property; an active deal always goes to the TC first), confidence calibration, and a hard rule to route to exactly one primary specialist and merely *note* a secondary. Ambiguity → one clarifying question back to the human, never a guess; still unclear → escalate to the team lead.

**Memory/state.** None mechanized. The design claim is that "the trail of cards IS the deal history" — the handoff cards themselves are the audit log. Freshness rules are declared per specialist (comps valid 30 days; listing price/DOM 7 days; rate context 7 days; school zones for the school year; flood/MUD/tax annually).

**Handoff card (paraphrased, since no license).** Header: From / To / Case / Agent / Date / Confidence (High/Medium/Low). Body: SUMMARY (2–3 sentences a stranger could follow), KEY DETAILS (client, property, intent, timeline, budget + specialist-specific fields), CONTEXT ("the messy human stuff"), GAPS (must contain at least one item — "if Gaps is empty, you're not looking hard enough"), NEXT ACTION (exactly one; if you can't name one, the handoff isn't ready). Confidence is defined as *information completeness for the receiver*, explicitly not lead quality. Missing-info tiers: workable gap (proceed, note it), blocking gap (return with ONE question), confidence downgrade (proceed, flag). Back-handoffs are "normal operations, not failures." Escalation triggers to the team lead include legal questions, client threatening to walk, luxury above a price threshold, and "no clear next step."

**Voice profiles (`_shared/team-roster.md`).** Four agents with experience, specialties, what they handle vs escalate, communication style, 3–4 quirks, and one sample message each. The communication specialist must re-read the profile before every draft; outputs are labeled `DRAFT — [Agent] — [Channel] — [Client]` with a separate "context for the agent" block that never goes into the client message.

### 4.3 Mechanics by specialist (paraphrased)

**00 Orchestrator ("The Front Desk").** Never answers the client, never does substantive work, never routes to two specialists in parallel, never holds a request. Reads raw request + case history + agent-added context. Failure modes table (empty request → return; unknown channel → route with Medium confidence; buyer-or-seller ambiguous → qualifier with both noted). Example 3 shows a "ROUTING HOLD" with one question when a referral text names an unidentifiable property.

**01 Lead Qualifier ("First Contact").** Six fields: Intent, Budget (client's exact words — "around $550K" ≠ "$550K" ≠ "under $600K"), Timeline, Location, Constraints, Source. Temperature: Hot = pre-approved/cash OR budget + timeline <3 months + clear intent (two strong signals with urgency suffice); Warm = real intent, 3–6 months; Cold = just looking. "A referral is always at least Warm." Assignment table maps lead profile → agent by specialty, with the new agent restricted from hot leads and listings. Never disqualifies, never quotes prices. A **multiple-offer flag** is injected into Context when the property is in a competitive ZIP under a price band or DOM <7. Seller leads route to Market Intel (CMA foundation) rather than Property Research.

**02 Property Research ("The Researcher").** An **auto-pull table**: when an address appears anywhere, pull listing price, specs, year built (foundation risk by era), DOM, price-change history, tax assessed value, flood zone, *school attendance zone (not district)*, HOA, special tax districts. Comp rules: ≥3 comps, ≤0.5 mi, ≤90 days, ±1 bed/bath, ±20% sqft; interpretation heuristics (all above ask → micro seller's market; wide spread → condition-sensitive). Red-flag protocol by local pattern (pre-1970 clay-soil foundations, flood zones, MUD taxes, permitted development within 0.5 mi, HOA assessments, noise, ≥2 price drops). Every brief must contain **"The One Thing"** the client would not find on Zillow and, when the primary property has issues, 2 in-budget alternatives. Never guarantee a valuation; never hide negatives; always date-stamp; translate numbers into meaning ("$415/sqft — that's average for 78704, so fairly priced but not a deal").

**03 Client Communication ("The Voice").** Every message answers: what does the client need to know, how should they feel after, what should they do next. Channel rules (email 150–300 words, text under 160 ideal / 300 max, call script = 5–8 bullets with the key number, the one question, and the emotional read). Tone calibration table (good news / bad news / routine / urgent / nurture) — bad news: never lead with the dollar amount, no exclamation points, voice call first then recap email. Agent-to-agent drafts are deliberately colder and lead with the ask and numbers. Legal language is flagged for the team lead. **"No checking in" rule**: wait ≥5 business days, second touch must carry new value, never "circling back," stop after two unreturned touches and move to passive quarterly nurture. Post-close cadence: closing-day message referencing a specific memory, 30-day check-in, annual value update.

**04 Transaction Coordinator ("The Closer").** **Three parallel tracks**: Deal Timeline (contract → EMD → inspection → option period at 5:00 PM → appraisal → title → financing contingency → survey → CD at T-3 → walkthrough → closing), Lender Timeline (pre-approval, rate lock confirmed by day 3, appraisal ordered by day 7, conditional approval, conditions cleared, clear to close, final VOE at T-3), Document Checklist. Self-triggers: T-48h flag on every deadline, T-24h re-flag cc'ing the lead if unacknowledged, T-7 full status check, T-3 CD check, T-1 walkthrough, closing-day handoff to comms plus confirm recording. Risk colors green/yellow/red; red = escalate + immediate comms handoff. Never interprets contracts, never drops a deal before recording. "Silence from a lender is a yellow flag, not a green one."

**05 Market Intel ("The Analyst").** Three data layers (metro → ZIP → micro); every number date-stamped, sourced, interpreted; never national when local exists; never predict prices; flag data >90 days. ZIP "personality profile" table (character, price range, temperature). Rate-impact table (payment at 6.5/6.9/7.3% by price) and a rule to re-check active buyers' pre-approvals when rates move ≥0.25%. Self-triggers: rate change, monthly refresh, seasonal inflection, market-type shift. Produces CMA foundations and appraisal-challenge evidence packets.

### 4.4 Compliance posture

Mixed. Strong on **human-in-the-loop** ("Nothing I produce goes to a client without human review"), legal-language escalation, no valuation guarantees, no price predictions, privacy of internal notes, and an unusually thoughtful instruction to handle gentrification conversations "with cultural awareness." But it is **not Fair Housing-aware in content**: briefs and first-touch emails lead with school ratings and "family" framing ("Family with school-age kids driving the search", "Lead with the school zone"); neighborhood briefs rate school zones and describe "who lives here." No TCPA, no RESPA, no disclaimers. Texas-specific legal content (option period, TREC) must be replaced for California.

### 4.5 Best ideas worth stealing

1. **Handoff card with GAPS and exactly one NEXT ACTION, plus confidence = information completeness.** This is the right interface between a skill and a human agent, and between agent and manager. Redfin's version: contact → agent → manager, and agent → Rocket LO.
2. **Four-file specialist contract** (identity / rules / handoff / examples) with "What I Don't Own" — makes a skill library maintainable and prevents scope creep between skills.
3. **Voice profiles per agent** — for 30 agents, a roster file with style, quirks, and one sample message is what turns generic drafts into send-as-is drafts; the "read the profile before every draft" rule and the `DRAFT — Agent — Channel — Client` label are the mechanism.
4. **Three-track escrow timeline with T-48/T-24/T-7/T-3/T-1 self-triggers**, especially the *lender* track and the final-VOE warning ("no job changes, no large purchases, no new credit") — directly relevant to keeping Rocket-financed deals alive.
5. **"The One Thing" rule** and the auto-pull table for buyer consults.
6. **Bad-news protocol**: call first, three options with a recommendation, deadline embedded, recap email after; never lead with the dollar amount.
7. **Stop rule**: two unreturned value touches then passive nurture — a healthier norm for a salaried team than 7-touch pressure.
8. **One continuous worked story across all files** — a powerful documentation technique for a team skill library.

### 4.6 Weaknesses

- No license: ideas only.
- No code, tools, memory, or automation; "self-triggers" are aspirational prose, since a markdown folder cannot fire at T-48h. Running it means copy-pasting cards between chats.
- Texas- and Austin-specific throughout (option period, TREC, MUD, ZIP profiles).
- Fictional team and made-up market numbers; the `site/` demo is marketing.
- Fair Housing blind spots noted above.
- Single-team scale (4 agents, one lead) — the assignment table and escalation path do not generalize to 30 agents without a different roster model.

---

## 5. Cross-repo synthesis — top 10 reusable patterns, ranked

Ranked by value to a 30-agent Redfin LA team coached on conversion, follow-up, listings, buyer consults, and Rocket attach.

| # | Pattern | Source(s) | Why it ranks here |
|---|---|---|---|
| 1 | **Load-first compliance overlay with refuse/rewrite + BLOCKED output contract, extended by an accuracy ledger (facts-only, echo numbers verbatim, name the gaps)** | Prosperity overlay; Cowork facts-only blocks | A brokerage cannot ship anything else without this. Combines FHA (federal + CA classes), TCPA consent flag, MLS cliché list, anti-disparagement, and the strongest anti-hallucination control found. Add RESPA/Rocket and DRE advertising rules. |
| 2 | **Handoff card: Summary / Key Details / Context / GAPS (never empty) / exactly one NEXT ACTION / Confidence = completeness** | agency-os (ideas only) | The interface for every skill→agent, agent→manager, and agent→Rocket LO exchange. Makes work auditable and coachable. |
| 3 | **Per-contact memory + append-only pipeline + learnings journal + area cache with Scope and 7/30-day freshness** | realtor-claude-skills | Turns one-off prompts into a compounding system; the learnings taxonomy is a ready-made weekly retro format. |
| 4 | **Transparent, evidence-only scoring rubrics with visible ledgers** (motivation +2/+1/−2; comp relevance weights + 15% adjustment flag; deal scorecard "a 4 is a 4") | realtor-claude-skills | Auditable judgment; agents learn the rubric, managers inspect the ledger. |
| 5 | **Touch specification: channel / exact words / why it works / if-respond / if-not + explicit stop rules ("no just checking in", two unreturned touches → passive)** | realtor nurture-coach; agency-os comms | The core of follow-up coaching; the stop rules keep it humane and TCPA-sane. |
| 6 | **Agent voice profiles read before every draft; `DRAFT — Agent — Channel — Client` label; context-for-agent block kept out of the client message** | agency-os (ideas only) | The difference between drafts agents send and drafts they ignore; scales to 30 agents via a roster file. |
| 7 | **Three-track transaction timeline (contract / lender / documents) with T-48, T-24, T-7, T-3, T-1 checkpoints and red/yellow/green** | agency-os (ideas only) | Protects Rocket-financed escrows; the lender track is where attach deals die. Rebuild on CA RPA contingency periods. |
| 8 | **`examples/before-after.md` + `examples/failure-modes.md` per skill, and one continuous worked story across the library** | Prosperity; agency-os | Documentation that doubles as training material and office-hours FAQ for agents of mixed skill. |
| 9 | **Output contract: Header → Content → FILES SAVED → WHAT'S NEXT (2–4 next skills with time estimates) + DATA SOURCES live/cached/estimated** | realtor-claude-skills | Composability and honesty about data quality; every run tells the agent the next move. |
| 10 | **Selective context matrix + gap detection that never blocks ("continue without")** | realtor start-here | Better outputs and lower token cost; the orchestrator pattern that lets skills chain without dumping everything. |

Honorable mentions: "The One Thing" the client won't find on Zillow (agency-os); Fast vs Deep modes (realtor); cost-of-overpricing block and communication-plan section (realtor); offer-comparison triad and contingency plain-language definitions (cowork); deliverable-then-print-ready-page (cowork); HEARD for negative reviews (realtor); anchor-for-the-close that is never a school (Prosperity); CI banned-terms lint (Prosperity); plugin packaging for one-command install (cowork).

What **none** of the repos do, and the Redfin build must: manager-level views across many agents; first-party data (Redfin tours, contact records, AICR routing) instead of scraping; W-2 team dynamics (round-robin, load balancing, coaching cadence); mortgage-attach as an explicit, RESPA-aware workflow; California contract mechanics (RPA-CA contingency periods, buyer representation agreements required since Jan 2025, LA County + City transfer taxes and Measure ULA thresholds, CA protected classes); Spanish-language parity for LA.

---

## 6. Recommended new skills for a Redfin | Powered by Rocket sales manager (Los Angeles)

Eight skills. Each is specified as trigger → inputs → process → outputs, with the patterns above it reuses. All eight load `/compliance-overlay-ca` first (skill 1). None send anything; every output is a labeled DRAFT for the agent, with a Notes-for-Agent block and, where relevant, a manager coaching note.

### 6.1 `/compliance-overlay-ca` — the floor every other skill loads first

**Trigger:** auto-loaded by every skill; also invoked directly ("check this listing copy", "is this text OK to send"). **Inputs:** any draft copy or script, channel, audience, `consent_on_file:` (customer-initiated tour/inquiry = yes), and whether a lender is mentioned. **Process:** apply five rule sets with refuse/rewrite semantics and the `BLOCKED — [rule]: [phrase] / Suggested rewrite:` contract: (1) Fair Housing with the union of federal + California protected classes (incl. source of income, marital status, ancestry, genetic information, immigration status, veteran status) and a banned/coded-phrase list, "safe" has no replacement, school references only as factual attendance-zone facts if the team adopts that stance (pick one house rule — this spec defaults to Prosperity's stricter "no school quality language"); (2) TCPA/consent gating for texts and calls to anyone not customer-initiated, with opt-out language on SMS; (3) MLS/CRMLS data-quality clichés and character caps; (4) anti-disparagement of competitors, platforms, neighborhoods; (5) **RESPA / Rocket**: lender mentions must present Rocket as an option not a condition, include the affiliated-business relationship disclosure cue, never promise rates or approval, never imply a thing of value for a referral, never let the agent perform loan-officer activity (quote rates, take applications). Also an **Accuracy Ledger** pass (facts-only, numbers echoed verbatim, Not provided, Verify before sending). **Outputs:** PASS or BLOCKED list with rewrites; a one-line ledger. Ships with `examples/before-after.md` (LA-specific: "walk to the temple" → "0.3 mi to Pico-Robertson shops"; "great LAUSD schools" → "assigned attendance zone: [name]" or removed) and `examples/failure-modes.md`.

### 6.2 `/first-response` — speed-to-lead for Redfin-routed contacts

**Trigger:** "new contact", "tour request", "inquiry on [address]", pasted contact record. **Inputs:** contact record (name, source, property/area, what they wrote, tour time if any, prior history), agent name (for voice), Fast/Deep. **Process:** classify into the 7-type matrix adapted to Redfin sources (tour request with time = HOT; "ask a question" = WARM; saved-search only = COOL; "already working with an agent" = respect/stop); score with the evidence-only ledger; pull property facts from first-party data the agent pastes (no scraping); write SMS (<300 chars, ends with a question, one specific property/area detail, no "I'd love to help") and email versions in the agent's voice; add a **financing fork** line that complies with 6.1 ("Have you spoken with a lender yet? If it's helpful, I can connect you with Rocket's team or you're welcome to use anyone you like"). **Outputs:** classification + score ledger, two drafts, talking points for the call, a handoff card to `/follow-up-coach` with GAPS (pre-approval status, timeline, agent status) and one NEXT ACTION, and a FILES SAVED line to the contact's memory folder.

### 6.3 `/follow-up-coach` — per-contact cadence plus weekly pipeline audit

**Trigger:** "they went quiet", "build follow-up for [name]", or weekly "audit my pipeline" with a pasted export. **Inputs:** contact memory (from 6.2), what happened since, previous touches, archetype if known; for audit mode, a CSV/paste of the agent's open customers with last-contact dates. **Process (single contact):** classify archetype (first-timer, move-up, downsizer, relocator, price-sensitive, investor; sellers: ready now, testing waters, life-event, move-up) and build a cadence with Redfin-appropriate ceilings (default 5 touches over 30 days, then one 90-day honest check, then quarterly passive); every touch carries channel / exact words / why it works / if-respond / if-not; objections via Acknowledge → Reframe with data → Soft next step for the LA set (rates, "waiting for prices to drop", "already have an agent", "we'll just use the listing agent", "Redfin agents are too busy"); dead-lead stop table. **Process (audit):** rank the book by score and staleness, flag anything untouched >7 days with a one-line next touch, and produce a manager coaching note (patterns: agent waits for replies, generic "checking in" texts). **Outputs:** cadence file saved to contact memory, pipeline update, audit table, three coaching observations.

### 6.4 `/buyer-consult-prep` — the pre-consultation brief

**Trigger:** "buyer consult with [name] on [day]", "prep me for [name]". **Inputs:** contact memory, target areas/budget, properties they've viewed or saved, agent voice, financing status. **Process:** auto-pull checklist for each target area the agent pastes (price band, DOM, list-to-sale, inventory, HOA/Mello-Roos prevalence, typical offer dynamics); "what your budget buys" by sub-market; **The One Thing** per property they're eyeing; CA-specific agenda: buyer representation agreement explanation in plain language (required before touring under CA law since Jan 2025), compensation conversation script, contingency periods on the CA RPA (inspection/appraisal/loan defaults and how LA sellers negotiate them), multiple-offer readiness (escalation discipline, appraisal-gap options); **financing segment** compliant with 6.1 — pre-qual vs pre-approval explainer, rate-to-payment framing ("the difference between X% and Y% on $900K is about $Z/month"), introduce Rocket as an option with the disclosure cue, and what a strong pre-approval does in a multiple-offer LA market. **Outputs:** one-page consult agenda, three-question discovery script, area one-pagers, a Rocket handoff card (Summary/Key Details/GAPS/one NEXT ACTION) ready to send to the LO if the client opts in, Notes-for-Agent.

### 6.5 `/rocket-attach-coach` — compliant lender-introduction scripts and attach diagnostics

**Trigger:** "how do I bring up Rocket with [name]", "my attach rate is low", "client already has a lender". **Inputs:** contact context and financing status, where the conversation is (first call, consult, offer prep), agent's recent attach data if available. **Process:** produce scripts for four moments (first contact, consult, pre-offer "strong offer" moment, post-acceptance rate-lock moment) that follow 6.1 RESPA rules word-for-word: option not requirement, no rate quotes or approval promises by the agent, disclosure cue, warm three-way introduction rather than "I'll have them call you"; objection handling for "I already have a lender" (ask for a second look, never disparage), "online lenders are slow", "I want the lowest rate" (frame certainty of close and the LO's job); milestone sync script with the LO (what the agent asks at days 3/7/T-7 so the lender track in 6.7 stays green). Diagnostic mode: given attach outcomes across an agent's last N customers, identify the stage where attach is lost and the one habit to change. **Outputs:** scripts in the agent's voice with a compliance pass stamp, an LO handoff card, a coaching note for the manager.

### 6.6 `/listing-launch-la` — CMA narrative, pricing tiers, LA net sheet, launch copy

**Trigger:** "listing appointment at [address]", "price this", "we signed, build the launch". **Inputs:** subject facts, 3–7 comps the agent pastes (facts-only; no invented comps), seller situation (emotional/analytical/first-time/motivated), payoff if known, agent track record (bracketed if missing — never invented). **Process:** comp table with explicit labeled adjustments and a 15% large-adjustment flag; relevance weights (recency 30 / proximity 25 / size 20 / condition 15 / age 10); three tiers (aggressive −2–4%, market, aspirational +3–5%) with DOM expectations and the Cost of Overpricing block built from the agent's pasted data; **LA seller net sheet** with county documentary transfer tax ($1.10/$1,000), City of Los Angeles transfer tax (0.45%), Measure ULA tiers above the current indexed thresholds (flag "verify current threshold and city boundary"), escrow/title split conventions, HOA transfer, and a disclaimer; communication plan (weekly report day, 24-hour showing feedback, offer-presentation SLA); launch copy via 6.1: CRMLS public remarks within the character cap, broker remarks, 3 social pieces, a 5-day coming-soon drip, and an Accuracy Ledger below the rule. **Outputs:** a presentation markdown structured for a print-ready page, net sheet per tier, launch asset file, FILES SAVED, NEXT → `/offer-strategy` when offers arrive.

### 6.7 `/escrow-tracker-ca` — three-track timeline with checkpoints for LA escrows

**Trigger:** "we're in contract on [address]", "status on [client]", "appraisal came in low", or a pasted RPA summary. **Inputs:** contract dates (acceptance, EMD due, inspection/appraisal/loan contingency periods, close of escrow), lender (Rocket LO name) and escrow/title contacts, buyer/seller, agent. **Process:** build Track 1 (CA RPA timeline: EMD within 3 business days, seller disclosures/TDS/NHD delivery, inspection contingency removal, appraisal and loan contingency removals via CR forms, verification of property condition, closing disclosure at T-3, final walkthrough, recording/COE), Track 2 (lender: rate lock date + expiration, appraisal ordered by day 7, conditional approval, conditions cleared before loan contingency, clear to close, final VOE — "no job changes, large purchases, or new credit"), Track 3 (document checklist). Emit flags at T-48/T-24 for every deadline, a T-7 full status check, T-3 CD check, T-1 walkthrough; red/yellow/green; low appraisal → three-option framework (renegotiate / gap / challenge with comps) and a handoff to comms. **Outputs:** deal package, status snapshots on request, deadline flags formatted for Slack, close-out handoff to `/post-close` (review + referral + sphere) and a Rocket LO sync card. Note explicitly that checkpoints are prompts the agent/manager runs; nothing fires on its own unless wired to a scheduler.

### 6.8 `/coaching-1on1` — the manager's weekly per-agent brief

**Trigger:** "prep my 1:1 with [agent]", "weekly coaching for the team", pasted team metrics. **Inputs:** per-agent numbers the manager pastes (contacts assigned, response time, tours, tour→offer, offers→escrow, listings taken vs appointments, Rocket attach), the agent's voice profile and recent drafts/outputs from skills 6.2–6.7, the learnings journal entries for their deals. **Process:** compute week-over-week deltas and compare to team medians without fabricating data; identify the single highest-leverage gap in the funnel (e.g., response time fine but tour→offer weak → consult quality); pull one real example from the agent's recent drafts to praise and one to fix; generate a 5-minute role-play script for the gap (using the objection or script library from 6.3/6.5); set one measurable commitment for next week; log to the agent's coaching file (append-only) and to the team learnings journal under What Worked / What Didn't. **Outputs:** one-page 1:1 brief (wins, the one gap, evidence, role-play, commitment), a Slack-ready recognition line, and a team roll-up table for the manager's own review. Voice rule: coaching language is the manager's, never generic; agent-facing text passes 6.1.

---

### Appendix — quick reference of what to lift verbatim vs. paraphrase

| Repo | License | Lift verbatim (short fragments, with attribution) | Paraphrase only |
|---|---|---|---|
| realtor-claude-skills | MIT | Motivation score table; Speed Response rules; 7-touch table; objection structure; comp relevance weights; adjustment transparency rules; Cost of Overpricing block; HEARD; freshness table; Deal Outcome menu; Dead Lead Signals | Worked examples (fictional data; stale school names) |
| prosperity-real-estate-skills | MIT | Rule-set rewrites; cliché list; BLOCKED output contract; listing prompt; counter-offer prompt; consent flag; failure-modes format | eXp upsell lines (remove) |
| awesome-claude-cowork-plugins | MIT | Facts-only block; Accuracy Ledger spec; offer-comparison table rows; contingency definitions; mortgage compliance bullets; plugin.json layout | Upsell links (remove) |
| agency-os | none | Nothing verbatim | Handoff card fields; four-file contract; three-track timeline; voice-profile roster; routing tiebreakers; The One Thing; bad-news protocol |
