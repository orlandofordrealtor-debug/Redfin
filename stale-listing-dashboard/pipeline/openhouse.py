#!/usr/bin/env python3
"""
Open house tracking: turn the trailing-six-month open house sheet (one row per
deal) plus, when available, an event-level export (one row per open house)
into dashboard database documents.

  python3 pipeline/openhouse.py --csv data/weekly/openhouse-2026-10-14.csv \
      --db data/db/2026-10-13 [--events data/weekly/openhouse-events-2026-10-14.csv] \
      [--versions data/db/versions.json] [--bump]

Writes, inside the listing week's db folder (so the open house week lines up
with the listing week):
  openhouses/<dealId>.json   one document per deal in the sheet
  ohweek.json                market rollup for the week (ohweeks/<asOf>)
  oh-manifest.json           documents + files
  batches/batch-oh00.json    ArtifactData batch (pinned with versions.json)

Per-deal fields: opens, normOpens, vsNorm (opens - norm; positive = above),
priceDropOpens, signIns, convertableSignIns, cost (sheet estimate), paidOpens
(cost / 165, the flat associate rate, rounded and capped at opens), unpaidOpens,
commission, spendPctCommission, listPrice, dealUrl, agent, agentRole, active
(deal id matches a listing in the week's snapshot), tier/dom when active,
events[] and hosts{} when the event export is given.

The sheet is grouped: Business Market, Deal Agent Role and Deal Agent Name are
only filled on the first row of each group, so they are forward-filled.
"""
import argparse, csv, glob, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ASSOCIATE_RATE = 165.0
NORM_OPENS = 4


def money(s):
    s = (s or "").strip().replace("$", "").replace(",", "")
    if not s:
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def num(s):
    s = (s or "").strip().replace(",", "")
    if not s:
        return 0
    try:
        return int(float(s))
    except ValueError:
        return 0


def norm_key(k):
    return re.sub(r"[^a-z0-9]", "", (k or "").lower())


