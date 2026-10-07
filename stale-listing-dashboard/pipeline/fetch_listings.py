#!/usr/bin/env python3
"""
Weekly enrichment pipeline for the Market Smart Stale Listing Dashboard.

Input : the weekly Redfin "active listings" sheet exported as CSV
Output: data/snapshots/<date>.json  (one enriched record per Deal ID)
        data/raw/<dealId>.json       (cached raw Redfin payloads, re-used if fresh)

Each record carries the public Redfin.com listing data (facts, photos, remarks,
price history, Redfin Estimate, hot-home flag), similar active listings and sold
comps, embedded photo thumbnails (data URIs, because the dashboard page cannot
load images from redfin.com), and derived scores used by the dashboard.

Usage:
  python3 fetch_listings.py --csv data/weekly/2026-10-07.csv --asof 2026-10-07
  python3 fetch_listings.py --csv ... --limit 3           # smoke test
  python3 fetch_listings.py --csv ... --no-photos         # faster
"""
import argparse, base64, csv, datetime as dt, html as htmlmod, io, json, os, re, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RAW_DIR = os.path.join(ROOT, "data", "raw")
SNAP_DIR = os.path.join(ROOT, "data", "snapshots")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
BASE = "https://www.redfin.com"

try:
    from PIL import Image
except ImportError:  # photos become optional
    Image = None


# ----------------------------------------------------------------- helpers
def get(url, timeout=30, retries=3):
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:  # noqa
            last = e
            time.sleep(1.5 * (i + 1))
    raise last


def stingray(path):
    body = get(BASE + path).decode("utf-8", "replace")
    if body.startswith("{}&&"):
        body = body[4:]
    return json.loads(body).get("payload", {})


def money(s):
    """'$1,069K' -> 1069000 ; '$0K' -> 0 ; '' -> None"""
    if s is None:
        return None
    s = str(s).strip().replace("$", "").replace(",", "")
    if not s:
        return None
    mult = 1
    if s.endswith("K"):
        mult, s = 1000, s[:-1]
    elif s.endswith("M"):
        mult, s = 1000000, s[:-1]
    try:
        return int(round(float(s) * mult))
    except ValueError:
        return None


def pdate(s):
    s = (s or "").strip()
    if not s:
        return None
    for fmt in ("%m/%d/%y", "%m/%d/%Y", "%Y-%m-%d"):
        try:
            return dt.datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            pass
    return None


def tier(dom):
    if dom is None:
        return "unknown"
    if dom >= 90:
        return "extreme"
    if dom >= 60:
        return "ultra"
    if dom >= 30:
        return "stale"
    return "watch"


def price_band(p):
    if p is None:
        return "unknown"
    if p < 750000:
        return "under750"
    if p < 1500000:
        return "750to1500"
    if p < 3000000:
        return "1500to3000"
    return "over3000"


# ------------------------------------------------------------ redfin calls
def _lookup(q):
    p = stingray("/stingray/do/location-autocomplete?v=2&location=" + urllib.parse.quote(q))
    for sec in p.get("sections", []):
        for row in sec.get("rows", []):
            if row.get("type") in ("1", 1) and row.get("url"):
                return row["url"], row.get("id", "").split("_")[-1]
    return None, None


