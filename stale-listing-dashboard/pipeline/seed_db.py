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
import argparse, base64, io, json, os, shutil

try:
    from PIL import Image
except ImportError:
    Image = None


def shrink(thumb, width, quality):
    """Re-encode a cached data-URI thumbnail smaller so photo documents stay compact."""
    if Image is None or not thumb.get("src", "").startswith("data:image/jpeg;base64,"):
        return thumb
    try:
        im = Image.open(io.BytesIO(base64.b64decode(thumb["src"].split(",", 1)[1]))).convert("RGB")
        w, h = im.size
        if w > width:
            im = im.resize((width, max(1, int(h * width / w))), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=quality, optimize=True)
        t = dict(thumb)
        t["src"] = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
        return t
    except Exception:
        return thumb

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
        thumbs = [shrink(t, 480 if i == 0 else 200, 66 if i == 0 else 54) for i, t in enumerate(thumbs[:15])]
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
    # weekly KPI snapshot (one small doc per week; the page builds trailing trends from these)
    stale60 = [r for r in recs if (r.get("dom") or 0) >= 60]
    stale30 = [r for r in recs if (r.get("dom") or 0) >= 30]
    doms = [r["dom"] for r in recs if r.get("dom") is not None]
    week = {"asOf": asof, "active": len(recs), "tiers": tier_counts(recs),
            "stale60": len(stale60), "stale60Pct": round(len(stale60) / max(len(recs), 1) * 100, 1),
            "stale30": len(stale30), "stale30Pct": round(len(stale30) / max(len(recs), 1) * 100, 1),
            "volume": sum(r.get("currentPrice") or 0 for r in recs), "staleVolume": sum(r.get("currentPrice") or 0 for r in stale30),
            "avgDom": round(sum(doms) / max(len(doms), 1), 1), "medianDom": sorted(doms)[len(doms) // 2] if doms else None,
            "priceDrops": sum(1 for r in recs if r.get("priceDrop")), "hot": sum(1 for r in recs if r.get("hotHome")),
            "added": len(changes["added"]), "gone": len(changes["gone"]), "newStale": len(changes["newStale"]), "newUltra": len(changes["newUltra"]), "newExtreme": len(changes["newExtreme"]), "weekPriceDrops": len(changes["priceDrops"]),
            "agents": len({r.get("agent") for r in recs}), "expiring45": sum(1 for r in recs if r.get("daysToExpiration") is not None and 0 <= r["daysToExpiration"] <= 45)}
    json.dump(week, open(os.path.join(out, "week.json"), "w"), indent=1)
    manifest.append({"collection": "weeks", "doc_id": asof, "file": "week.json"})
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
    # size-aware batches for the ArtifactData tool (1 MiB per request, 50 writes max)
    prev_photos = {}
    if a.prev_db and os.path.isdir(os.path.join(a.prev_db, "photos")):
        for f in os.listdir(os.path.join(a.prev_db, "photos")):
            try:
                d = json.load(open(os.path.join(a.prev_db, "photos", f)))
                prev_photos[f[:-5]] = len(d.get("thumbs", []))
            except Exception:
                pass
    batches, cur, cur_bytes = [], [], 0
    skipped = 0
    for m in manifest:
        if m["collection"] in ("playbook", "market"):
            continue
        if m["collection"] == "photos" and prev_photos.get(m["doc_id"]) is not None:
            cur_n = len(json.load(open(os.path.join(out, m["file"]))).get("thumbs", []))
            if cur_n == prev_photos[m["doc_id"]]:
                skipped += 1
                continue
        b = os.path.getsize(os.path.join(out, m["file"]))
        if cur and (cur_bytes + b > 980_000 or len(cur) >= 50):
            batches.append(cur); cur, cur_bytes = [], 0
        cur.append({"op": "set", "collection": m["collection"], "doc_id": m["doc_id"], "file_path": os.path.join(out, m["file"])}); cur_bytes += b
    if cur:
        batches.append(cur)
    bdir = os.path.join(out, "batches"); os.makedirs(bdir, exist_ok=True)
    for i, b in enumerate(batches):
        json.dump(b, open(os.path.join(bdir, f"batch{i:02d}.json"), "w"), separators=(",", ":"))
    print(f"{len(batches)} push batches in {bdir} (skipped {skipped} unchanged photo docs)")
    # version pins: documents that existed last week are at version 2 after the 10/07 re-seed; new ones have none
    prev_ids = set(prev.keys())
    vers = {}
    vp = os.path.join(a.prev_db, "versions.json") if a.prev_db else None
    if vp and os.path.exists(vp):
        vers = json.load(open(vp))
    json.dump({"prevIds": sorted(prev_ids), "prevPhotoIds": sorted(prev_photos.keys()), "versions": vers}, open(os.path.join(out, "push-context.json"), "w"), indent=1)
    sizes = [os.path.getsize(os.path.join(out, m["file"])) for m in manifest]
    print(f"{len(manifest)} documents in {out}; largest {max(sizes)/1024:.0f} KB; enriched {meta['enriched']}/{len(recs)}; unresolved {meta['unresolved']}")
    print("changes:", {k: len(v) for k, v in changes.items()})


if __name__ == "__main__":
    main()