def read_events(path):
    """Event-level export: flexible column names. Needs a deal id; uses date, host, host role, sign-ins when present."""
    if not path or not os.path.exists(path):
        return {}
    out = {}
    with open(path, newline="", encoding="utf-8-sig") as f:
        rd = csv.DictReader(f)
        cols = {norm_key(c): c for c in rd.fieldnames or []}

        def pick(*names):
            for n in names:
                if n in cols:
                    return cols[n]
            return None

        c_id = pick("dealid", "deal", "dealnumber")
        c_date = pick("date", "openhousedate", "eventdate", "start", "starttime")
        c_host = pick("host", "hostname", "hostedby", "agent", "hostagent", "openhousehost")
        c_role = pick("hostrole", "role", "hosttype", "hostagentrole")
        c_sign = pick("signins", "signin", "visitors", "attendees")
        c_cost = pick("cost", "estimatedcost", "estimatedohcost", "ohcost")
        if not c_id:
            return {}
        for r in rd:
            did = (r.get(c_id) or "").strip()
            if not did:
                continue
            role_raw = (r.get(c_role) or "").strip().lower() if c_role else ""
            role = "associate" if "assoc" in role_raw else "listingAgent" if ("listing" in role_raw or role_raw in ("agent", "la")) else "teamAgent" if role_raw else "unknown"
            ev = {"date": (r.get(c_date) or "").strip() if c_date else "", "host": (r.get(c_host) or "").strip() if c_host else "",
                  "role": role, "signIns": num(r.get(c_sign)) if c_sign else None}
            if c_cost:
                ev["cost"] = money(r.get(c_cost))
            out.setdefault(did, []).append(ev)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True, help="per-deal open house sheet (trailing six months)")
    ap.add_argument("--db", required=True, help="the listing week's data/db/<date> folder")
    ap.add_argument("--events", default=None, help="optional event-level export")
    ap.add_argument("--sheet-date", default=None, help="date the sheet was pulled (defaults to the date in the csv filename)")
    ap.add_argument("--versions", default=os.path.join(ROOT, "data", "db", "versions.json"))
    ap.add_argument("--bump", action="store_true", help="after a successful push: record the new versions")
    a = ap.parse_args()

    meta = json.load(open(os.path.join(a.db, "meta.json")))
    asof = meta["asOf"]
    m = re.search(r"(\d{4}-\d{2}-\d{2})", os.path.basename(a.csv))
    sheet_date = a.sheet_date or (m.group(1) if m else asof)
    listings = {}
    for f in os.listdir(os.path.join(a.db, "listings")):
        d = json.load(open(os.path.join(a.db, "listings", f)))
        listings[str(d["dealId"])] = d
    events = read_events(a.events)

    rows = []
    with open(a.csv, newline="", encoding="utf-8-sig") as f:
        rd = csv.DictReader(f)
        cols = {norm_key(c): c for c in rd.fieldnames or []}
        g = lambda r, k: (r.get(cols.get(k, ""), "") or "").strip()
        market = role = agent = ""
        for r in rd:
            if g(r, "businessmarket"): market = g(r, "businessmarket")
            if g(r, "dealagentrole"): role = g(r, "dealagentrole")
            if g(r, "dealagentname"): agent = g(r, "dealagentname")
            did = g(r, "dealid")
            if not did:
                continue
            opens = num(g(r, "openhouses"))
            norm = num(g(r, "normopens")) or NORM_OPENS
            cost = money(g(r, "estimatedohcosts"))
            comm = money(g(r, "redfincommission"))
            paid = min(opens, int(round(cost / ASSOCIATE_RATE))) if cost else 0
            rows.append({
                "dealId": did, "asOf": asof, "sheetDate": sheet_date, "market": market, "agent": agent, "agentRole": role,
                "address": g(r, "address"), "dealUrl": g(r, "dealurl") or f"https://www.redfin.com/tools/deals/sell/{did}",
                "listPrice": money(g(r, "listingprice")) or None, "commission": comm or None,
                "opens": opens, "normOpens": norm, "vsNorm": opens - norm, "priceDropOpens": num(g(r, "pricedropopenhouses")),
                "signIns": num(g(r, "signins")), "convertableSignIns": num(g(r, "convertablesignins")),
                "cost": cost, "paidOpens": paid, "unpaidOpens": max(0, opens - paid), "costPerOpen": round(cost / opens, 2) if opens else None,
                "spendPctCommission": round(cost / comm * 100, 1) if comm else None,
                "paidOpensEstimated": True, "associateRate": ASSOCIATE_RATE,
            })
    # duplicates (a deal listed more than once in the sheet)
    seen = {}
    for r in rows:
        seen.setdefault(r["dealId"], []).append(r)
    docs = []
    for did, group in seen.items():
        d = dict(group[0])
        if len(group) > 1:
            d["duplicateRows"] = len(group)
            for k in ("opens", "priceDropOpens", "signIns", "convertableSignIns", "cost", "paidOpens", "unpaidOpens"):
                d[k] = sum(x[k] for x in group)
            d["vsNorm"] = d["opens"] - d["normOpens"]
            d["spendPctCommission"] = round(d["cost"] / d["commission"] * 100, 1) if d.get("commission") else None
        L = listings.get(did)
        d["active"] = bool(L)
        if L:
            d["tier"] = L.get("tier"); d["dom"] = L.get("dom"); d["city"] = L.get("city"); d["currentPrice"] = L.get("currentPrice")
            d["listingAgent"] = L.get("agent")
            if not d["address"]:
                d["address"] = f'{L.get("address","")}, {L.get("city","")}'.strip(", ")
        ev = events.get(did)
        if ev:
            d["events"] = ev
            hosts = {"listingAgent": 0, "teamAgent": 0, "associate": 0, "unknown": 0}
            names = {}
            for e in ev:
                hosts[e["role"]] = hosts.get(e["role"], 0) + 1
                if e.get("host"):
                    names[e["host"]] = names.get(e["host"], 0) + 1
            d["hosts"] = hosts
            d["hostNames"] = names
            if hosts["associate"]:
                d["paidOpens"] = hosts["associate"]; d["unpaidOpens"] = max(0, d["opens"] - hosts["associate"]); d["paidOpensEstimated"] = False
        docs.append(d)

    # write documents
    out_dir = os.path.join(a.db, "openhouses")
    if os.path.isdir(out_dir):
        for f in glob.glob(os.path.join(out_dir, "*.json")):
            os.remove(f)
    os.makedirs(out_dir, exist_ok=True)
    manifest = []
    for d in docs:
        json.dump(d, open(os.path.join(out_dir, f'{d["dealId"]}.json'), "w"))
        manifest.append({"collection": "openhouses", "doc_id": d["dealId"], "file": f'openhouses/{d["dealId"]}.json'})

    # market rollup for the week
    act = [d for d in docs if d["active"]]
    by_tier = {}
    for d in docs:
        t = d.get("tier") if d["active"] else "inactive"
        b = by_tier.setdefault(t, {"deals": 0, "opens": 0, "paidOpens": 0, "cost": 0.0, "commission": 0.0})
        b["deals"] += 1; b["opens"] += d["opens"]; b["paidOpens"] += d["paidOpens"]; b["cost"] += d["cost"]; b["commission"] += d.get("commission") or 0
    stale60_no_record = [L["dealId"] for L in listings.values() if (L.get("dom") or 0) >= 60 and str(L["dealId"]) not in seen]
    week = {
        "asOf": asof, "sheetDate": sheet_date, "deals": len(docs), "activeDeals": len(act), "activeListings": len(listings),
        "opens": sum(d["opens"] for d in docs), "paidOpens": sum(d["paidOpens"] for d in docs), "unpaidOpens": sum(d["unpaidOpens"] for d in docs),
        "cost": round(sum(d["cost"] for d in docs), 2), "commission": round(sum(d.get("commission") or 0 for d in docs), 2),
        "activeOpens": sum(d["opens"] for d in act), "activePaidOpens": sum(d["paidOpens"] for d in act), "activeCost": round(sum(d["cost"] for d in act), 2),
        "activeCommission": round(sum(d.get("commission") or 0 for d in act), 2),
        "spendPerActiveListing": round(sum(d["cost"] for d in act) / max(len(listings), 1), 2),
        "spendPerActiveDeal": round(sum(d["cost"] for d in act) / max(len(act), 1), 2),
        "avgOpens": round(sum(d["opens"] for d in docs) / max(len(docs), 1), 1),
        "aboveNorm": sum(1 for d in docs if d["vsNorm"] > 0), "priceDropOpens": sum(d["priceDropOpens"] for d in docs),
        "highSpend10": sum(1 for d in docs if (d.get("spendPctCommission") or 0) >= 10),
        "associateOnly": sum(1 for d in docs if d["opens"] >= 3 and d["paidOpens"] >= d["opens"]),
        "stale60NoRecord": len(stale60_no_record), "stale60NoRecordIds": stale60_no_record,
        "duplicates": sum(1 for d in docs if d.get("duplicateRows")),
        "byTier": by_tier, "eventsLoaded": bool(events), "associateRate": ASSOCIATE_RATE, "normOpens": NORM_OPENS,
    }
    json.dump(week, open(os.path.join(a.db, "ohweek.json"), "w"), indent=1)
    manifest.append({"collection": "ohweeks", "doc_id": asof, "file": "ohweek.json"})
    json.dump(manifest, open(os.path.join(a.db, "oh-manifest.json"), "w"), indent=1)

    # batches (size-aware, pinned)
    vers = json.load(open(a.versions)) if os.path.exists(a.versions) else {}
    batches, cur, cur_bytes = [], [], 0
    for m_ in manifest:
        b = os.path.getsize(os.path.join(a.db, m_["file"]))
        if cur and (cur_bytes + b > 980_000 or len(cur) >= 50):
            batches.append(cur); cur, cur_bytes = [], 0
        w = {"op": "set", "collection": m_["collection"], "doc_id": m_["doc_id"], "file_path": os.path.join(a.db, m_["file"])}
        key = f'{w["collection"]}/{w["doc_id"]}'
        if key in vers:
            w["if_version"] = vers[key]
        if a.bump:
            vers[key] = vers.get(key, 0) + 1
        cur.append(w); cur_bytes += b
    if cur:
        batches.append(cur)
    bdir = os.path.join(a.db, "batches"); os.makedirs(bdir, exist_ok=True)
    for f in glob.glob(os.path.join(bdir, "batch-oh*.json")):
        os.remove(f)
    for i, b in enumerate(batches):
        json.dump(b, open(os.path.join(bdir, f"batch-oh{i:02d}.json"), "w"), separators=(",", ":"))
    if a.bump:
        json.dump(vers, open(a.versions, "w"), indent=0, sort_keys=True)
    print(f"{len(docs)} open house deals ({len(act)} active, {week['opens']} opens, ${week['cost']:,.0f} est. spend, {week['paidOpens']} paid opens); "
          f"{len(stale60_no_record)} active 60+ listings with no record; events loaded: {bool(events)}; {len(batches)} batch file(s) in {bdir}{' (versions bumped)' if a.bump else ''}")


if __name__ == "__main__":
    main()