def resolve(address, city, state):
    """Try the address as written, then without the unit, then with common
    street suffixes (sheet rows often drop them), then number + street only."""
    a = re.sub(r"\s+", " ", address.strip().rstrip(","))
    base = re.sub(r"\s*(#|Unit|Apt|Ste)\s*\S+$", "", a, flags=re.I).strip()
    tries = [f"{a} {city} {state}"]
    if base != a:
        tries.append(f"{base} {city} {state}")
    m = re.match(r"^(\d+)\s+(.+)$", base)
    has_suffix = bool(re.search(r"\b(St|Ave|Blvd|Dr|Rd|Ln|Ct|Pl|Way|Cir|Ter|Trl|Pkwy|Hwy|Loop|Walk|Row|Sq|Path)\b\.?$", base, re.I))
    if m and not has_suffix:
        for suf in ("St", "Ave", "Rd", "Dr", "Ln", "Way", "Blvd", "Ct", "Pl", "Cir"):
            tries.append(f"{base} {suf} {city} {state}")
    tries.append(f"{base} {city}")
    # the sheet's city is often the mailing city, not the one Redfin files the home under
    tries.append(f"{a} {state}")
    tries.append(f"{base} {state}")
    if m and not has_suffix:
        for suf in ("St", "Ave", "Rd", "Dr", "Ln", "Way", "Blvd", "Ct", "Pl", "Cir"):
            tries.append(f"{base} {suf} {state}")
    tries.append(base)
    # directional prefix the MLS carries but Redfin's address file drops, and address ranges
    nodir = re.sub(r"^(\d+)\s+[NSEW]\s+", r"\1 ", base)
    if nodir != base:
        tries += [f"{nodir} {city} {state}", f"{nodir} {state}", nodir]
    rng = re.match(r"^(\d+)-\d+\s+(.+)$", base)
    if rng:
        one = f"{rng.group(1)} {rng.group(2)}"
        tries += [f"{one} {city} {state}", f"{one} {state}", one]
    seen = set()
    tries = [t for t in tries if not (t in seen or seen.add(t))]
    for q in tries:
        try:
            url, pid = _lookup(q)
        except Exception:
            url, pid = None, None
        if url:
            return url, pid
        time.sleep(0.2)
    return None, None


def fetch_listing_page(url):
    html = get(BASE + url).decode("utf-8", "replace")
    m = re.search(r'"listingId":(\d+)', html)
    listing_id = m.group(1) if m else None
    m = re.search(r'"propertyId":(\d+)', html)
    property_id = m.group(1) if m else None
    remarks = ""
    m = re.search(r'listingRemarks"[^>]*>(.*?)</div>', html, re.S)
    if m:
        remarks = re.sub(r"<[^>]+>", " ", m.group(1))
        remarks = htmlmod.unescape(re.sub(r"\s+", " ", remarks)).strip()
    if not remarks:
        m = re.search(r'"marketingRemarks":"((?:[^"\\]|\\.)*)"', html)
        if m:
            remarks = json.loads('"' + m.group(1) + '"')
    agent = ""
    m = re.search(r'Listed by\s*</span>\s*<span[^>]*>([^<]+)<', html) or \
        re.search(r'"listingAgentName":"([^"]+)"', html) or \
        re.search(r'Listed by[^<]{0,5}<[^>]+>([^<]{3,60})<', html)
    if m:
        agent = m.group(1).strip()
    return html, listing_id, property_id, remarks, agent


def thumb_data_uri(url, width, quality=70):
    if Image is None:
        return None
    raw = get(url, timeout=40)
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    w, h = im.size
    if w > width:
        im = im.resize((width, max(1, int(h * width / w))), Image.LANCZOS)
    # simple quality signals
    gray = im.convert("L")
    hist = gray.histogram()
    total = sum(hist)
    mean = sum(i * c for i, c in enumerate(hist)) / max(total, 1)
    dark = sum(hist[:50]) / max(total, 1)
    bright = sum(hist[205:]) / max(total, 1)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=quality, optimize=True)
    return {
        "src": "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode(),
        "w": w, "h": h, "brightness": round(mean, 1), "darkShare": round(dark, 3), "brightShare": round(bright, 3),
    }


