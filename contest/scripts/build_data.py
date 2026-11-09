#!/usr/bin/env python3
"""Finish Strong / Start Strong contest: weekly data builder.

Turns the three weekly exports into agent-level contest data, then renders the
team leaderboard, the animated reel and the manager-only page from templates.

    python3 contest/scripts/build_data.py --week 2 \
        --offers  <offers.csv>   (Offers detail export, any trailing window)
        --referral <referral.csv> (Rocket referral rate T45 export)
        --ava <ava.csv>           (Ava usage T30D export)
        --private-out <dir>       (where the manager page goes; keep it out of git)

Rules encoded here (from the contest outline and the Nov 9 decisions):
  * Weeks run Sunday-Saturday. Week 1 is clipped to the contest start (Mon Oct 26)
    and Week 7 is extended to the contest end (Sun Dec 13).
  * An offer counts in the week of its "Submitted to Listing Agent Date".
    Every submitted offer counts, including repeat offers for the same buyer.
  * Weekly offer tiers: 2 offers = 500, 3 = 1,000, 4+ = 1,500 Amaze points.
  * 100% Rocket intro: every new customer created that week has a referral type,
    with at least 1 new customer = 1,000 Amaze points.
  * Grand prize: 10+ offers between Oct 26 and Dec 13 = entry in a 10,000 pt drawing.
    Counted from the latest export, so offers logged late still count.
  * Weekly points lock once a week is in season.json; re-runs only rebuild the
    week passed in --week.

The public season.json and leaderboard carry agent-level numbers only.
Client names and customer links go to the manager page in --private-out.
"""
import argparse
import csv
import datetime as dt
import json
import math
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

CONTEST_START = dt.date(2026, 10, 26)
CONTEST_END = dt.date(2026, 12, 13)
EXCLUDE = {"Orlando Jimenez-Ford"}  # sales manager, not a contestant
OFFER_TIERS = [(4, 1500), (3, 1000), (2, 500)]
REFERRAL_AWARD = 1000
GRAND_PRIZE_OFFERS = 10
GRAND_PRIZE_POINTS = 10000
REFERRAL_GOAL = 0.45
TEAM_SHORT = {
    "South Los Angeles": "South LA",
    "South Bay Los Angeles": "South Bay",
    "West Los Angeles": "West LA",
    "Southeast Los Angeles": "Southeast LA",
    "Long Beach": "Long Beach",
}


def contest_weeks():
    """Sunday-Saturday weeks, clipped to the contest window."""
    weeks, n = [], 1
    # Sunday on or before the contest start
    sunday = CONTEST_START - dt.timedelta(days=(CONTEST_START.weekday() + 1) % 7)
    while sunday <= CONTEST_END:
        start = max(sunday, CONTEST_START)
        end = sunday + dt.timedelta(days=6)
        if end + dt.timedelta(days=1) == CONTEST_END:  # fold the final Sunday into the last week
            end = CONTEST_END
        end = min(end, CONTEST_END)
        weeks.append({"n": n, "start": start.isoformat(), "end": end.isoformat()})
        n += 1
        sunday = end + dt.timedelta(days=1)
        sunday -= dt.timedelta(days=(sunday.weekday() + 1) % 7)
        if sunday <= dt.date.fromisoformat(weeks[-1]["end"]):
            sunday += dt.timedelta(days=7)
    return weeks


WEEKS = contest_weeks()


def week_of(day):
    for w in WEEKS:
        if dt.date.fromisoformat(w["start"]) <= day <= dt.date.fromisoformat(w["end"]):
            return w["n"]
    return None


def parse_date(s):
    s = (s or "").strip()
    if not s:
        return None
    m, d, y = s.split("/")
    y = int(y)
    return dt.date(y + 2000 if y < 100 else y, int(m), int(d))


def money(s):
    s = re.sub(r"[^0-9.]", "", s or "")
    return int(float(s)) if s else 0


def initials(name):
    parts = [p for p in re.split(r"\s+", name) if p and p.lower() not in {"jr", "jr.", "sr", "ii", "iii"}]
    return (parts[0][0] + (parts[-1][0] if len(parts) > 1 else "")).upper()


def first_name(name, roster):
    first = name.split()[0]
    clash = [r for r in roster if r.split()[0] == first and r != name]
    return f"{first} {name.split()[-1][0]}." if clash else first


