# Ford Family HQ — Build Blueprint

**Platform:** Base44 (existing app "Ford Family HQ", TanStack Start)
**Primary source of truth:** the Ford Inc. Google Drive folder + the "Ford Inc — Consolidated Master Workflow & Accounting System" Google Sheet
**Prepared:** November 22, 2026
**Status:** Design questionnaire complete; this spec drives the Base44 build.

> This document is intentionally free of account numbers, policy figures, parcel numbers, folder IDs, and personal contact details. The app pulls real values live from Drive and Sheets behind sign-in; nothing sensitive is hard-coded.

---

## 1. Purpose

One private, beautifully designed home base for the Ford family that:

1. Gives Orlando and Timiesha a real-time operating view of the family business (Ford Inc.) and household.
2. Gives Orlando Jr., Lennox, and Paxton age-appropriate visibility into the family business, their own documents, their benefits/protection, and their life journey (school → college → career).
3. Captures life events in real time, lets everyone upload documents and photos, and turns it all into a monthly family newsletter.
4. Hosts an AI Family Studio and a gallery for the family's photos and videos stored in Drive.

---

## 2. Questionnaire decisions (locked)

| # | Topic | Decision |
|---|-------|----------|
| 1 | Logins & profiles | Orlando & Timiesha (parents/admins); Orlando Jr., Lennox, Paxton (kids). Dolores appears as extended family with no login. |
| 2 | Privacy model | **Tiered vault.** Parents see everything. Kids see their own docs + family-wide content. IDs, banking, credit, medical, legal/estate locked to parents. |
| 3 | Drive connection | **Smart index + sync.** Searchable, tagged catalog (person, category, privacy tier, date) synced from Drive. Files open in Drive. Uploads land back in the right Drive folder. |
| 4 | Scope | **Exclude** Redfin client transactions, agent coaching folders, Redfin leadership/training, Scanned Mail, Needs Review, and `_Ops` automation folders. |
| 5 | Visual direction | **Combine "Dark command center" + "Aurora glass"** into one unified system that incorporates the design features of all eight reference screenshots. |
| 6 | Home screen | **All of the above:** personal dashboard (default) + family timeline feed + magazine cover + wall-tablet command-center mode. |
| 7 | Name | **Ford Family HQ** |
| 8 | Palette | **Navy & gold** |
| 9 | Business visibility | Parents: full real-time detail including P&L, financials, credit and every other financial detail available. Kids: per property, **mortgage owed and rent amounts in dollars**; every other ledger line item (taxes, insurance, utilities, renovations, repairs, pending obligations, pending items) shown **by name and status only, no dollar figures**, so they understand everything involved with each property. |
| 10 | Newsletter | **Monthly AI draft → parents approve → publish on site + email family.** |
| 11 | AI Studio | Styled portraits, milestone graphics, smart albums & captions, photo enhancement. |
| 12 | Life tracking | School → college → career; health & benefits; money & legal milestones; celebrations & achievements. **Kids must clearly see that they have access to LegalShield and IDShield, all of their health benefits, and their life insurance coverage.** |
| 13 | Kids' $ view (confirmed) | Mortgage & rent dollars visible; all other items names + status only. |
| 14 | Sign-in | **Google sign-in, invite-only, plus a second step (PIN) for parents** before opening the Vault and full financials. |
| 15 | Uploads | **Review queue → parent approves → auto-tag and auto-file into the correct Ford Inc. Drive folder.** |
| 16 | Calendar & alerts | Sync Google Calendar; deadline auto-reminders; email alerts. |

---

## 3. Information architecture

```
Ford Family HQ
├── Home
│   ├── My Dashboard (default, personalized)
│   ├── Family Feed (timeline of everything, newest first)
│   ├── Magazine (current newsletter as a cover story)
│   └── Command Center (full-screen wall-tablet / kiosk mode)
├── Family
│   ├── Directory (member tiles, Luffu-style "what's on their mind" bubbles)
│   └── Member profile → Journey (school → college → career), docs, events, photos
├── Timeline (life events: filters by person, category, year)
├── Ford Inc.
│   ├── Parents: Portfolio command center (real-time from Master sheet)
│   └── Kids: "Ford Inc. 101" property awareness view
├── Protection (2027 Benefits)
│   ├── Your Protection (per-person: health, life insurance, LegalShield, IDShield)
│   └── If something happens (kid-friendly guide + who to call)
├── Vault (smart document index, tier-filtered; Parents Vault behind PIN)
├── Media (Drive photos & videos, albums, reels)
├── Studio (AI Family Studio)
├── Newsletter (archive + current issue + parent editor)
├── Calendar (Google Calendar + auto-deadlines)
├── Upload (global "+" button, always visible)
└── Admin (parents only): members & invites, review queue, sync status, privacy rules, PIN
```