def enrich(row, asof, want_photos=True, cache_days=6):
    deal_id = row["Deal Id"].strip()
    os.makedirs(RAW_DIR, exist_ok=True)
    cache_path = os.path.join(RAW_DIR, f"{deal_id}.json")
    raw = None
    if os.path.exists(cache_path):
        try:
            raw = json.load(open(cache_path))
            fetched = dt.date.fromisoformat(raw.get("fetchedAt", "2000-01-01"))
            if (dt.date.fromisoformat(asof) - fetched).days > cache_days:
                raw = None
        except Exception:
            raw = None
    if raw is None:
        raw = {"fetchedAt": asof}
        addr, city, state = row["Street Address"].strip(), row["City"].strip(), row["State Code"].strip()
        if addr in ("", "-") or city in ("", "-"):
            raw["error"] = "no address in sheet"
        else:
            try:
                url, pid = resolve(addr, city, state)
                if not url:
                    raw["error"] = "address not found on Redfin"
                else:
                    raw["url"] = url
                    html, lid, pid2, remarks, agent = fetch_listing_page(url)
                    pid = pid2 or pid
                    raw.update({"propertyId": pid, "listingId": lid, "remarks": remarks, "listedBy": agent})
                    q = f"?propertyId={pid}&listingId={lid}&accessLevel=1" if lid else f"?propertyId={pid}&accessLevel=1"
                    raw["atf"] = stingray("/stingray/api/home/details/aboveTheFold" + q)
                    time.sleep(0.25)
                    raw["btf"] = stingray("/stingray/api/home/details/belowTheFold" + q)
                    time.sleep(0.25)
                    if lid:
                        try:
                            raw["simListings"] = stingray("/stingray/api/home/details/similars/listings" + q)
                            time.sleep(0.25)
                            raw["simSolds"] = stingray("/stingray/api/home/details/similars/solds" + q)
                        except Exception as e:
                            raw["simError"] = str(e)
                    if want_photos:
                        photos = (raw["atf"].get("mediaBrowserInfo") or {}).get("photos") or []
                        urls = []
                        for ph in photos[:8]:
                            pu = ph.get("photoUrls") or {}
                            u = pu.get("nonFullScreenPhotoUrlCompressed") or pu.get("nonFullScreenPhotoUrl") or (ph.get("thumbnailData") or {}).get("thumbnailUrl")
                            if u:
                                urls.append((u, ph.get("width"), ph.get("height")))
                        thumbs = []
                        for i, (u, w, h) in enumerate(urls):
                            try:
                                t = thumb_data_uri(u, 560 if i == 0 else 220, 72 if i == 0 else 60)
                                if t:
                                    t["origW"], t["origH"] = w, h
                                    thumbs.append(t)
                            except Exception as e:
                                thumbs.append({"error": str(e)})
                            time.sleep(0.15)
                        raw["thumbs"] = thumbs
            except Exception as e:
                raw["error"] = f"{type(e).__name__}: {e}"
        json.dump(raw, open(cache_path, "w"))
    return raw


