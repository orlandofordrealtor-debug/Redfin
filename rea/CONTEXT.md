# Standing context

Durable facts about Orlando's business, tools, and preferences. Read at the start of every session. Update when something durable is learned. Keep facts, assumptions, and open items separate.

## Role and team (confirmed)

- Orlando Jimenez-Ford, Sales Manager, Redfin | Powered by Rocket, Los Angeles / Southern California.
- Leads a team of about 30 agents (W-2 brokerage model, round-robin customer distribution).
- Uses AI as a strategic partner for leadership, agent coaching, performance analysis, client communication, transaction guidance, market interpretation, recruiting, training, branding, prompt engineering, and operations.

## Workflows already understood (from existing skills in Orlando's environment)

| Workflow | What it is | Skill that runs it |
|---|---|---|
| AICR routing analysis | Redfin AI Contact Routing tour-routing data (Sankey, T_Sankey, Tableau exports) → executive analysis + meeting dashboard. Claim rates, push notifications, scheduling categories, waves. | `aicr-routing-report` |
| Cancelled-tour recapture | Cancelled Tour Details export → recapture analysis, coaching dashboard, per-agent Slack and Gmail coaching messages. | `recapture-command-center` |
| Rocket referral cycle | Rocket referral report → command center with one coaching email per agent, customer links, Agent Tools screenshots, 3-Way Text resource, execution playbook. | `rocket-referral-command-center` |
| Weekly customer assignment | Even round-robin of unassigned customers across the 30-agent roster using the Unassigned Customer Tool, Contact Load Management, Team Dashboard. | `weekly-customer-assignment` |
| Monthly market kit | Housing market report (Reports On Housing / LA County Sold Reports) → branded visual kit, scripts, captions, deployment calendar. | `la-market-visual-kit` |
| Closing graphics | Closed transaction → ten premium 9:16 "Just Closed" graphics. | `redfin-luxury-closing-graphics` |

## Tools and connectors available in this environment

Gmail, Google Calendar, Google Drive, Slack, Docusign, Gamma, Higgsfield (image, video, voice), Claude Docs, GitHub, QuickBooks, Tactiq and Wispr Flow (meeting transcripts), PDF viewer, web search and fetch, published artifacts (interactive HTML with optional shared database).

## Preferences (from Orlando's stated preferences)

- Senior consultant, sales strategist, operator, data analyst, leadership coach. Clear, direct, polished, immediately usable.
- Executive structure: summary, insights, meaning, risks and opportunities, actions, coaching language, follow-ups, copy/paste templates, tables and scorecards.
- Team-facing: motivational, action-oriented, accountability without negativity. Emojis fine for Slack.
- Client-facing: plain English, confident, trustworthy, flag risks and questions to ask the right professional.
- No fabricated facts, numbers, quotes, policies, or market data. Say what needs verification.
- Clarifying questions only when truly necessary; otherwise state assumptions and deliver the strongest first draft.

## Research on file

- `research/real-estate-ai-teardown/`: 15 open-source real estate AI repos reverse engineered. Ranked patterns, compliance landmines, 12-skill roadmap, listing-data field dictionary.

## Decisions and standing rules (confirmed by Orlando 2026-10-12)

- **REA means Reverse Engineer Anything.** The thread is a sandbox for reverse engineering parts of the business and running improved versions in parallel.
- **"Run it parallel" means a personal team operating system.** Orlando is rebuilding the parts of the business he touches as his own system for his 30 agents, independent of what corporate ships. Every drop should therefore land somewhere in `rea/OS.md` (the function map) and move a function from "corporate only" toward "sandbox version live." Metrics and shadow comparisons are still produced, but the goal is a working system, not just an experiment.
- **Link types: all four.** Internal Redfin tools (screenshots and exports only), competitor and vendor products, content and ideas (video, podcasts, articles, posts, frameworks, prompts), software and repos.
- **Default destinations: published artifacts, repo files, and Google Drive / Docs / Sheets.** Interactive products go out as artifacts. Teardowns, scripts, prompts, and templates are committed here. Documents and spreadsheets meant for editing inside Redfin's Google Workspace go to Drive. Gamma decks only on request.
- **Data: real names everywhere.** Real agent and customer names are used in every output, including published artifacts and files sent to external generators. Orlando chose speed over anonymization. Artifacts are private by default; flag once per drop when a deliverable carries customer PII outside Redfin-controlled systems so the sharing decision is deliberate.
- Compliance floor in `rea/PLAYBOOK.md` §5 applies to all agent- and client-facing output.

## Open items

- None blocking. Add here as they come up.
