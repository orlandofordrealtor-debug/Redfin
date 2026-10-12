# Real Estate AI Tooling Teardown

**Date:** October 12, 2026
**Scope:** 15 public GitHub repositories covering Claude skill packs for real estate agents, investor analysis packs, an MCP finance server, Redfin / Zillow / Realtor.com data tooling, a listing-video pipeline, a voice agent, and a skill-authoring framework. Every repo was cloned read-only and read in full. Nothing from any repo was executed.
**Purpose:** Find what already exists, understand exactly how it works, and decide what a Redfin | Powered by Rocket sales manager in Los Angeles should borrow, rebuild, or avoid.

---

## Executive summary

**The market has produced a lot of real estate AI tooling, and almost none of it is built for a brokerage sales manager.** Everything found is written for a solo agent, an investor, a wholesaler, or a commercial broker. Nothing handles a 30-agent team, first-party Redfin data, W-2 team dynamics, RESPA-aware mortgage attach, or California contract and protected-class specifics. That gap is the opportunity.

**The best ideas are architectural, not content.** The strongest material is how skills are structured: compliance overlays that load first, handoff cards with mandatory gaps and one next action, per-contact memory with freshness rules, transparent scoring rubrics, touch cadences with stop rules, and honest completion reports. The actual scripts and templates are mostly generic and need to be rewritten in a Redfin voice anyway.

**The data tooling is a legal dead end for scraping but a gold mine for schema.** Every Redfin, Zillow, and Realtor.com library hits private web backends that the sites' terms prohibit. For a Redfin employee the value is knowing which fields exist and which metrics matter, then sourcing them from internal dashboards, Tableau, MLS exports, and the sanctioned Redfin Data Center downloads.

**Three compliance landmines recur across repos and must not be ported:** neighborhood scoring by income or demographics, school-quality language in listing copy, and fully automated outbound texting or AI voice calls with no consent, calling window, or disclosure.

---

## Reports

| File | Covers | Size |
|---|---|---|
| [01-agent-skill-packs.md](01-agent-skill-packs.md) | realtor-claude-skills, prosperity-real-estate-skills, awesome-claude-cowork-plugins (real-estate + mortgage-broker), agency-os | 640 lines |
| [02-analysis-investor-packs.md](02-analysis-investor-packs.md) | ai-realestate-claude, wholesaler-claude-skills, real-estate-mcp, cre-agent-skills (brokerage pack) | 883 lines |
| [03-redfin-listing-data-tooling.md](03-redfin-listing-data-tooling.md) | reteps/redfin, HomeHarvest, real-estate-scrape, zillow-mcp-server, plus a unified listing-data field dictionary | 588 lines |
| [04-media-voice-skill-authoring.md](04-media-voice-skill-authoring.md) | re-walkthrough-pro, sofia-voice-agent, skills-for-architects (skill-maker, demographics-analysis) | 568 lines |
| [SOURCES.md](SOURCES.md) | Manifest: repo, stars, commit analyzed, license, reuse posture | |

Each report has per-repo sections (identity, architecture, mechanics with verbatim fragments, compliance posture, best ideas, weaknesses) and ends with a ranked synthesis and new-skill specs. Paths written as `<clone>/repo/...` refer to the local read-only clones used during analysis.

---

## Key insights

### 1. What the strongest repos actually do well

| Pattern | Best source | Why it matters for a 30-agent team |
|---|---|---|
| Load-first compliance overlay with refuse / rewrite semantics and a `BLOCKED — [rule]: [phrase] / Suggested rewrite:` contract | prosperity-real-estate-skills | A brokerage cannot ship AI-written copy without this. Extend with California protected classes, TCPA consent flag, RESPA language for Rocket. |
| Accuracy ledger: facts only, echo numbers verbatim, name every gap, kept off the client page | awesome-claude-cowork-plugins | The strongest anti-hallucination control found anywhere in the set. |
| Handoff card: Summary / Key Details / Context / GAPS (never empty) / exactly one NEXT ACTION / Confidence as completeness | agency-os | The interface for every agent-to-manager and agent-to-loan-officer exchange. Makes work auditable and coachable. |
| Per-contact memory, append-only pipeline, learnings journal, area cache with 7 / 30 / 90-day freshness | realtor-claude-skills, wholesaler-claude-skills | Turns one-off prompts into a compounding system. The learnings taxonomy is a ready-made weekly retro. |
| Comp discipline as explicit tables: Ideal / Acceptable / Reject ranges, 10% individual and 25% net adjustment caps, confidence bands, "not an appraisal" | ai-realestate-claude, cre-agent-skills | The core of CMA discipline. Pairs with NAR Standard of Practice 11-1 disclosure minimums. |
| Touch specification: channel / exact words / why it works / if-respond / if-not, plus explicit stop rules | realtor-claude-skills | The heart of follow-up coaching. Stop rules keep it humane and TCPA-sane. |
| READ → RESPOND → CRAFT → PREDICT → EXPLAIN conversation coaching, with "What NOT to say" | wholesaler-claude-skills | Directly portable to buyer consults and seller objection handling. |
| Deterministic finance engine with `assumptions` and `disclaimer` fields on every number | real-estate-mcp | Never let the model do payment arithmetic. Every PITI figure states rate, term, tax, insurance, HOA, PMI. |
| Pipeline stack-ranking: five 0–5 dimensions, top-3 only, one next action per deal, EXPIRING / STALE / DYING / LEAD DROUGHT flags | wholesaler-claude-skills | Weekly 1:1 prep in minutes instead of an hour. |
| Cost-gated per-room image-to-video with fixed camera vocabulary; "prompt the camera and light, not the scene" | re-walkthrough-pro | Runs on the Higgsfield connector already available. Highest-leverage listing-marketing pattern. |
| Qualification spine: 5 questions, 1–2 at a time, act after 2 criteria, present at most 3 options, Hot / Warm / Cold on observable behavior | sofia-voice-agent | Works as a human call card, an email drafter, or a future voice agent. |
| Skill authoring discipline: one outcome, trigger, inputs, invariants, evidence, done condition; validator; honest completion report | skills-for-architects | How to make skills repeatable across 30 people of mixed skill. |

