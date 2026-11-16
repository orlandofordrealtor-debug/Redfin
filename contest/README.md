# Finish Strong. Start Strong. · Q4 2026 contest leaderboard

Weekly animated leaderboard for the Redfin powered by Rocket LA offer-writing and Rocket referral contest
(Oct 26 – Dec 13, 2026).

| Output | Where | Use |
|---|---|---|
| Team leaderboard (animated, one link all season) | `site/leaderboard.html` → https://claude.ai/artifact/EJ2dTLhzhqUAjHWts7FR8Z | Share link in Slack; `#present` opens 16:9 slides, `#card` shows the compact card |
| Slack card PNG | `exports/week-NN/week-NN-slack-card.png` | Drop straight into Slack |
| Full board PNG | `exports/week-NN/week-NN-full-board.png` | Archive / email |
| 16:9 slides | `exports/week-NN/slides-16x9/` | Team meeting backup |
| 20-second reel | `exports/week-NN/week-NN-reel.mp4` | Slack, group text |
| Podium infographics (team agenda) | `exports/week-NN/podium/week-NN-podium-{1-gold-standard,2-cover-story,3-liftoff}.png` | 9:16 story of each podium place: #1 Gold Standard, #2 Cover Story, #3 Liftoff. Render with `node contest/scripts/podium.js NN <fonts.css>` |
| Collector Cards (top 3 offer writers) | `exports/week-NN/cards/week-NN-card-{1,2,3}.{png,jpg,mp4}` | 9:16 cards: PNG for Slack, 7-sec MP4 for stories; JPG + MP4 also play on the board |
| Manager page | `--private-out` folder only (never committed) | Rocket intro gaps, offer verification, Ava watch, Slack post |
| Weekly intake form | `site/intake.html` → https://claude.ai/artifact/7boFUiHD85NyH8bcRZFdX8 | Paste the 3 export links + notes each Sunday; saved to the form's database (`intake/week-NN`) |

## Contest rules as scored

- **Weeks run Sunday–Saturday.** Week 1 = Oct 26–31 (contest start), Week 7 = Dec 6–13 (contest end).
- **Weekly offers** by "Submitted to Listing Agent" date: 2 = 500 · 3 = 1,000 · 4+ = 1,500 Amaze points. Repeat offers for the same buyer each count.
- **Rocket 100%:** every new customer created that week has a Rocket referral type (minimum 1 new customer) = 1,000 points.
- **Grand prize:** 10+ submitted offers Oct 26 – Dec 13 = entry in the 10,000-point drawing. Counted from the latest export, so late-logged offers still count.
- **Locking:** a week's points lock the first time it's built. Re-runs only rebuild the week you pass.
- **Ava:** usage export for the last 30 days vs the prior 30 days. Badges: Ava Champion (usage score), Biggest Jump (prompt increase), Outreach Pro (outreach drafts), Research Pro (customers researched). The sales manager is excluded from rankings.

## Weekly run (every Sunday)

0. Orlando saves the week in the intake form, then sends Claude the hand-off message. Claude reads
   `intake/week-NN` from the form's database (Artifact database tool, `collection: "intake"`), downloads the three
   linked sheets as CSV through the Google Drive connector, and applies the notes (roster changes, corrections,
   shout-outs) before building. After publishing, Claude updates that record: `status: "published"` and
   `published: {at, summary}`, which shows the week as Published in the form's season log.
1. Export the three sheets as CSV (Offers detail, Referral rate T45, Ava usage T30D). Keep them outside the repo, or in `contest/raw/` (git-ignored).
2. Build data and pages:
   ```bash
   python3 contest/scripts/build_data.py --week 3 --export-date 2026-11-15 \
     --offers <offers.csv> --referral <referral.csv> --ava <ava.csv> \
     --private-out contest/private --board-url https://claude.ai/artifact/EJ2dTLhzhqUAjHWts7FR8Z
   ```
3. Render exports (fonts are fetched once and inlined so renders don't depend on the network):
   ```bash
   python3 contest/scripts/prepare_fonts.py contest/private/fonts.css
   node contest/scripts/render.js 3 contest/private/fonts.css
   ```
4. Republish `site/leaderboard.html` to the same artifact link with this week's cards attached
   (`files`: `cards/week-NN-card-{1,2,3}.jpg` and `.mp4` from `exports/week-NN/cards/`; capabilities `downloads`),
   and `contest/private/manager.html` to the private manager link (honoree DMs and captions are on it).
5. Commit `data/season.json`, `site/`, and `exports/week-NN/`.

## Collector Cards

Every week the top three offer writers get a 9:16 Collector Card (`templates/card.html`), using the board's podium order:
offers, then points that week, then offers at mutual. #1 is the gold edition, #2 silver, #3 bronze; everyone tied with
the #3 agent shares one group card. Card numbers count up all season (Week 3 = No. 01-03, Week 4 = No. 04-06).
Each card shows offers, volume, Fast Offers, Ava score and Rocket intros, plus a shout-out written from the stats.
Initials monograms stand in for photos. The other four explored directions (Liftoff, Cover Story, Jumbotron,
Gold Standard) are saved in `concepts/` as designs for on-demand use.
