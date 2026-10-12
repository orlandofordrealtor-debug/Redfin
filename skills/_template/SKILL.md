---
name: <kebab-case, must equal folder name>
description: "<What it does>. Use when <trigger phrases agents actually say>. Not for <adjacent cases>."
version: 0.1.0
owner: <manager or agent name>
client_facing: false
---

# /<name> — <one-line outcome>

## Outcome
One sentence: the artifact or decision this produces, and who receives it.

## Trigger / Not for
- Use when: ...
- Not for: ... (say which skill to use instead so it does not mis-trigger)

## Inputs
| Input | Required | Where it comes from | Default |
|---|---|---|---|
| | | | |

Ask at most 3 questions, each with a default. Accept "go" to take all defaults.
State cost or credits before any paid generation (video, image, voice).

## Hard rules (compliance + brand)
- Re-read the team Brand & Compliance doc (Drive link) at the start of every run. If unreadable, stop before any client-facing output.
- Fair Housing: never describe neighborhoods, buyers, or sellers by any federal or California protected class. Objective facts and public-source links only. No school-quality language.
- Humans send client messages. This skill produces labeled drafts only: `DRAFT — Agent — Channel — Client`.
- Outreach window 8am–9pm Pacific. Honor opt-outs. No texts or calls to anyone without customer-initiated contact or consent on file.
- No rates, terms, or approval promises from non-licensed people. Rocket is presented as an option, never a condition. Include the affiliated-business disclosure cue. Hand off to the Rocket loan officer only with the client's consent.
- Any price opinion carries "This is not an appraisal" and the evidence it rests on.
- Facts only. Echo every number verbatim from the source. Mark anything missing as `Not provided` and anything uncertain as `Verify before sending`.
- Client-facing output ends with the canonical Equal Housing line and the sentinel `<!-- redfin:requires-fair-housing -->`.

## Procedure (only where order matters; say why)
1. ...

## Output contract
Exact paths and filenames, formats, and where the result is posted (Slack channel, Drive folder, Gmail draft).
Every run ends with:
- **DATA SOURCES**: live / cached (with date) / estimated / missing
- **FILES SAVED**
- **WHAT'S NEXT**: 2–4 next skills with time estimates

## Handoff card (when the output moves to another person or skill)
- Summary
- Key details
- Context
- GAPS (never empty; "none" is not an answer)
- NEXT ACTION (exactly one)
- Confidence = completeness of inputs, stated as a percent

## Quality checklist + score
- [ ] ...
100% ship · 80–99% fix and ship · 50–79% rework · <50% restart

## Completion report
State one of: **Full** · **Partial/blocked** (what succeeded, what remains, last verified step, next action) · **Instructions only**.
List sources with data vintage, credits spent, and files written (after readback). Include a Gaps & Caveats section.
Then ask: "Do you like it? Name the part to redo."
