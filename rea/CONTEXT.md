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

## Decisions and standing rules

- REA means Reverse Engineer Anything (confirmed 2026-10-12). The thread is a sandbox for reverse engineering parts of the business and running improved versions in parallel.
- Compliance floor in `rea/PLAYBOOK.md` §5 applies to all agent- and client-facing output.

## Open items (awaiting Orlando)

- Which link types will be most common.
- Default output destination (repo, artifacts, Drive, Gamma).
- What "run it parallel" means operationally: shadow process with metrics, prototype replacements, or a personal team operating system.
- Data boundaries: whether real agent and customer names may appear in repo files and published artifacts.