---

## 4. Roles & privacy tiers

### Roles
| Role | Who | Base44 role |
|------|-----|-------------|
| Parent | Orlando, Timiesha | `admin` |
| Kid | Orlando Jr., Lennox, Paxton | `user` |
| Extended (no login) | Dolores | profile only |

### Tiers (every Document, MediaItem, LifeEvent, and index record carries one)
| Tier | Label | Who can see | Examples |
|------|-------|-------------|----------|
| T0 | Family | Everyone signed in | Family photos, celebrations, newsletter, Protection summaries, property awareness |
| T1 | Personal | The owner + parents | A child's report cards, college docs, Army docs, personal uploads |
| T2 | Parents | Parents only | Property folders, P&L, loans, insurance policies, contracts, car info, business travel |
| T3 | Parents Vault | Parents only **after PIN step-up** | IDs/licenses, bank & credit statements, tax returns, medical records, trust/estate, Identity & Privacy |

### Enforcement requirements
- **Never rely on hiding things in the UI.** Enforce with entity row-level security (RLS).
- Recommended RLS pattern: records carry `shared_with` (array of member emails) and `tier`. Read = `admin` OR `data.shared_with` contains `{{user.email}}`. Family-wide records list all five family emails; personal records list the owner's email; T2/T3 records list none.
- **Dollar amounts the kids must not see** live in fields with field-level RLS (admin-only). Store a separate `kid_visible_amount` that is populated **only** for mortgage and rent lines.
- **T3 Vault records** live in their own entity, readable only through a backend function that checks (a) the caller is `admin` and (b) a valid, recent PIN unlock (e.g., 15-minute session). The PIN is stored hashed as a secret and is never sent to the browser.
- Be honest in the UI: the PIN is a step-up lock for shared or unlocked devices. The real second factor is **Google 2-Step Verification on both parent Google accounts** (Admin page should show a reminder).
- App visibility: private, invite-only. Only the five invited Google accounts can sign in.

---

## 5. Google Drive smart index

### Connectors (app-level, connected by Orlando)
- **Google Drive** (`drive` scope: read the index + write approved uploads)
- **Google Sheets** (`spreadsheets` scope: read the Master Workflow sheet; existing TrackerItem → Action Tracker write-back)
- **Google Calendar** (`calendar.readonly` + `calendar.events`)

Because the Drive connector acts with Orlando's account, every backend function must **hard-limit itself to the Ford Inc. folder tree** and to the excluded-folder rules below.

### Sync behavior
- Scheduled sync (e.g., nightly) + "Sync now" button for parents.
- Index stores metadata only: title, Drive link, MIME type, modified date, owner member, category, tier, thumbnail URL, folder path. **Files are not copied.**
- New/unknown folders default to **T2 Parents** until a parent re-tiers them.
- Sync status panel: last run, items added/updated, errors.

### Folder → category → tier map (by folder name)
| Drive folder (path) | App area | Owner | Tier |
|---------------------|----------|-------|------|
| Family Photos | Media | Family | T0 |
| Timiesha Ford / Emerald Pictures | Media | Timiesha | T0 |
| Timiesha Ford / Vegas 19th Anniversary Reel — Production / 05 — Final Social Exports | Media (reels) | Family | T0 |
| Timiesha Ford / Vegas … / 01–04 working folders | Media (drafts) | Timiesha | T2 |
| Timiesha Ford / Alpha Kappa Alpha Inc. | Profile docs | Timiesha | T1 |
| Orlando Ford Jr. / Personal Biz Docs | Journey / docs | Orlando Jr. | T1 |
| Orlando Ford Jr. / Army Docs | Journey (career/service) | Orlando Jr. | T1 (contains sensitive IDs → flag for parent review) |
| Lennox Ford / NCAT Tuition & Payments | Journey (college) | Lennox | T1 |
| Lennox Ford / The Vic | Journey | Lennox | T1 |
| Family Financial Docs / Benefits & Life Insurance | Protection | Family | Summaries T0; policy documents T2 |
| Family Financial Docs / Healthcare Docs | Protection / health | Family | T2 |
| Family Financial Docs / Wells Fargo | Vault | Parents | T3 |
| Family Financial Docs / Income Taxes | Vault | Parents | T3 |
| Family Financial Docs / Identity & Privacy | Vault | Parents | T3 |
| Ford Family Biz / Dolores Langille — Estate Planning, Health Bills, medical, home nurse | Vault | Dolores (managed by parents) | T3 |
| Properties Biz / each property folder | Ford Inc. | Parents | T2 |
| Properties Biz / Property Insurance, Property Taxes | Ford Inc. | Parents | T2 |
| Car info | Household | Parents | T2 |
| Biz Travel | Ford Inc. | Parents | T2 |
| Root-level files (analyses, checklists, bid comparisons, strategy models) | Ford Inc. | Parents | T2 |
| Orlando Ford Sr. / Redfin Leadership & Training, Client Transactions, agent folders | **EXCLUDED** | — | — |
| Scanned Mail, Needs Review, `_Ops (automated — do not delete)` | **EXCLUDED** | — | — |

