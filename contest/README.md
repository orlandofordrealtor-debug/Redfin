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
| Manager page | `--private-out` folder only (never committed) | Rocket intro gaps, offer verification, Ava watch, Slack post |

## Contest rules as scored

- **Weeks run Sunday–Saturday.** Week 1 = Oct 26–31 (contest start), Week 7 = Dec 6–13 (contest end).
- **Weekly offers** by "Submitted to Listing Agent" date: 2 = 500 · 3 = 1,000 · 4+ = 1,500 Amaze points. Repeat offers for the same buyer each count.
- **Rocket 100%:** every new customer created that week has a Rocket referral type (minimum 1 new customer) = 1,000 points.
- **Grand prize:** 10+ submitted offers Oct 26 – Dec 13 = entry in the 10,000-point drawing. Counted from the latest export, so late-logged offers still count.
- **Locking:** a week's points lock the first time it's built. Re-runs only rebuild the week you pass.
- **Ava:** usage export for the last 30 days vs the prior 30 days. Badges: Ava Champion (usage score), Biggest Jump (prompt increase), Outreach Pro (outreach drafts), Research Pro (customers researched). The sales manager is excluded from rankings.

## Weekly run (every Sunday)

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
4. Republish `site/leaderboard.html` to the same artifact link, and `contest/private/manager.html` to the private manager link.
5. Commit `data/season.json`, `site/`, and `exports/week-NN/`.
