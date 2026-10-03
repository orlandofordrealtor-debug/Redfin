# Weekend MOD Studio

A shared web app for building the Redfin Powered by Rocket weekend **Manager on Duty (MOD)** email. One sales manager is on duty each weekend; each of them opens the Studio, picks their profile, headshot and that weekend's focus, chooses one of five styles, and copies an inbox-ready email into Gmail.

Published as a claude.ai artifact. The shared data (managers, headshots, infographics, standard info and send history) lives in the artifact's database and asset store, not in this repo.

## What's here

| Path | What it is |
| --- | --- |
| `index.html` | The whole Studio: UI, email renderer and export. Published as the artifact page. |
| `brand/logo-*.png` | Redfin Powered by Rocket lockups (primary, reverse, white), cut from the official brand sheet. |
| `brand/live-dot-*.gif` | Pulsing "on duty" dot, one per email style background (light, dark, tint, red, navy). Animates in Gmail and Apple Mail. |

## How it works

- **Build email**: seven steps (manager, weekend and message, headshot, focus spotlight, sections, style, send) with a live desktop/phone preview. Sections can be dragged into any order, and an optional weekend announcement block can go anywhere.
- **Send**: To is the manager on duty; BCC is the shared distribution list (the sender is left out automatically). **Launch in Gmail** opens a compose window with To, BCC and subject filled in and copies the designed email to paste in.
- **Library**: an infographic bank with upload from phone or computer (one or many files), trash, restore and delete forever; headshots grouped by manager; the manager directory; and send history. Anyone with Editor access can add to it.
- **Recipients**: the standing BCC list, with team lists and people, pause/resume, add, edit, paste-a-list and copy.
- **Standard info**: hotlines, hours, links and how-tos used in every email. Only the owner can edit; everyone else can suggest updates. Items that conflicted across past MOD emails are flagged for review.
- **Brand & access**: logo overrides, public image links, program details and sharing guidance.

## Email output

- Table-based layout with inline styles only, so it survives a paste into Gmail.
- Ten styles. Classic: Signature Red, After Hours, Golden Hour, Executive Brief, Billboard. Creative: Open House, Featured Listing, Weekend Edition, Blueprint, Postcard.
- **Copy email for Gmail** puts rich HTML on the clipboard with images embedded. **Download .html** saves a web version that also plays CSS entrance animations.
- Any image can be given a public `https://` link instead, so it loads in every inbox.

## Data model (artifact database)

| Collection | Written by | Contents |
| --- | --- | --- |
| `core` | owner | Standard info sections: lines, steps, coverage hours, display flags, review status |
| `brand` | owner | `settings`: region, program, footer, default style, who edits the distribution list, logo and badge overrides |
| `distribution` | owner (or editors, per setting) | BCC recipients: name, email, team list or person, included flag, order |
| `managers` | contributors | Manager profiles and default headshot |
| `headshots` | contributors | Manager id, asset id, label, crop |
| `spotlights` | contributors | Infographic asset, title, takeaways, prompts, call to action, trash state |
| `emails` | contributors | Saved drafts for send history |
| `suggestions` | contributors | Suggested standard info updates |