# ---------------------------------------------------------------- readers
def read_ava(path):
    rows = {}
    with open(path, newline="", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            name = r["Agent"].strip()
            if not name or name in EXCLUDE:
                continue
            num = lambda k: int(float(r.get(k) or 0))
            rows[name] = {
                "team": r["Team"].strip(),
                "action": r["Manager action"].strip(),
                "prompts": num("Prompts"),
                "prior": num("Prior prompts"),
                "sessions": num("Ava sessions"),
                "prior_sessions": num("Prior Ava sessions"),
                "days": num("Active days"),
                "prior_days": num("Prior active days"),
                "score": num("Usage score"),
                "last_active": (r.get("Last active") or "")[:10],
                "customers": num("Customers researched"),
                "outreach": num("Outreach drafted"),
                "properties": num("Properties researched"),
            }
    return rows


def read_offers(path):
    """Offer rows with merged-cell gaps filled from the row above."""
    out, prev, agent = [], None, None
    fill_cols = ["Submitted to Listing Agent Date", "Cancelled Date", "Offer Submitted to Listing Agent?",
                 "Offer Reached Mutual?", "Offer Closed?", "Used Fast Offer?", "Deal Status", "Client Name"]
    with open(path, newline="", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            if (r.get("Agent") or "").strip().lower().startswith("grand total"):
                continue
            if (r.get("Agent") or "").strip():
                agent, prev = r["Agent"].strip(), None
            if not (r.get("Deal Link") or "").strip():
                continue
            if prev and not (r.get("Submitted to Listing Agent Date") or "").strip():
                for c in fill_cols:  # merged block: inherit what the export left blank
                    if not (r.get(c) or "").strip():
                        r[c] = prev[c]
            r["Agent"] = agent
            prev = r
            out.append({
                "agent": agent,
                "date": parse_date(r["Submitted to Listing Agent Date"]),
                "cancelled": parse_date(r["Cancelled Date"]),
                "submitted": (r["Offer Submitted to Listing Agent?"] or "").strip().lower() == "yes",
                "mutual": (r["Offer Reached Mutual?"] or "").strip().lower() == "yes",
                "closed": (r["Offer Closed?"] or "").strip().lower() == "yes",
                "fast": (r["Used Fast Offer?"] or "").strip().lower() == "yes",
                "status": (r["Deal Status"] or "").strip(),
                "client": (r["Client Name"] or "").strip(),
                "link": r["Deal Link"].strip(),
                "price": money(r["Offer Price"]),
            })
    return out


def read_referrals(path):
    out, agent = [], None
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = next(reader)
        idx = {h: i for i, h in enumerate(header)}
        for r in reader:
            cell = lambda k: (r[idx[k]] if idx.get(k) is not None and idx[k] < len(r) else "").strip()
            if cell("Agent"):
                agent = cell("Agent")
            if not cell("Customer Name"):
                continue
            out.append({
                "agent": agent,
                "customer": cell("Customer Name"),
                "date": parse_date(cell("Customer Date")),
                "type": cell("Referral Type"),
                "url": cell("CUSTOMER_URL"),
            })
    return out


# ---------------------------------------------------------------- scoring
def offer_points(n):
    for need, pts in OFFER_TIERS:
        if n >= need:
            return pts
    return 0


def score_week(n, roster, offers, referrals):
    wk = next(w for w in WEEKS if w["n"] == n)
    agents = {}
    for name in roster:
        mine = [o for o in offers if o["agent"] == name and o["submitted"] and o["date"] and week_of(o["date"]) == n]
        refs = [r for r in referrals if r["agent"] == name and r["date"] and week_of(r["date"]) == n]
        done = sum(1 for r in refs if r["type"])
        pts_off = offer_points(len(mine))
        pts_ref = REFERRAL_AWARD if refs and done == len(refs) else 0
        agents[name] = {
            "offers": len(mine),
            "volume": sum(o["price"] for o in mine),
            "mutual": sum(o["mutual"] for o in mine),
            "fast": sum(o["fast"] for o in mine),
            "ref_new": len(refs),
            "ref_done": done,
            "pts_offers": pts_off,
            "pts_ref": pts_ref,
            "pts": pts_off + pts_ref,
        }
    tot = lambda k: sum(a[k] for a in agents.values())
    return {
        "n": n, "start": wk["start"], "end": wk["end"],
        "agents": agents,
        "totals": {
            "offers": tot("offers"), "volume": tot("volume"), "mutual": tot("mutual"), "fast": tot("fast"),
            "writers": sum(1 for a in agents.values() if a["offers"]),
            "ref_new": tot("ref_new"), "ref_done": tot("ref_done"),
            "club": sum(1 for a in agents.values() if a["pts_ref"]),
            "pts": tot("pts"),
        },
    }


def ava_snapshot(ava):
    # The manager-action label stays off the public board; it only appears on the manager page.
    snap = {name: {k: x for k, x in dict(v, delta=v["prompts"] - v["prior"]).items() if k != "action"}
            for name, v in ava.items()}
    pick = lambda key: max(snap, key=lambda a: (snap[a][key], snap[a]["score"]))
    badges = {
        "champion": {"agent": pick("score"), "label": "Ava Champion", "value": snap[pick("score")]["score"], "unit": "usage score"},
        "jump": {"agent": pick("delta"), "label": "Biggest Jump", "value": snap[pick("delta")]["delta"], "unit": "more prompts",
                 "from": snap[pick("delta")]["prior"], "to": snap[pick("delta")]["prompts"]},
        "outreach": {"agent": pick("outreach"), "label": "Outreach Pro", "value": snap[pick("outreach")]["outreach"], "unit": "outreach drafts"},
        "research": {"agent": pick("customers"), "label": "Research Pro", "value": snap[pick("customers")]["customers"], "unit": "customers researched"},
    }
    return {
        "agents": snap,
        "badges": badges,
        "totals": {
            "prompts": sum(v["prompts"] for v in snap.values()),
            "prior": sum(v["prior"] for v in snap.values()),
            "active": sum(1 for v in snap.values() if v["prompts"] > 0),
            "roster": len(snap),
            "median_score": sorted(v["score"] for v in snap.values())[len(snap) // 2],
        },
    }


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--week", type=int, required=True)
    ap.add_argument("--offers", required=True)
    ap.add_argument("--referral", required=True)
    ap.add_argument("--ava", required=True)
    ap.add_argument("--export-date", required=True, help="date the exports were pulled, YYYY-MM-DD")
    ap.add_argument("--private-out", required=True)
    ap.add_argument("--season", default=str(ROOT / "data" / "season.json"))
    ap.add_argument("--board-url", default="", help="published team board link, used in the Slack post")
    args = ap.parse_args()

    ava = read_ava(args.ava)
    roster = sorted(ava)
    offers = read_offers(args.offers)
    referrals = read_referrals(args.referral)

    unknown = {o["agent"] for o in offers} | {r["agent"] for r in referrals}
    unknown -= set(roster) | EXCLUDE
    if unknown:
        print("WARNING: agents in exports but not in the Ava roster (ignored):", sorted(unknown), file=sys.stderr)

    season_path = Path(args.season)
    season = json.loads(season_path.read_text()) if season_path.exists() else {"weeks": {}}

    # Lock earlier weeks the first time they're seen; always rebuild the current week.
    for w in WEEKS:
        n = w["n"]
        if n > args.week:
            break
        if n < args.week and str(n) in season["weeks"]:
            continue
        week = score_week(n, roster, offers, referrals)
        week["published"] = n == args.week or season["weeks"].get(str(n), {}).get("published", False)
        week["locked"] = args.export_date
        # Road to 10: contest offers through the end of this week, from the latest export.
        week["road"] = {
            name: sum(1 for o in offers if o["agent"] == name and o["submitted"] and o["date"]
                      and CONTEST_START <= o["date"] <= dt.date.fromisoformat(week["end"]))
            for name in roster
        }
        if n == args.week:
            week["ava"] = ava_snapshot(ava)
        else:
            week["ava"] = season["weeks"].get(str(n), {}).get("ava")
        season["weeks"][str(n)] = week

    # Grand prize count from the latest export (late-logged offers still count).
    in_contest = [o for o in offers if o["submitted"] and o["date"] and CONTEST_START <= o["date"] <= CONTEST_END]
    t45_total = len(referrals)
    t45_done = sum(1 for r in referrals if r["type"])

    agents_meta = {}
    for name in roster:
        agents_meta[name] = {
            "name": name,
            "first": first_name(name, roster),
            "initials": initials(name),
            "team": TEAM_SHORT.get(ava[name]["team"], ava[name]["team"]),
            "contest_offers": season["weeks"][str(args.week)]["road"][name],
        }

    season.update({
        "contest": {
            "name": "Finish Strong. Start Strong.",
            "start": CONTEST_START.isoformat(), "end": CONTEST_END.isoformat(),
            "tiers": [{"offers": n, "points": p} for n, p in sorted(OFFER_TIERS)],
            "referral_award": REFERRAL_AWARD,
            "grand_prize": {"offers": GRAND_PRIZE_OFFERS, "points": GRAND_PRIZE_POINTS},
            "referral_goal": REFERRAL_GOAL,
        },
        "calendar": WEEKS,
        "current_week": args.week,
        "export_date": args.export_date,
        "agents": agents_meta,
        "t45_referral": {"done": t45_done, "total": t45_total},
        "board_url": args.board_url or season.get("board_url", ""),
    })
    season_path.parent.mkdir(parents=True, exist_ok=True)
    season_path.write_text(json.dumps(season, indent=1, default=str))

    # ------------------------------------------------ manager-only data
    ref_by_client = defaultdict(list)
    for r in referrals:
        ref_by_client[r["customer"].lower()].append(r)
    mgr_offers = []
    for o in sorted(in_contest, key=lambda o: (o["date"], o["agent"])):
        if week_of(o["date"]) > args.week:
            continue
        hits = ref_by_client.get(o["client"].lower(), [])
        if not hits:
            rocket = "unverified"
        elif any(h["type"] for h in hits):
            rocket = "referred: " + next(h["type"] for h in hits if h["type"])
        else:
            rocket = "not referred"
        mgr_offers.append({
            "week": week_of(o["date"]), "date": o["date"].isoformat(), "agent": o["agent"], "client": o["client"],
            "price": o["price"], "status": o["status"], "fast": o["fast"], "mutual": o["mutual"],
            "link": o["link"], "rocket": rocket,
        })
    cur = season["weeks"][str(args.week)]
    missed = [
        {"agent": r["agent"], "customer": r["customer"], "date": r["date"].isoformat(), "url": r["url"]}
        for r in referrals
        if r["date"] and week_of(r["date"]) == args.week and not r["type"] and r["agent"] in ava
    ]
    manager = {
        "week": args.week, "export_date": args.export_date,
        "start": cur["start"], "end": cur["end"],
        "offers": mgr_offers,
        "missed_intros": sorted(missed, key=lambda m: (m["agent"], m["date"])),
        "ava_watch": sorted(
            [{"agent": a, **{k: v[k] for k in ("prompts", "prior", "score", "days", "last_active", "action")}}
             for a, v in ava.items() if v["prompts"] == 0 or v["prompts"] < v["prior"]],
            key=lambda x: x["prompts"] - x["prior"]),
        "launch_pad": sorted(a for a in roster if agents_meta[a]["contest_offers"] == 0),
    }

    # ------------------------------------------------ render templates
    public_json = json.dumps(season, separators=(",", ":"), default=str).replace("</", "<\\/")
    site = ROOT / "site"
    site.mkdir(exist_ok=True)
    for tpl, out in [("leaderboard.html", site / "leaderboard.html"), ("reel.html", site / "reel.html")]:
        src = (ROOT / "templates" / tpl)
        if src.exists():
            out.write_text(src.read_text().replace("__SEASON_DATA__", public_json))
    priv = Path(args.private_out)
    priv.mkdir(parents=True, exist_ok=True)
    (priv / f"manager-week-{args.week:02d}.json").write_text(json.dumps(manager, indent=1))
    mtpl = ROOT / "templates" / "manager.html"
    if mtpl.exists():
        mgr_json = json.dumps({"manager": manager, "season": season}, separators=(",", ":"), default=str).replace("</", "<\\/")
        (priv / "manager.html").write_text(mtpl.read_text().replace("__MANAGER_DATA__", mgr_json))

    # ------------------------------------------------ console summary
    t = cur["totals"]
    print(f"Week {args.week} ({cur['start']} to {cur['end']}): {t['offers']} offers by {t['writers']} agents, "
          f"${t['volume']:,} volume, {t['ref_done']}/{t['ref_new']} new customers introduced, "
          f"{t['club']} at 100%, {t['pts']:,} pts awarded")
    for name, a in sorted(cur["agents"].items(), key=lambda kv: -kv[1]["pts"]):
        if a["pts"] or a["offers"]:
            print(f"  {name:22} offers {a['offers']}  rocket {a['ref_done']}/{a['ref_new']}  pts {a['pts']}")
    for n, w in sorted(season["weeks"].items(), key=lambda kv: int(kv[0])):
        print(f"  ledger W{n} {w['start']}..{w['end']} published={w['published']} pts={w['totals']['pts']:,} offers={w['totals']['offers']}")
    print(f"Grand prize leaders:", sorted(((m['contest_offers'], a) for a, m in agents_meta.items()), reverse=True)[:5])


if __name__ == "__main__":
    main()
