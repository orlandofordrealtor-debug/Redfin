# Weekend MOD Studio

A shared web app for building the Redfin Powered by Rocket weekend **Manager on Duty (MOD)** email. One sales manager is on duty each weekend; each of them opens the Studio, picks their profile, headshot and that weekend's focus, chooses one of five styles, and copies an inbox-ready email into Gmail.

Published as a claude.ai artifact. The shared data (managers, headshots, infographics, standard info and send history) lives in the artifact's database and asset store, not in this repo.

## What's here

| Path | What it is |
| --- | --- |
| `index.html` | The whole Studio: UI, email renderer and export. Published as the artifact page. |
| `brand/logo-*.png` | Redfin Powered by Rocket lockups (primary, reverse, white), cut from the official brand sheet. |
| `brand/live-dot-*.gif` | Pulsing "on duty" dot, one per email style background (light, dark, tint, red, navy). Animates in Gmail and Apple Mail. |
| `text.html` | Text link page. Opens Messages with the manager's number filled in. Must be hosted at a public https address (see Text links below). |

## How it works

- **Schedule** (landing page): who's on duty this weekend, the upcoming rotation by month, find-my-weekends, swaps (both weekends update), add a weekend, and continue the rotation. "That's me" opens the builder with that manager and weekend filled in, and the builder defaults to the scheduled MOD.
- **Build email**: seven steps (manager, weekend and message, headshot, focus spotlight, sections, style, send) with a live desktop/phone preview. Sections can be dragged into any order, and an optional weekend announcement block can go anywhere.
- **Edit any section for one email**: every section in step 5 has an **Edit** button. It opens the section prefilled with the current standard wording, hours and links: headings, team names, "when agents need this" lines, contact lines, playbook steps, coverage hours (including the MOD's own hours and the time zone note), the featured spotlight's text, wins and the announcement. A team can also be left out of one section. Edits are saved with the draft for this email only, store only what changed, and never touch standard info. **Reset to standard** undoes them, and a draft carried into a new weekend starts from the standard wording again.
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

## Text links

Gmail (web and app), Outlook and Yahoo remove `sms:` links from emails, so a plain Text button does nothing there. Call (`tel:`) and Email (`mailto:`) links are kept.

The fix is `text.html`, a one-file page:

1. Host `text.html` at any public https address, such as GitHub Pages or a Redfin web server.
2. In the Studio, open **Brand & access → Text links** and paste that address.
3. Every Text button and texting link in the email, Standard info hotlines included, now points to `text.html?to=<digits>&n=<first name>`. On a phone the page opens Messages with the number filled in right away, with a big Text button as a backup. On a computer it waits for a tap.

The page reads only digits from the link and only ever opens `sms:` or `tel:` for that number. It loads nothing from other sites and has no tracking. Until a page address is set, the Send step shows a reminder.

## Headshots and who can change them

- **Editors and Contributors** can add, rename, replace and delete any manager's photos, and set anyone's default photo, from Build email (Step 3) or Library → Headshots. Editors' uploads go to the asset store at full size. Contributors can't use the asset store, so their photos are resized to email size (about 900 px, under 150 KB) and saved on the photo record itself.
- **Viewers and outside link visitors** can't save shared changes; Claude's sharing rules block it, and no page setting can lift that. They can still pick any photo for their own email, and "Use this photo every time on this device" remembers that pick in their browser.
- To give every manager full rights: Share → turn off "Anyone with the link" → invite each manager by email as an Editor.

## Uploads

Every upload button is a real file input laid over the button, so a tap opens the photo library or file picker directly on phones and computers (no scripted clicks, which some mobile browsers and in-app views block). Headshots and infographics save as soon as they're picked; large photos are resized before upload, and HEIC photos are converted where the device can read them.

## Data model (artifact database)

| Collection | Written by | Contents |
| --- | --- | --- |
| `core` | owner | Standard info sections: lines, steps, coverage hours, display flags, review status |
| `brand` | owner | `settings`: region, program, footer, default style, who edits the distribution list, logo and badge overrides |
| `distribution` | owner (or editors, per setting) | BCC recipients: name, email, team list or person, included flag, order |
| `schedule` | contributors | One doc per Saturday (`YYYY-MM-DD`): manager on duty, original manager after a swap, note |
| `managers` | contributors | Manager profiles and default headshot |
| `headshots` | contributors | Manager id, label, crop, and either an asset id or an inline JPEG (`imageData`) |
| `spotlights` | contributors | Infographic asset, title, takeaways, prompts, call to action, trash state |
| `emails` | contributors | Saved drafts for send history |
| `suggestions` | contributors | Suggested standard info updates |
