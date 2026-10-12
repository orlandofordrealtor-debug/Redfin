# REA Playbook: Reverse Engineer Anything

**Purpose.** Turn any link, file, screenshot, or description into (a) a clear understanding of how the thing works and (b) customizable products Orlando can run in parallel with the current workflow. The end state is a **personal team operating system**: the parts of the business Orlando touches, rebuilt as his own system for his 30 agents, running alongside what corporate ships. `rea/OS.md` is the map of that system; every drop should move one function on it forward.

---

## 1. How to drop something in

Paste any of these, with or without a sentence of intent:

| You drop | How it gets handled |
|---|---|
| Public URL (article, product page, competitor site, docs, YouTube) | Fetched and read. Video: transcript when retrievable, otherwise page metadata plus your notes. |
| GitHub repo | Shallow-cloned read-only into an isolated folder. Read, never executed. |
| Google Drive / Docs / Sheets link | Read through the Drive connector. Sheets are analyzed as data. |
| Gmail thread or Slack thread | Read through the connector. Summarized, then reverse engineered as a process. |
| PDF, screenshot, image, CSV, XLSX | Read directly. Screenshots of internal tools are treated as the spec of that tool. |
| A description in your own words ("here is how we assign leads today…") | Treated as a process to map and improve. |
| Internal Redfin tool or dashboard | Only what you paste or export. No logins, no scraping. The screenshot or export is the source of truth. |

Optional one-liners that steer the work: `snapshot`, `blueprint`, `build it`, `compare to how we do X`, `for agents`, `for clients`, `for my leadership`, `Slack-ready`, `make it a skill`.

---

## 2. Tiers

| Tier | Name | What you get | Default for |
|---|---|---|---|
| **T1** | Snapshot | One page: what it is, the mechanism in plain English, Steal / Adapt / Avoid, three actions. 10–20 minutes of work. | Articles, posts, videos, single screenshots, quick "what is this" |
| **T2** | Blueprint | Mechanism map (inputs, decision rules, data model, outputs, incentives), gap analysis against the current Redfin workflow, rebuild spec with the exact components, draft deliverables (scripts, templates, prompts). | Tools, products, dashboards, multi-step workflows, competitor offerings, repos |
| **T3** | Parallel Build | Everything in T2 plus a working sandbox product: interactive artifact, skill, prompt pack, spreadsheet model, or document set, loaded with sample or your data, plus a side-by-side run plan with metrics and cadence. | "Build it", "make it", "run this parallel", or any T2 whose rebuild is under a few hours of work |

If no tier is stated, the default is by object type above. The chosen tier is stated in one line at the start of the response. Upgrading later is one word: "build it."

---

## 3. Output contract

Every REA produces `rea/drops/YYYY-MM-DD-<slug>/REA.md` from `rea/_template/REA.md`, plus deliverables in the same folder, plus a row in `rea/INDEX.md`. Sections, in order:

1. **Executive summary.** Three to five sentences. What it is, why it matters to the business, the one recommendation.
2. **Mechanism map.** How it actually works: inputs, steps, decision rules, scoring or routing logic, data model, outputs, incentives, failure modes. Diagrams when a picture shows the mechanism better than prose.
3. **Steal / Adapt / Avoid.** A table. Steal: use as-is. Adapt: use with named changes. Avoid: and why (compliance, cost, culture, doesn't fit a W-2 brokerage team).
4. **Redfin | Rocket adaptation.** What this looks like for a 30-agent LA team: buy-side, sell-side, manager view, Rocket attach where relevant.
5. **Parallel-run plan.** How to run the sandbox version alongside the current process: who, cadence, sample size, the two or three metrics that decide the winner, when to review, kill criteria.
6. **Deliverables.** Copy/paste ready. Scripts, emails, Slack posts, prompts, templates, scorecards, agendas, artifact links. Labeled by audience: agents, clients, leadership.
7. **Compliance flags.** Fair Housing, TCPA, RESPA, data privacy, licensing, company policy. Specific, not generic.
8. **Open questions.** What would make the next version better; what only Orlando can answer.
9. **Sources.** Links, commit SHAs, file names, dates. What was read fully vs skimmed.

Tone: senior consultant and sales leader. Direct, practical, agent-centric, consumer-centric. No filler. Tables, scorecards, and frameworks when they make the page scan faster.

---

## 4. Where outputs go

| Output type | Destination |
|---|---|
| The teardown itself | `REA.md` in the drop folder, committed |
| Interactive dashboard, tool, calculator, command center | Published artifact, link in REA.md, HTML source in the drop folder |
| Documents and spreadsheets meant for editing or sharing inside Redfin's Google Workspace | Google Doc / Sheet in Orlando's Drive, link in REA.md |
| Decks | Gamma or slides artifact, on request only, link in REA.md |
| Scripts, email copy, Slack posts, prompts | In full inside REA.md and as separate files in the drop folder |
| Skills | `skills/<name>/` from the template, referenced from REA.md |
| Spreadsheets and models | `.xlsx` in the drop folder, or Google Sheet on request |

---

## 5. Compliance floor

Applies to anything agent-facing or client-facing that comes out of a drop.

- **Fair Housing.** No descriptions of neighborhoods, buyers, or sellers by any federal or California protected class. No school-quality language. Objective facts and public-source links only.
- **TCPA / outreach.** Humans send. Drafts only, labeled `DRAFT — Agent — Channel — Client`. Window 8am–9pm Pacific. Consent on file or customer-initiated contact before any text or call. Honor opt-outs.
- **RESPA / Rocket.** Rocket is an option, never a condition. Include the affiliated-business disclosure cue. Agents never quote rates, terms, or approval odds. Loan-officer handoff only with the client's consent.
- **Pricing opinions.** "This is not an appraisal," with the evidence it rests on.
- **Accuracy.** Facts only. Numbers echoed verbatim from the source. `Not provided` and `Verify before sending` where applicable. No fabricated stats, quotes, or market data.
- **Data.** Real agent and customer names are used everywhere, including published artifacts (Orlando's decision, 2026-10-12). Artifacts are private by default. Flag once per drop when a deliverable carries customer PII outside Redfin-controlled systems so the sharing decision is deliberate. Internal systems come in only as pastes and exports.
- **Company policy.** Flag anything that would need compliance, legal, or leadership sign-off before use. Do not assume approval.

---

## 6. The operating system map

`rea/OS.md` lists the business functions Orlando touches (lead intake through post-close, plus coaching, recruiting, marketing, and reporting). For each: how corporate does it today, what the sandbox version is, its status, and the drops that built it. When a drop completes, update the relevant row. When Orlando asks "where are we," read OS.md first.

## 7. Memory

- `rea/CONTEXT.md` holds durable context: role, team, tools, known workflows, preferences, decisions. Read at session start; update when something durable is learned.
- `rea/INDEX.md` is the running log of every drop with date, object, tier, one-line outcome, and link.
- Each drop folder is self-contained so any future session can pick it up cold.