---

## 6. Ford Inc. module

### Data source
The Master Workflow sheet (read via Sheets connector). Relevant tabs:
`Properties`, `Rent Roll and Collections`, `Loans and Liens`, `Insurance`, `Property Taxes`, `Projects and Renovations`, `Notices and Compliance`, `Monthly P&L`, `Transactions`, `Annual Summary`, `Calendar 90`, `Delegation Tracker`, `Delegate to Timiesha`, `Delegate to Orlando`, `Action Tracker`, `Top 10`, `Decision Log`, `Dashboard`.

### Portfolio (from the Properties tab)
| ID | Property | Kid-friendly description |
|----|----------|--------------------------|
| P-49TH | W 49th St, Los Angeles | Duplex, 2 rental units |
| P-COMPTON | Compton Blvd, Compton | Duplex, 2 rental units |
| P-CARSON | E 189th St, Carson | Family home |
| P-SAUSALITO | West St, Sausalito | Renovation project |
| P-LOCUST | Locust Ave, Long Beach | Sold in 2023 (history) |

### Parent view: "Ford Inc. Command Center" (dark tiles)
- Property tiles (smart-home "room card" style): status chip (Active / Watch / At Risk / Archived), occupancy, health note, manager, quick links to Drive folder.
- Metro-style metric tiles with sparklines: monthly rent collected, mortgage payments, net cash flow, open obligations, overdue items.
- Full P&L, transactions, reconciliation queue, loans & liens, insurance, taxes, compliance notices, renovations, decisions, delegation queues (Delegate to Timiesha / Orlando), Top 10, Calendar 90.
- Credit and other financial details where available in Drive/Sheets (T2/T3 as appropriate).

### Kids' view: "Ford Inc. 101" (property awareness)
Per property card:
- What it is, where it is, what it's for (plain English).
- **Mortgage owed ($)** and **rent ($)**, shown with amounts.
- A checklist of every other obligation **by name and status only**: property taxes, insurance, utilities, renovations, repairs, pending obligations, pending items. Status = Paid / Pending / In Progress / Upcoming. **No dollar figures.**
- "Why this matters" lesson blurbs (what a mortgage is, why insurance and taxes exist, how rent covers costs).

---

## 7. Protection (2027 Benefits)

Rebuild the content of the original "Ford Family Benefits 2027" experience from the Drive folder **Family Financial Docs / Benefits & Life Insurance** (life insurance guide PDF, mobile HTML guide, dashboard workbook).

### "Your Protection" (every kid sees their own card set)
1. **Health benefits:** medical, dental, vision; how to use them; where the cards are.
2. **Life insurance:** what coverage exists, that they are named backups, what that means in plain English, and the "If something happens to Mom or Dad" guide.
3. **LegalShield:** that they have access to legal help, what it is for, and how to use it.
4. **IDShield:** that they have identity monitoring, what it watches, and what to do if something looks wrong.
5. **Who to call:** surviving parent → trusted adult → benefits team → insurer claims line (pulled from the Drive guide).

### Rules
- Every figure and plan detail must come from the Drive source documents. Anything not confirmed in writing shows a **"Pending confirmation"** badge (the source guide itself notes the 2027 renewal confirmations are still open).
- LegalShield/IDShield plan specifics (who is covered, ages, how to activate) must be confirmed from plan documents before showing as fact.

---

## 8. Life tracking & Journeys

- **Journey timeline per child:** school → college → career (includes military service). Milestones, documents, goals, next steps.
- **LifeEvent categories:** school, college, career, military, milestone, celebration, health, benefits, money, legal, property, travel, other.
- **Auto-deadlines:** insurance renewals, property tax dates, tuition payments, closings, benefits enrollment, document expirations (licenses/IDs). These become reminders and calendar events.

