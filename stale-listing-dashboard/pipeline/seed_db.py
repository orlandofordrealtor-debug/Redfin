#!/usr/bin/env python3
"""
Turn a weekly snapshot into dashboard database documents.

  python3 seed_db.py --snapshot data/snapshots/2026-10-07.json [--prev data/snapshots/2026-09-30.json]

Writes data/db/<date>/listings/<dealId>.json, photos/<dealId>.json, meta.json,
playbook.json, market.json and a manifest.json that lists every document with
its collection and id. The manifest is what gets pushed to the artifact's
database (ArtifactData batch, 50 writes per call).

Week-over-week history: each listing document carries history[] with one entry
per snapshot it appeared in. The previous snapshot's history (or an existing
db export) is merged in when --prev is given.
"""
import argparse, json, os, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def tier_counts(recs):
    c = {"watch": 0, "stale": 0, "ultra": 0, "extreme": 0, "unknown": 0}
    for r in recs:
        c[r.get("tier", "unknown")] = c.get(r.get("tier", "unknown"), 0) + 1
    return c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--snapshot", required=True)
    ap.add_argument("--prev", default=None, help="previous snapshot json (for history + change detection)")
    ap.add_argument("--prev-db", default=None, help="previous data/db/<date> folder (preferred: carries full history)")
    a = ap.parse_args()
    snap = json.load(open(a.snapshot))
    asof = snap["asOf"]
    recs = snap["records"]
    prev = {}
    prev_meta = None
    if a.prev_db and os.path.isdir(a.prev_db):
        for f in os.listdir(os.path.join(a.prev_db, "listings")):
            d = json.load(open(os.path.join(a.prev_db, "listings", f)))
            prev[d["dealId"]] = d
        mp = os.path.join(a.prev_db, "meta.json")
        prev_meta = json.load(open(mp)) if os.path.exists(mp) else None
    elif a.prev:
        ps = json.load(open(a.prev))
        for r in ps["records"]:
            prev[r["dealId"]] = r
    out = os.path.join(ROOT, "data", "db", asof)
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(os.path.join(out, "listings"))
    os.makedirs(os.path.join(out, "photos"))
    manifest = []
    changes = {"newStale": [], "newUltra": [], "newExtreme": [], "priceDrops": [], "gone": [], "added": []}
    seen = set()
    for r in recs:
        rid = r["dealId"]
        seen.add(rid)
        old = prev.get(rid)
        hist = [h for h in (old.get("history") if old else []) or [] if h.get("asOf") != asof]
        hist.append({"asOf": asof, "dom": r["dom"], "price": r["currentPrice"], "estimate": r["redfinEstimate"],
                     "tier": r["tier"], "hot": r["hotHome"], "priceDrop": r["priceDrop"], "status": r["status"],
                     "newerCompetitors": (r.get("redfin") or {}).get("newerCompetitors"), "photoCount": (r.get("redfin") or {}).get("photoCount")})
        hist = hist[-26:]
        doc = dict(r)
        rf = dict(doc.get("redfin") or {})
        thumbs = rf.pop("thumbs", []) or []
        rf["thumbCount"] = len(thumbs)
        doc["redfin"] = rf
        doc["history"] = hist
        if old:
            ot, nt = old.get("tier"), r["tier"]
            if ot == "watch" and nt == "stale": changes["newStale"].append(rid)
            if ot in ("watch", "stale") and nt == "ultra": changes["newUltra"].append(rid)
            if ot != "extreme" and nt == "extreme": changes["newExtreme"].append(rid)
            if old.get("currentPrice") and r["currentPrice"] and r["currentPrice"] < old["currentPrice"]: changes["priceDrops"].append(rid)
        else:
            changes["added"].append(rid)
        json.dump(doc, open(os.path.join(out, "listings", f"{rid}.json"), "w"))
        manifest.append({"collection": "listings", "doc_id": rid, "file": f"listings/{rid}.json"})
        if thumbs:
            json.dump({"dealId": rid, "asOf": asof, "thumbs": thumbs}, open(os.path.join(out, "photos", f"{rid}.json"), "w"))
            manifest.append({"collection": "photos", "doc_id": rid, "file": f"photos/{rid}.json"})
    for rid in prev:
        if rid not in seen:
            changes["gone"].append(rid)
    meta = {"asOf": asof, "count": len(recs), "tiers": tier_counts(recs),
            "prevAsOf": (prev_meta or {}).get("asOf") if prev_meta else (json.load(open(a.prev))["asOf"] if a.prev else None),
            "prevCount": len(prev) or None, "prevTiers": tier_counts(list(prev.values())) if prev else None,
            "changes": changes, "enrichment": "complete",
            "enriched": sum(1 for r in recs if (r.get("redfin") or {}).get("ok")),
            "unresolved": [r["dealId"] for r in recs if not (r.get("redfin") or {}).get("ok")]}
    json.dump(meta, open(os.path.join(out, "meta.json"), "w"), indent=1)
    manifest.append({"collection": "meta", "doc_id": "current", "file": "meta.json"})
    for name in ("playbook", "market"):
        src = os.path.join(ROOT, "data", f"{name}.json")
        if os.path.exists(src):
            shutil.copy(src, os.path.join(out, f"{name}.json"))
            manifest.append({"collection": name, "doc_id": "current", "file": f"{name}.json"})
    json.dump(manifest, open(os.path.join(out, "manifest.json"), "w"), indent=1)
    sizes = [os.path.getsize(os.path.join(out, m["file"])) for m in manifest]
    print(f"{len(manifest)} documents in {out}; largest {max(sizes)/1024:.0f} KB; enriched {meta['enriched']}/{len(recs)}; unresolved {meta['unresolved']}")
    print("changes:", {k: len(v) for k, v in changes.items()})


if __name__ == "__main__":
    main()