### 2. What is hollow or dangerous

- **Scraping instructions everywhere.** ai-realestate-claude, wholesaler-claude-skills, HomeHarvest, reteps/redfin, and real-estate-scrape all pull from Zillow, Redfin, or Realtor.com private endpoints or HTML. None is sanctioned. Do not port any of it.
- **Fair Housing hazards.** Neighborhood scoring by income or demographics (ai-realestate-claude, skills-for-architects demographics-analysis), school ratings in speed responses and MLS copy (realtor-claude-skills), family framing (agency-os). Strip all of it.
- **Automation without consent.** sofia-voice-agent runs fully automated AI-voice outbound on an hourly cron with no consent flag, calling window, do-not-call check, attempt cap, recording disclosure, or AI disclosure. Unusable in California as shipped. Borrow only the call-flow design.
- **Documentation drift.** zillow-mcp-server calls endpoints that do not exist. HomeHarvest's README promises fields its code disables. ai-realestate-claude's PDF script keys do not match its own schema, so demo data silently fills in. Verify before trusting any README in this set.
- **Vendor upsells.** realtor-claude-skills and wholesaler-claude-skills push RankGrid and PropStream; prosperity pushes an eXp recruiting pitch. Remove on adaptation.
- **Wholesaler tactics.** Motivation-scoring elderly, probate, or delinquent owners and subject-to pitches are out of scope for a brokerage. Reuse only the coaching mechanics.

### 3. Licensing posture

| Posture | Repos |
|---|---|
| MIT: patterns and short fragments reusable with attribution | realtor-claude-skills, ai-realestate-claude, skills-for-architects, prosperity-real-estate-skills, awesome-claude-cowork-plugins, reteps/redfin, HomeHarvest, wholesaler-claude-skills, re-walkthrough-pro, zillow-mcp-server |
| Apache-2.0: reusable, keep attribution if files are copied | cre-agent-skills |
| AGPL-3.0: ideas and formulas only, never fork or host | real-estate-mcp |
| No license: ideas only, nothing verbatim | agency-os, real-estate-scrape, sofia-voice-agent |

---

## What this means for the Redfin LA team

**Buy-side.** The qualification spine, speed-to-lead first-touch drafting, buyer-consult prep with a deterministic payment card, and the Rocket introduction scripts are the four pieces that move contact-to-tour and tour-to-offer. None of the repos ties financing to the consult the way a Redfin | Powered by Rocket team must, so that workflow has to be built fresh with RESPA language baked in.

**Sell-side.** Comp discipline tables, the "not an appraisal" disclosure logic, pricing tiers with a cost-of-overpricing block, and the three-track escrow timeline (contract / lender / documents with T-48, T-24, T-7 checkpoints) are the sell-side keepers. The lender track is where Rocket-financed escrows die quietly; a tracker that watches it is high value.

**Manager view.** Nothing in the set does this. The pipeline stack-ranking, learnings journal, and handoff card patterns combine into a weekly 1:1 brief that no existing repo provides.

**Data.** Stop thinking about scraping. Build the Listing Health scorecard from MLS exports using the 66-column HomeHarvest schema as the column spec, track list price versus Redfin Estimate at launch from internal data, and run the ZIP-level market brief from Redfin Data Center public downloads. Field dictionary and five workflows are in report 03, sections 5 and 6.

---

## Recommended build roadmap

The four reports proposed 28 skills between them. Consolidated and prioritized into one list. Every skill loads the compliance overlay first, produces labeled drafts only, and uses the template in `skills/_template/`.