# ---------------------------------------------------------- shape records
def shape(row, raw, asof):
    r = {
        "dealId": row["Deal Id"].strip(),
        "status": row["Deal Status"].strip(),
        "listDate": pdate(row["List Date"]),
        "checkInDate": pdate(row["Check In Date"]),
        "expirationDate": pdate(row["Listing Expiration Date"]),
        "agent": row["Agent Name"].strip(),
        "address": row["Street Address"].strip().rstrip(",").strip(),
        "city": row["City"].strip(),
        "state": row["State Code"].strip(),
        "priceDrop": row["Price Drop?"].strip().upper() == "Y",
        "priceDropAmt": money(row["Price Drop Amt"]),
        "lastReductionDate": pdate(row["Last Price Reduction Date"]),
        "dom": int(row["Days On Mkt"]) if row["Days On Mkt"].strip().isdigit() else None,
        "dealUrl": row["Deal URL"].strip(),
        "suggestedPrice": money(row["Suggested Price Amount"]),
        "originalPrice": money(row["Original Price Amount"]),
        "currentPrice": money(row["Current Price"]),
        "redfinEstimate": money(row["Current Redfin Estimate"]),
        "predictedClose": money(row["Predicted Close Price Amount"]),
        "hotHome": row["Hot Home Score"].strip() == "1",
        "asOf": asof,
    }
    r["tier"] = tier(r["dom"])
    r["band"] = price_band(r["currentPrice"])
    r["dataIssues"] = []
    if r["address"] in ("", "-"):
        r["dataIssues"].append("No address in sheet")
    if not r["currentPrice"]:
        r["dataIssues"].append("No current price in sheet")
    if r["expirationDate"]:
        try:
            r["daysToExpiration"] = (dt.date.fromisoformat(r["expirationDate"]) - dt.date.fromisoformat(asof)).days
        except Exception:
            r["daysToExpiration"] = None
    # derived pricing
    cp, est, pc = r["currentPrice"], r["redfinEstimate"], r["predictedClose"]
    r["gapToEstimatePct"] = round((cp - est) / est * 100, 1) if cp and est else None
    r["gapToPredictedPct"] = round((cp - pc) / pc * 100, 1) if cp and pc else None
    r["reductionPct"] = round((r["originalPrice"] - cp) / r["originalPrice"] * 100, 1) if r["originalPrice"] and cp and r["originalPrice"] > cp else 0.0

    rf = {"ok": False}
    if raw.get("error"):
        rf["error"] = raw["error"]
    atf = raw.get("atf") or {}
    btf = raw.get("btf") or {}
    addr = atf.get("addressSectionInfo") or {}
    if addr:
        rf["ok"] = True
        rf["url"] = BASE + raw.get("url", "")
        rf["propertyId"] = raw.get("propertyId")
        rf["listingId"] = raw.get("listingId")
        rf["status"] = (addr.get("status") or {}).get("displayValue")
        rf["price"] = (addr.get("priceInfo") or {}).get("amount")
        rf["sqft"] = (addr.get("sqFt") or {}).get("value")
        rf["pricePerSqft"] = addr.get("pricePerSqFt")
        rf["beds"], rf["baths"] = addr.get("beds"), addr.get("baths")
        rf["yearBuilt"] = addr.get("yearBuilt")
        rf["lotSize"] = addr.get("lotSize")
        rf["zip"] = addr.get("zip")
        rf["lat"], rf["lng"] = (addr.get("latLong") or {}).get("latitude"), (addr.get("latLong") or {}).get("longitude")
        rf["cumulativeDom"] = addr.get("cumulativeDaysOnMarket")
        rf["domLabel"] = addr.get("daysOnMarketLabel")
        rf["isHot"] = bool(addr.get("isHot"))
        rf["hasOpenHouse"] = bool(addr.get("hasOpen"))
        rf["isRedfin"] = bool(addr.get("isRedfin"))
        rf["estimate"] = (addr.get("avmInfo") or {}).get("predictedValue")
        rf["propertyType"] = addr.get("propertyType")
        photos = (atf.get("mediaBrowserInfo") or {}).get("photos") or []
        rf["photoCount"] = len(photos)
        rf["photoTypes"] = sorted({p.get("photoType", "") for p in photos})
        res = [(p.get("width") or 0, p.get("height") or 0) for p in photos]
        rf["lowResPhotos"] = sum(1 for w, h in res if w and w < 1024)
        rf["remarks"] = raw.get("remarks", "")
        rf["remarksLength"] = len(rf["remarks"])
        rf["listedBy"] = raw.get("listedBy", "")
        pr = (btf.get("publicRecordsInfo") or {}).get("basicInfo") or {}
        rf["propertyTypeName"] = pr.get("propertyTypeName")
        rf["totalSqft"] = pr.get("totalSqFt")
        ev = []
        for e in ((btf.get("propertyHistoryInfo") or {}).get("events") or []):
            ev.append({"date": dt.datetime.fromtimestamp(e["eventDate"] / 1000, dt.timezone.utc).date().isoformat() if e.get("eventDate") else None,
                       "event": e.get("eventDescription"), "price": e.get("price"), "source": e.get("source")})
        rf["history"] = ev
        oh = ((raw.get("atf") or {}).get("openHouseInfo") or {}).get("openHouseList") or []
        rf["openHouses"] = len(oh)
        # schools / risk skipped on purpose
        def shape_sim(h):
            lp = (h.get("price") or {}).get("value")
            dom = (h.get("dom") or {}).get("value")
            tor = (h.get("timeOnRedfin") or {}).get("value")
            return {
                "address": ((h.get("streetLine") or {}).get("value") or "") + ((" " + (h.get("unitNumber") or {}).get("value")) if (h.get("unitNumber") or {}).get("value") else ""),
                "city": h.get("city"), "zip": h.get("zip"), "price": lp, "sqft": (h.get("sqFt") or {}).get("value"),
                "ppsf": (h.get("pricePerSqFt") or {}).get("value"), "beds": h.get("beds"), "baths": h.get("baths"),
                "dom": dom, "status": h.get("searchStatus"), "soldDate": dt.datetime.fromtimestamp(h["soldDate"] / 1000, dt.timezone.utc).date().isoformat() if h.get("soldDate") and h.get("searchStatus") in (4, 5) else None,
                "url": BASE + h["url"] if h.get("url") else None, "propertyId": h.get("propertyId"), "isRedfin": bool(h.get("isRedfin")),
            }
        sims = [shape_sim(h) for h in (raw.get("simListings") or {}).get("homes", [])]
        solds = [shape_sim(h) for h in (raw.get("simSolds") or {}).get("homes", [])]
        rf["similarActive"] = sims
        rf["similarSold"] = solds
        # competition analysis: new listings that came on after ours
        our_dom = r["dom"] or 0
        newer = [s for s in sims if s["dom"] is not None and s["dom"] < our_dom]
        rf["newerCompetitors"] = len(newer)
        prices = [s["price"] for s in sims if s["price"]]
        rf["activeMedianPrice"] = sorted(prices)[len(prices) // 2] if prices else None
        ppsf = [s["ppsf"] for s in sims if s["ppsf"]]
        rf["activeMedianPpsf"] = sorted(ppsf)[len(ppsf) // 2] if ppsf else None
        sold_ppsf = [s["ppsf"] for s in solds if s["ppsf"]]
        rf["soldMedianPpsf"] = sorted(sold_ppsf)[len(sold_ppsf) // 2] if sold_ppsf else None
        sold_prices = [s["price"] for s in solds if s["price"]]
        rf["soldMedianPrice"] = sorted(sold_prices)[len(sold_prices) // 2] if sold_prices else None
        sold_dom = [s["dom"] for s in solds if s["dom"] is not None]
        rf["soldMedianDom"] = sorted(sold_dom)[len(sold_dom) // 2] if sold_dom else None
        active_dom = [s["dom"] for s in sims if s["dom"] is not None]
        rf["activeMedianDom"] = sorted(active_dom)[len(active_dom) // 2] if active_dom else None
        cheaper = [s for s in sims if s["price"] and r["currentPrice"] and s["price"] < r["currentPrice"]]
        rf["cheaperCompetitors"] = len(cheaper)
        rf["thumbs"] = [t for t in (raw.get("thumbs") or []) if "src" in t]
    r["redfin"] = rf
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True)
    ap.add_argument("--asof", default=dt.date.today().isoformat())
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--no-photos", action="store_true")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    rows = list(csv.DictReader(open(a.csv, newline="", encoding="utf-8-sig")))
    if a.limit:
        rows = rows[: a.limit]
    os.makedirs(SNAP_DIR, exist_ok=True)
    out = a.out or os.path.join(SNAP_DIR, f"{a.asof}.json")
    records = []
    t0 = time.time()
    for i, row in enumerate(rows, 1):
        raw = enrich(row, a.asof, want_photos=not a.no_photos)
        rec = shape(row, raw, a.asof)
        records.append(rec)
        ok = "ok" if rec["redfin"].get("ok") else ("skip" if raw.get("error") else "??")
        print(f"[{i}/{len(rows)}] {rec['dealId']} {rec['address']}, {rec['city']} dom={rec['dom']} -> {ok} {raw.get('error','')}", flush=True)
        time.sleep(0.4)
    json.dump({"asOf": a.asof, "count": len(records), "records": records}, open(out, "w"))
    print(f"wrote {out} in {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
