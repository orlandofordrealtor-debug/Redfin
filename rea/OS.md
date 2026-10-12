# Team operating system map

The parts of the business Orlando touches, rebuilt as his own system for his 30 agents and run in parallel with what corporate ships. Each REA drop should move one row forward. Status values: **Corporate only** (no sandbox version yet) · **Mapped** (mechanism understood, no build) · **Sandbox built** (product exists, not yet in use) · **Running parallel** (in use alongside the corporate process) · **Adopted** (sandbox version is now how the team works).

| # | Function | How it works today (corporate) | Sandbox version | Status | Drops |
|---|---|---|---|---|---|
| 1 | Lead intake and routing | Redfin AI Contact Routing (AICR) routes tour requests to agents in waves with push notifications; claim rate and scheduling category drive outcomes | AICR routing analysis and meeting dashboard | Running parallel | `aicr-routing-report` skill |
| 2 | Customer assignment | Weekly round-robin of unassigned customers via Unassigned Customer Tool, Contact Load Management, Team Dashboard | Even-distribution planner, audit, and team communication | Running parallel | `weekly-customer-assignment` skill |
| 3 | Speed to lead / first response | Agent responds from Redfin tools; no team standard for first-touch drafting or call card | Not built. Spec: classification, evidence score, SMS and email drafts in agent voice, 5-question call card, handoff card | Mapped | 15-repo teardown (roadmap #3) |
| 4 | Follow-up and nurture | Agent-managed; no shared cadence, stop rules, or weekly audit | Not built. Spec: per-contact cadence with channel / words / why / if-respond / if-not, weekly pipeline audit with coaching note | Mapped | 15-repo teardown (roadmap #4) |
| 5 | Cancelled-tour recapture | Cancelled Tour Details export reviewed manually | Recapture analysis, coaching dashboard, per-agent Slack and Gmail messages | Running parallel | `recapture-command-center` skill |
| 6 | Buyer consultation | Agent-run; no standard prep brief | Not built. Spec: area one-pagers, budget-to-payment card, CA buyer representation explainer, multiple-offer readiness, Rocket intro with consent | Mapped | 15-repo teardown (roadmap #5) |
| 7 | Rocket mortgage attach | Rocket referral report reviewed by manager; Agent Tools referral flow; 3-Way Text | Referral command center with per-agent coaching emails and progress tracking | Running parallel | `rocket-referral-command-center` skill; roadmap #6 (attach-coach scripts) still Mapped |
| 8 | Pricing and CMA discipline | Agent-run CMAs; no team review step | Not built. Spec: capped adjustments, relevance weights, three tiers, LA net sheet, "not an appraisal" | Mapped | 15-repo teardown (roadmap #7) |
| 9 | Listing launch and marketing | Redfin listing package and photography; agent social posts | Closing graphics campaign exists; listing-launch copy and cinematic reel specs not built | Sandbox built (graphics) / Mapped (launch, reel) | `redfin-luxury-closing-graphics` skill; roadmap #7, #11 |
| 10 | Offer strategy and negotiation | Agent-run | Not built. Spec: must-have / preferred / tradable / unacceptable, give-get, certainty score | Mapped | 15-repo teardown (roadmap #8) |
| 11 | Escrow to close | Transaction coordination through Redfin systems | Not built. Spec: three-track CA RPA timeline with T-48 / T-24 / T-7 flags, Rocket LO sync card | Mapped | 15-repo teardown (roadmap #9) |
| 12 | Post-close: reviews, referrals, sphere | Agent-managed | Not built | Corporate only | |
| 13 | Agent coaching and 1:1s | Manager-run from Team Dashboard and Tableau | Not built. Spec: weekly per-agent brief, funnel deltas vs team median, one gap, role-play, one commitment, team roll-up | Mapped | 15-repo teardown (roadmap #10) |
| 14 | Team communication and market updates | Manager Slack posts; monthly market report | Monthly branded market kit with scripts, captions, deployment calendar | Running parallel | `la-market-visual-kit` skill |
| 15 | Performance reporting and dashboards | Tableau and Team Dashboard | Listing Health scorecard and ZIP market brief specs not built | Mapped | 15-repo teardown (roadmap #12) |
| 16 | Recruiting | Corporate recruiting plus manager outreach | Not built | Corporate only | |
| 17 | Training and onboarding | Corporate curriculum | Not built | Corporate only | |
| 18 | Compliance layer (Fair Housing, TCPA, RESPA) | Corporate policy and broker review | Compliance floor documented in PLAYBOOK §5 and skill template; overlay skill not built | Mapped | 15-repo teardown (roadmap #1) |
| 19 | Memory and knowledge | None shared across agents | Repo context, index, and drops; coaching-memory layer not built | Sandbox built (repo) / Mapped (memory layer) | 15-repo teardown (roadmap #2) |

## How to use this map

- Drop something and say which function it touches, or let the REA pick the row.
- "Where are we" means: read this table, report rows by status, name the next best drop.
- When a sandbox version goes into use, change the status to Running parallel and record the start date and the metric being watched in the Drops column.