| Priority | Skill | What it does | Built from |
|---|---|---|---|
| 1 | `compliance-overlay-ca` | Fair Housing (federal + California classes), TCPA consent gate, MLS cliché ban, anti-disparagement, RESPA / Rocket language, accuracy ledger. Loaded by everything else. | Prosperity overlay, Cowork facts-only block |
| 2 | `coaching-memory` | System layer: per-agent, per-customer, per-listing folders, LA ZIP market profiles, append-only pipeline and learnings journal, 7 / 30 / 90-day freshness. | wholesaler `_system/`, realtor client-memory |
| 3 | `first-response` | New Redfin contact → classification, evidence-only score, SMS and email drafts in the agent's voice, call card with the 5-question spine, handoff card. Human sends. | realtor lead-recon, sofia qualification spine |
| 4 | `follow-up-coach` | Per-contact cadence with channel / exact words / why / if-respond / if-not and stop rules; weekly pipeline audit with manager coaching note. | realtor nurture-coach, agency-os two-touch rule |
| 5 | `buyer-consult-prep` | Pre-consult brief: area one-pagers, "what your budget buys," deterministic PITI card with assumptions, CA buyer representation agreement explainer, multiple-offer readiness, Rocket intro with consent. | ai-realestate mortgage, cre intake, Cowork offer table |
| 6 | `rocket-attach-coach` | Compliant lender-introduction scripts for four moments, objection handling, buydown-vs-price-cut math, attach diagnostics across an agent's last N customers. | Cowork mortgage-broker compliance, real-estate-mcp formulas |
| 7 | `cma-review` and `listing-launch-la` | Comp table with capped adjustments and relevance weights, three pricing tiers, LA seller net sheet (county and city transfer tax, Measure ULA flag), CRMLS remarks through the overlay, "not an appraisal." | ai-realestate comps, cre BOV, realtor listing-presentation |
| 8 | `offer-negotiation-brief` | Must-have / preferred / tradable / unacceptable, give-get per term, certainty score beside price, legal items for broker of record. | cre negotiation brief |
| 9 | `escrow-tracker-ca` | Three-track CA RPA timeline with T-48 / T-24 / T-7 / T-3 / T-1 flags, low-appraisal three-option framework, Rocket loan-officer sync card. | agency-os three-track timeline, cre PSA-to-close |
| 10 | `coaching-1on1` and `agent-pipeline-stack` | Weekly per-agent brief: funnel deltas vs team median, the one gap, one real example to praise and one to fix, 5-minute role-play, one commitment. Team roll-up. | wholesaler deal-stacker, realtor learnings journal |
| 11 | `listing-cinematic-reel` | Redfin-commissioned photos → Higgsfield per-room video → stitched 16:9 walkthrough and 9:16 reel with Redfin \| Rocket end card, Equal Housing line, AI-motion disclosure. Credits stated before generation. | re-walkthrough-pro |
| 12 | `listing-health-scorecard` | Weekly MLS export → DOM, days-to-pending, price-cut count and size, list-to-sale ratio, flags per agent and ZIP. Pairs with a ZIP market brief from Redfin Data Center. | HomeHarvest schema, reteps/redfin field knowledge |

Full specs for every skill, with trigger, inputs, process, and outputs, are in section 6 of reports 01 and 02 and section 4.2 of report 04.

---

## Compliance rules for anything built from this research

1. **Data access.** Redfin internal tools, Tableau, MLS exports, and Redfin Data Center public downloads only. Free federal APIs (FEMA, FRED, Census, EPA) are fine. No Zillow, Realtor.com, Homes.com, or PropStream fetches.
2. **Pricing opinions.** Every CMA or price recommendation carries the NAR SOP 11-1 content and "This is not an appraisal." Never label a model-generated number "Fair Market Value" without the range, the evidence, and the disclaimer.
3. **Fair Housing.** No neighborhood scoring by income or demographics. No school-quality language. Objective facts and public-source links only. Broker compliance reviews the house rule on attendance-zone facts.
4. **Rocket attach.** Every payment figure carries assumptions and "planning estimates, not a lending offer." Scripts present Rocket as an option, never a condition, include the affiliated-business disclosure, and never let an agent quote rates or take applications.
5. **Outreach.** Humans send. Drafts only. 8am–9pm Pacific. Consent on file or customer-initiated contact before any text or call. Honor opt-outs.
6. **Licensing.** Re-implement the AGPL finance math from scratch. Paraphrase, never copy, from the three unlicensed repos. Keep attribution when lifting MIT or Apache fragments.

---

## Method

1. Searched GitHub across six angles: Redfin-named repos, real estate Claude skills, real estate AI agents, real estate MCP servers, scrapers and mortgage calculators, real estate CRMs.
2. Shallow-cloned 15 repos into an isolated read-only folder. No installers, scripts, or interpreters were run from any clone.
3. Four parallel analysts each took a theme and read every in-scope file in full, quoting fragments under 25 lines verbatim and paraphrasing anything from unlicensed sources.
4. Consolidated the four syntheses into this README and the skill template in `skills/_template/`.

## Follow-up steps

- Pick the first three skills from the roadmap (compliance overlay, coaching memory, first-response) and build them against the template.
- Have broker compliance review the overlay's California protected-class list, school-reference house rule, and Rocket disclosure language before any client-facing use.
- Template the Monday MLS export so the Listing Health scorecard runs in 15 minutes.
