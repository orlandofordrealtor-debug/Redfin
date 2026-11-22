# Spotlight Studio — Operating Guide

Live Studio: https://claude.ai/artifact/RohobNocBS3diKtxLA3Bfe

Spotlight Studio turns a closing, listing or client win into a full social campaign:
15 distinct designs, each in four sizes (9:16 Story, 4:5 Feed, 1:1 Square, 1.91:1 LinkedIn),
branded Redfin | Rocket (or PREMIER By Redfin for Premier deals), with the agent's headshot,
stats, DRE number and QR code loaded automatically.

## The four-click flow

1. **Closing screenshot** (optional). Drop or paste the closed email. Claude reads agent, side,
   Premier flag, city, price and date. It never returns the street address.
2. **Property photo.** Up to 4. The first is the hero; tap it to set the focus point.
3. **Agent.** Managers pick anyone. Agents pick themselves once and are locked to their profile.
4. **Type.** Closed Buy Side, Closed Sell Side, Premier Buy Side, Premier Sell Side, or a listing
   milestone: Just Listed, Coming Soon, Open House, Under Contract, In Escrow, Price Improvement,
   Back on Market, 5-Star Review.

Then star favorites and **Save to Drive** (one campaign folder inside the agent's vault folder)
or **Download** (ZIP). **Write captions** produces Instagram, Facebook and LinkedIn copy plus
hashtags and alternate headlines.

## Files

| Path | What it is |
| --- | --- |
| `studio/index.html` | Page shell and styles (MOD Studio design system) |
| `studio/app.js` | App logic: capabilities, flow, gallery, exports, Drive, vault, roster, settings |
| `studio/engine.js` | Canvas graphics engine: 15 layouts × 4 formats, palettes, copy rules |
| `studio/logos.js` | Official vector logos (Redfin \| Rocket lockups, PREMIER By Redfin) as paths |
| `studio/brand/*.png` | Redfin Powered by Rocket UI logos (from the MOD Studio) |
| `scripts/refresh_stats.py` | Weekly stats refresh from public Redfin profiles |

To ship a change: edit the files, then republish `studio/index.html` to the same artifact URL
with the same `files` map (app.js, engine.js, logos.js, brand/*.png). Omit `capabilities` on a
republish to keep the stored declaration.

## Runtime capabilities

| Capability | Used for |
| --- | --- |
| `db` | Roster (`agents`), brand settings (`settings/brand`), agent self-claims (`claims/<user>`), delivered campaigns (`campaigns`) |
| `assets` | Headshots and optional QR images (managers and editors only) |
| `user` | Manager vs agent mode, claim ownership |
| `sample` | Screenshot reading, captions, stats from a profile screenshot (runs on each viewer's own Claude account) |
| `mcp` → Google Drive `create_file`, `share_file` | Campaign folders and file uploads; sharing an agent's vault folder |
| `downloads` | PNG/JPG files and ZIPs |

Access rules: `agents`, `settings`, `claims` are editable by owner/editors only;
`claims/{self}` lets each agent write their own claim; `campaigns` is writable at Contributor.
Share the Studio with agents at **Contributor** so they can save campaigns and keep vault history.

## Agent document (`agents/<slug>`)

```json
{
  "name": "Heidi Ludwig", "title": "Redfin Principal Agent", "city": "Manhattan Beach",
  "phone": "(310) 627-2071", "license": "01400091", "email": "",
  "profileUrl": "https://www.redfin.com/real-estate-agents/heidi-ludwig",
  "loyaltyUrl": "", "qrAssetId": "", "headshotAssetId": "<asset id>",
  "driveFolderId": "<Drive folder id>", "tagline": "", "active": true,
  "stats": { "deals": "487", "volume": "$525M", "highest": "$9.0M",
             "updatedAt": "…", "source": "redfin-profile|manual", "fetched": {…}, "fetchedAt": "…" }
}
```

QR priority: uploaded QR image → loyalty link → Redfin profile link (fallback).

## Weekly stats refresh

A scheduled task runs every Monday at 5:17 AM Pacific in a fresh session:

1. `ArtifactData list` the `agents` collection with `out_dir` (note each document's `version`).
2. `python3 scripts/refresh_stats.py <out_dir>/agents <updates_dir>`
3. `ArtifactData batch` an `update` per file in `<updates_dir>` (skip `_summary.json`),
   pinned with `if_version`.
4. Report the summary (updated / unchanged / kept manual / skipped / failed).

Manual stat edits are kept until Redfin shows numbers that differ from the last fetch.

## Design system

- **Standard tier:** neutral luxury palettes (champagne ivory, marble, coastal sand, sage,
  parchment, bronze, espresso, noir, slate) plus three brand-forward ones (Redfin accent,
  Midnight tech, Redfin bold). Redfin red is reserved for the logo and those three.
- **Premier tier:** PREMIER By Redfin logotype; Mushroom `#463C33` and Putty `#F3EEE7`
  with champagne gold (Premier brand kit, 2026-09-08).
- **Type:** five script faces (Pinyon, Great Vibes, Italianno, Alex Brush, Monsieur La Doulaise),
  Playfair Display, Cormorant Garamond, Cinzel, Montserrat, Jost (Premier).
- **15 layouts:** Magazine Cover, Cinematic Split, Cathedral Arch, Certificate of Success,
  Full-Bleed Story, Polaroid Prestige, Power Pairing, Production Scoreboard, Tech Glass,
  Circle Spotlight, City Type Poster, Gallery Triptych, Capsule Minimal, Greetings Postcard,
  Gallery Plaque. "Shuffle" rotates palette, script and copy variant per design.

## Compliance built in

- City only; the street address never prints.
- Agent DRE number and Redfin's DRE (#01521930) print on every graphic via the fine-print line.
- Stats come only from the agent's public Redfin profile or a manager's manual entry.
- Captions are instructed to avoid fair-housing risk language and invented facts.
- Premier branding appears only on the two Premier types.

## Open items

- Link Redfin profiles for Aubrey Myers Jr., Michele Lopez and Wilson Ho (no public profile
  found under those names), and verify Adrienne Allen (the only match carried a non-California
  license, so it was not used).
- Add each agent's loyalty link (Roster → Edit) so QR codes point to it instead of the profile.
- Add agent emails and use **Give edit access** so agents can save into their own vault folders.