### Member record corrections to verify
The current FamilyMember records look inconsistent with the Drive folders:
- Lennox: focus says "School & activities", but the Drive folder contains NC A&T tuition → likely **college**.
- Orlando Jr.: focus says "College life", but the Drive folder contains Army docs and personal business docs → likely **military / career**.
- Paxton: no Drive folder yet → create "Paxton Ford" under Ford Family Biz.
- Emails for all five members are blank → required for invites and RLS.

---

## 9. Uploads & review queue

1. Anyone taps **+ Upload** (photo, video, or document), picks who it's about and what it is.
2. Item enters the **Review Queue** (parents get an email alert).
3. Parent approves → the app suggests tags, category, and tier → files it into the correct Drive folder (e.g., `Lennox Ford / NCAT Tuition & Payments`) → index record created → uploader is notified.
4. Parent rejects → uploader gets a note explaining why.
5. Photos also flow into Media and are candidates for the monthly newsletter.

---

## 10. Newsletter

- **Monthly AI draft** assembled on the 1st from last month's LifeEvents, approved uploads, new photos, and Ford Inc. wins (kid-safe level only).
- Sections: cover photo, letter from Mom & Dad, each member's highlights, celebrations, what's coming up, Ford Inc. 101 update, photo spread.
- Parent edits → approves → publishes on the site → emails the family. Archive is kept and saved to Drive.

---

## 11. AI Family Studio

| Feature | What it does |
|---------|--------------|
| Styled portraits | Holiday cards, themed portraits, polished headshots from prompts and reference photos |
| Milestone graphics | One-click graphics for graduations, birthdays, military milestones, anniversaries, property wins |
| Smart albums & captions | AI captions and groups Drive photos/videos by person, event, and year |
| Photo enhancement | Upscale/restore/re-style older photos (only where the image model supports image inputs; otherwise hide the option) |

Outputs save as StudioProject + MediaItem and can be sent to the newsletter.

---

## 12. Design system: navy & gold, "Command Center × Aurora Glass"

### Foundations
- **Base:** deep navy `#0A1224` with an aurora gradient (navy → indigo `#1B2A5A` → teal glow `#1F6F78`) and soft gold light leaks.
- **Surfaces:** frosted glass panels (`rgba(255,255,255,0.06)`, 20px backdrop blur, 1px `rgba(255,255,255,0.12)` border, 20–24px radius).
- **Accent:** gold `#D4AF37`; light gold `#F1D27A` for hovers and highlights. Ivory text `#F5F1E6`; muted `#9AA7BD`.
- **Status chips:** green `#34D399`, amber `#F5B544`, red `#F87171`, blue `#60A5FA`.
- **Type:** an elegant serif for greetings and section headlines (e.g., Fraunces / Cormorant), Inter for UI and data, tabular numbers for money.
- **Light mode:** ivory base with navy text and gold accents (optional toggle).

### Elements borrowed from each reference
| Reference | Feature carried into Ford Family HQ |
|-----------|-------------------------------------|
| Dark smart-home dashboard | Greeting + date/time header, weather chips, room-style tiles → **member tiles** and **property tiles** with stats and quick-action icons, media-player widget → **family reel / slideshow player**, camera tiles → **live photo tiles** from Drive |
| Aurora glass dashboard | Status pills across the top (e.g., "2 uploads awaiting review", "Lennox: finals week"), big clock, thermostat-style ring → **progress rings** (e.g., obligations paid this month), calendar widget with agenda, bottom quick bar (lights/climate → **quick actions: Upload, Studio, Newsletter, Sync**) |
| Metro magenta tiles | Dense metric tiles with sparklines and "More →" links (used for Ford Inc. metrics), left icon rail navigation, alert tiles |
| Luffu | Warm family-photo hero, floating avatar bubbles showing what's on each person's mind or open questions, "intelligent family care system" storytelling sections |
| Family accounts dashboard | Family avatar grid with lock icons for restricted access, horizontal progress bars (e.g., Journey progress, obligations status) |
| Classic family website | "Go directly to [person]'s gallery" cards |
| Family TreeX | Hero with search ("search family members, events, documents…"), four feature columns (Connect with members · Timeline · History · Photos) |

### Layout
- Desktop: left icon rail + top status-pill bar + modular tile grid.
- Mobile: bottom tab bar (Home, Family, Upload, Media, More), stacked glass cards, 16px gutters, no horizontal scroll.
- Command Center: full-screen, auto-rotating, large type, readable from across the room.

---

## 13. Data model changes (extend the existing 9 entities)

Existing: FamilyMember, Post, TrackerItem, LifeEvent, Document, MediaItem, Newsletter, StudioProject, NewsletterRelease.

| Change | Detail |
|--------|--------|
| Add to all content entities | `tier` (family / personal / parents / vault), `shared_with` (emails), `owner_member` |
| FamilyMember | `role` (parent / kid / extended), `has_login`, `email`, `journey_stage`, `school`, `college`, `career`, `drive_folder_url` |
| New `Property` | id, name, kid description, status, occupancy, manager, health, health note, Drive link, sheet row ref |
| New `PropertyObligation` | property, item name, category (mortgage, rent, tax, insurance, utility, renovation, repair, pending), status, due date, `amount` (**admin-only field**), `kid_visible_amount` (mortgage/rent only) |
| New `DriveIndexItem` | Drive file id, title, link, mime, path, category, owner, tier, modified, thumbnail, excluded flag |
| New `VaultItem` | Same shape as DriveIndexItem but for T3, readable only via PIN-checked backend function |
| New `UploadSubmission` | file, uploader, about member, proposed category/tier, status (pending / approved / rejected), reviewer, target Drive folder, filed Drive link |
| New `ProtectionCoverage` | member, type (health, dental, vision, life, AD&D, LegalShield, IDShield), plan name, what it covers (plain English), how to use, contacts, source doc link, `confirmed` flag |
| New `Reminder` | title, member, due date, source (calendar / tracker / obligation / coverage), notify emails, sent status |
| New `SyncRun` | source, started, finished, counts, errors |

---

## 14. Build phases

| Phase | Scope | Done when |
|-------|-------|-----------|
| 1. Foundation | Design system, navigation, four home modes, roles, tiers, RLS, PIN step-up, invite-only | Kids cannot read T2/T3 records through the API; parents unlock the Vault with a PIN |
| 2. Drive + Sheets | Connectors, smart index sync, folder map, exclusions, Ford Inc. parent and kid views | Index populated; Ford Inc. tiles match the Master sheet; kids see only mortgage/rent dollars |
| 3. Protection | Your Protection cards, "If something happens" guide, contacts, pending badges | Each kid sees health, life, LegalShield, IDShield coverage |
| 4. Life & Media | Journeys, timeline, uploads + review queue → Drive filing, gallery, albums | An approved upload lands in the right Drive folder |
| 5. Newsletter, Studio, Calendar | Monthly AI draft + approval + email, Studio features, Google Calendar sync, reminders, alerts | November issue drafted; reminders firing |
| 6. Launch | Data corrections, invites, Google 2-Step Verification check, publish | All five members signed in |

---

## 15. Pre-launch checklist

- [x] **Change the Ford Inc. Drive folder from "Anyone with the link" to "Restricted."** Done Nov 22, 2026; root folder and spot-checked files verified restricted.
- [x] Base44 app set to invite-only (`private_with_login`), Google sign-in only.
- [x] Builder pass 1 complete (Nov 22): design system, navigation, Ford Inc. parent/kid views, Protection cards, PIN vault, upload review queue, Admin, Calendar, new data models.
- [x] Seeded property records corrected to match the Master sheet Properties tab.
- [ ] Turn on Google 2-Step Verification for Orlando's and Timiesha's Google accounts.
- [ ] Provide Google emails for Orlando Jr., Lennox, and Paxton.
- [ ] Confirm the member focus corrections in §8.
- [ ] Confirm LegalShield / IDShield plan details and 2027 life-insurance renewal letters.
- [ ] Connect Drive, Sheets, and Calendar connectors in Base44.
- [ ] Set the parent PIN.
- [ ] Review the folder → tier map once after the first sync.

## 16. Open build items (next builder pass)

| Item | Status |
|------|--------|
| Home: Magazine cover and full-screen Command Center modes | Not built in pass 1 |
| Monthly AI newsletter draft job + email alerts | Deferred by builder |
| Studio smart albums & captions | Deferred by builder |
| Approved uploads filed into Drive (currently filed to the in-app library) | Needs Drive connector |
| `Reminder` records readable by every signed-in member | Move to `shared_with` RLS so parent-only deadlines stay private |
| `Post`, `Newsletter`, `StudioProject`, `NewsletterRelease` readable by every signed-in member | Acceptable now that the app is invite-only; revisit if extended family is added |
| Protection cards (12) | Placeholders until plan documents are in Drive |
