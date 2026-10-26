#!/usr/bin/env python3
"""
Early Access inventory: private exclusives (internal sheet) + coming-soon listings
crawled from Redfin.com (Redfin's own, badged "REDFIN COMING SOON", and other
brokerages', badged "<BROKERAGE> COMING SOON").

  python3 pipeline/early_access.py --exclusives data/weekly/exclusives-2026-10-15.csv \
      --db data/db/2026-10-13 [--prev-db data/db/2026-10-07] [--no-crawl] [--bump]

Writes inside the listing week's db folder:
  earlyaccess/<propertyId>.json   one document per home (stage: exclusive | redfin | other | live)
  eaweek.json                     rollup for the week (eaweeks/<asOf>)
  ea-manifest.json, batches/batch-ea*.json

Stage rules (Redfin.com wins over the sheet):
  - a sheet home that Redfin.com shows as an active MLS listing, or that matches this
    week's active listing sheet, is "live": it graduated from Early Access and is
    reported on its listing page, not in the Early Access tab
  - a sheet home that Redfin.com shows as coming soon is "redfin" (coming soon)
  - otherwise a sheet home is "exclusive" (private, internal only)
  - crawled coming-soon homes are "redfin" when Redfin is the listing brokerage
    (sash 48) and "other" when another brokerage is (sash 47)
firstSeen carries over from the previous week's docs so days-in-Early-Access accumulate.
"""
import argparse, csv, glob, json, math, os, re, sys, time, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from fetch_listings import get, stingray, fetch_thumbs, fetch_listing_page, haversine, BASE  # noqa: E402

COUNTIES = [("Los Angeles County", 321), ("Ventura County", 358), ("Santa Barbara County", 344), ("Orange County", 332)]
EA_DAYS = 21
PHOTO_LIMIT = 6


def area_of(zip_code, city=""):
    z = str(zip_code or "")[:3]
    if z in ("934", "935", "936", "931"):
        return "Central Coast"
    if z in ("930", "932", "933"):
        return "Ventura County"
    if z in ("926", "927", "928"):
        return "Orange County"
    if z and "900" <= z <= "918":
        return "Los Angeles County"
    return "Other"


def money(s):
    s = re.sub(r"[^0-9.]", "", str(s or ""))
    try:
        return float(s) if s else None
    except ValueError:
        return None


def norm_addr(a):
    a = (a or "").lower()
    a = re.sub(r"\b(unit|apt|#)\s*[\w-]+", "", a)
    a = a.split(",")[0]
    return re.sub(r"[^a-z0-9]", "", a)


LA_CITIES = ["Agoura Hills","Alhambra","Altadena","Arcadia","Artesia","Avalon","Azusa","Baldwin Park","Bell","Bell Gardens","Bellflower","Beverly Hills","Bradbury","Burbank","Calabasas","Canyon Country","Carson","Castaic","Cerritos","Claremont","Commerce","Compton","Covina","Cudahy","Culver City","Diamond Bar","Downey","Duarte","El Monte","El Segundo","Gardena","Glendale","Glendora","Hacienda Heights","Hawaiian Gardens","Hawthorne","Hermosa Beach","Hidden Hills","Huntington Park","Industry","Inglewood","Irwindale","La Canada Flintridge","La Crescenta","La Habra Heights","La Mirada","La Puente","La Verne","Lakewood","Lancaster","Lawndale","Lomita","Long Beach","Los Angeles","Lynwood","Malibu","Manhattan Beach","Maywood","Monrovia","Montebello","Monterey Park","Newhall","Norwalk","Palmdale","Palos Verdes Estates","Paramount","Pasadena","Pico Rivera","Pomona","Quartz Hill","Rancho Palos Verdes","Redondo Beach","Rolling Hills","Rolling Hills Estates","Rosemead","Rowland Heights","San Dimas","San Fernando","San Gabriel","San Marino","Santa Clarita","Santa Fe Springs","Santa Monica","Saugus","Sierra Madre","Signal Hill","South El Monte","South Gate","South Pasadena","Stevenson Ranch","Temple City","Topanga","Torrance","Valencia","Valinda","Vernon","Walnut","West Covina","West Hollywood","Westlake Village","Whittier","Acton","Agua Dulce","Altadena","Marina Del Rey","Playa Del Rey","Sunland","Tujunga","Woodland Hills","Sherman Oaks","Studio City","Encino","Tarzana","Northridge","Granada Hills","Chatsworth","Porter Ranch","Van Nuys","North Hollywood","Reseda","Canoga Park","West Hills","Winnetka","Panorama City","Sylmar","Pacoima","Sun Valley","Arleta","Mission Hills","Eagle Rock","Highland Park","Silver Lake","Los Feliz","Hollywood","Venice","Mar Vista","Westchester","San Pedro","Wilmington","Harbor City","View Park","Ladera Heights","Baldwin Hills","Pacific Palisades","Brentwood","Bel Air","Century City","Westwood","Palms","Boyle Heights","Echo Park","Montecito Heights","Mount Washington","Glassell Park","Atwater Village","Lake Balboa","Valley Village","Valley Glen","Toluca Lake","Shadow Hills","Lake View Terrace","Harbor Gateway"]
VENTURA_CITIES = ["Ventura","Oxnard","Camarillo","Thousand Oaks","Simi Valley","Moorpark","Fillmore","Santa Paula","Ojai","Port Hueneme","Newbury Park","Oak Park","Oak View","Piru"]
SB_CITIES = ["Santa Barbara","Goleta","Carpinteria","Lompoc","Santa Maria","Buellton","Solvang","Guadalupe","Orcutt","Santa Ynez","Los Alamos","Vandenberg Village","Montecito","Summerland","Isla Vista","Nipomo","Arroyo Grande","Grover Beach","Pismo Beach","San Luis Obispo"]
OC_CITIES = ["Anaheim","Irvine","Santa Ana","Huntington Beach","Costa Mesa","Fullerton","Orange","Mission Viejo","Newport Beach","Laguna Niguel","Lake Forest","Tustin","Yorba Linda","Brea","Buena Park","Garden Grove","Westminster","Fountain Valley","Cypress","La Habra","Placentia","San Clemente","Dana Point","Laguna Beach","Aliso Viejo","Rancho Santa Margarita","Seal Beach","Los Alamitos","Stanton","La Palma","San Juan Capistrano","Laguna Hills","Laguna Woods","Villa Park","Ladera Ranch","Trabuco Canyon","Coto De Caza"]


def city_region(name, cache):
    """Redfin city region id via autocomplete (cached)."""
    key = name.lower()
    if key in cache:
        return cache[key]
    import urllib.parse
    try:
        payload = stingray(f"/stingray/do/location-autocomplete?v=2&location={urllib.parse.quote(name + ', CA')}")
    except Exception:  # noqa
        cache[key] = None; return None
    rid = None
    for sec in payload.get("sections", []):
        for row in sec.get("rows", []):
            url = row.get("url") or ""
            m = re.match(r"(\d+)_(\d+)", str(row.get("id") or ""))
            if not m:
                continue
            if str(row.get("type")) == "2" and url.startswith("/city/") and "/CA/" in url and not url.startswith("/city/2112/"):
                rid = (6, int(m.group(2))); break  # search API: region_type 6 = city (2112 is Brentwood in Contra Costa, not LA's)
            if str(row.get("type")) == "6" and url.startswith("/neighborhood/") and "/CA/Los-Angeles/" in url:
                rid = (1, int(m.group(2))); break  # region_type 1 = neighborhood inside Los Angeles
        if rid:
            break
    cache[key] = rid
    time.sleep(0.25)
    return rid


def crawl_coming_soon(extra_cities=(), max_pages=6):
    """Query each city by days-on-market ascending (coming-soon homes have the lowest DOM) and keep the coming-soon ones."""
    cache_path = os.path.join(ROOT, "data", "raw", "ea", "cities.json")
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    cache = json.load(open(cache_path)) if os.path.exists(cache_path) else {}
    found, centroids = {}, {}
    plan = [(c, "Los Angeles County") for c in LA_CITIES] + [(c, "Ventura County") for c in VENTURA_CITIES] + [(c, "Santa Barbara County") for c in SB_CITIES] + [(c, "Orange County") for c in OC_CITIES] + [(c, "Los Angeles County") for c in extra_cities]
    seen = set()
    for city, county in plan:
        if city.lower() in seen:
            continue
        seen.add(city.lower())
        rid = city_region(city, cache)
        if not rid:
            continue
        rtype, rid = rid
        # one call per city: Redfin returns coming-soon homes at the top of the result set (verified on cities large and small),
        # and the search API ignores paging, so the 350-home window is the whole coming-soon set for the city
        for page in range(1, 2):
            url = (f"/stingray/api/gis?al=1&market=socal&num_homes=350&page_number={page}"
                   f"&region_id={rid}&region_type={rtype}&sf=1,2,3,5,6,7&status=1&uipt=1,2,3,4,5,6,7,8&v=8")
            try:
                payload = stingray(url)
            except Exception as e:  # noqa
                print(f"  {city} page {page}: {e}"); break
            homes = payload.get("homes") or []
            if not homes:
                break
            cs = 0; doms = []
            for h in homes:
                ll = (h.get("latLong") or {}).get("value") or {}
                hcity = h.get("city")
                if hcity and ll.get("latitude"):
                    c = centroids.setdefault(hcity, [0, 0, 0]); c[0] += ll["latitude"]; c[1] += ll["longitude"]; c[2] += 1
                dom = (h.get("dom") or {}).get("value")
                if dom is not None:
                    doms.append(dom)
                if (h.get("mlsStatus") or "") != "Coming Soon":
                    continue
                cs += 1
                sashes = h.get("sashes") or []
                redfin = any(s.get("sashTypeId") == 48 for s in sashes) or (h.get("isRedfin") and h.get("listingType") == 6)
                other = next((s.get("sashTypeName") for s in sashes if s.get("sashTypeId") == 47), None)
                pid = str(h.get("propertyId"))
                if pid in found or area_of(h.get("zip")) == "Other":
                    continue
                la = h.get("listingAgent")
                unit = h.get("unitNumber"); unit = unit.get("value") if isinstance(unit, dict) else unit
                tor = (h.get("timeOnRedfin") or {}).get("value") if isinstance(h.get("timeOnRedfin"), dict) else h.get("timeOnRedfin")
                if dom is None and tor:
                    dom = int(round(tor / 86400000))
                found[pid] = {
                    "propertyId": pid, "listingId": h.get("listingId"), "url": BASE + (h.get("url") or ""),
                    "address": (h.get("streetLine") or {}).get("value"), "unit": unit, "city": hcity, "zip": h.get("zip"), "state": h.get("state"),
                    "price": (h.get("price") or {}).get("value"), "beds": h.get("beds"), "baths": h.get("baths"), "sqft": (h.get("sqFt") or {}).get("value"),
                    "pricePerSqft": (h.get("pricePerSqFt") or {}).get("value"), "lotSize": (h.get("lotSize") or {}).get("value"), "yearBuilt": (h.get("yearBuilt") or {}).get("value"),
                    "propertyType": h.get("propertyType"), "uiPropertyType": h.get("uiPropertyType"), "lat": ll.get("latitude"), "lng": ll.get("longitude"),
                    "dom": dom, "timeOnRedfin": tor, "numPictures": h.get("numPictures"),
                    "remarks": h.get("listingRemarks") or "", "remarksAccessLevel": h.get("remarksAccessLevel"),
                    "listingAgent": (la.get("name") if isinstance(la, dict) else la) or "",
                    "isRedfin": bool(h.get("isRedfin")), "isEarlyAccess": bool(h.get("isEarlyAccess")), "earlyAccessType": h.get("earlyAccessType"),
                    "badge": "REDFIN COMING SOON" if redfin else (other or "COMING SOON"), "brokerageBadge": other,
                    "stage": "redfin" if redfin else "other", "county": county, "mlsId": (h.get("mlsId") or {}).get("value"),
                    "openHouse": h.get("openHouseStartFormatted"), "hasVideoTour": h.get("hasVideoTour"), "has3DTour": h.get("has3DTour"),
                }
            if cs or page == 1:
                print(f"  {city}: page {page}, {len(homes)} homes, {cs} coming soon")
            time.sleep(0.4)
        time.sleep(0.3)
    json.dump(cache, open(cache_path, "w"), indent=0)
    cent = {c: (v[0] / v[2], v[1] / v[2]) for c, v in centroids.items() if v[2] >= 2}
    return found, cent


def trim_thumbs(thumbs):
    """Street-view frames from public-record pages come letterboxed in black; crop the bars."""
    try:
        from PIL import Image, ImageOps
        import base64, io
    except ImportError:
        return thumbs
    out = []
    for t in thumbs or []:
        src = (t or {}).get("src", "")
        if not src.startswith("data:image/jpeg;base64,"):
            out.append(t); continue
        try:
            im = Image.open(io.BytesIO(base64.b64decode(src.split(",", 1)[1]))).convert("RGB")
            g = ImageOps.autocontrast(im.convert("L"))
            bw = g.point(lambda v: 255 if v > 28 else 0)
            box = bw.getbbox()
            if box and (box[2] - box[0]) < im.width * 0.97:
                im = im.crop(box)
                buf = io.BytesIO(); im.save(buf, "JPEG", quality=70, optimize=True)
                t = dict(t); t["src"] = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode(); t["w"], t["h"] = im.size; t["trimmed"] = True
        except Exception:
            pass
        out.append(t)
    return out


def check_exclusive(pid):
    """What Redfin.com shows for a sheet home: public record only, coming soon, or an active MLS listing."""
    try:
        atf = stingray(f"/stingray/api/home/details/aboveTheFold?propertyId={pid}&accessLevel=1")
    except Exception as e:  # noqa
        return {"error": str(e)}
    a = atf.get("addressSectionInfo") or {}
    status = ((a.get("status") or {}).get("displayValue") or "")
    src = a.get("source") or ""
    out = {"redfinStatus": status, "source": src, "searchStatus": a.get("searchStatus"), "beds": a.get("beds"), "baths": a.get("baths"),
           "sqft": (a.get("sqFt") or {}).get("value"), "yearBuilt": a.get("yearBuilt"), "lotSize": a.get("lotSize"), "lat": (a.get("latLong") or {}).get("latitude"),
           "lng": (a.get("latLong") or {}).get("longitude"), "lastSoldPrice": (a.get("priceInfo") or {}).get("amount") if "Sold" in status else None,
           "lastSoldDate": a.get("soldDate"), "isRedfin": a.get("isRedfin"), "propertyTypeId": a.get("propertyType"), "zip": a.get("zip"), "city": a.get("city")}
    st = status.lower()
    out["publicStage"] = "live" if (st in ("active", "pending", "contingent", "active under contract") or a.get("searchStatus") in (1, 2, 3, 4, 5)) and src.lower() != "public records" \
        else "comingsoon" if "coming" in st else "offmarket"
    out["atf"] = atf
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--exclusives", required=True)
    ap.add_argument("--db", required=True)
    ap.add_argument("--prev-db", default=None)
    ap.add_argument("--no-crawl", action="store_true")
    ap.add_argument("--no-photos", action="store_true")
    ap.add_argument("--versions", default=os.path.join(ROOT, "data", "db", "versions.json"))
    ap.add_argument("--bump", action="store_true")
    a = ap.parse_args()
    meta = json.load(open(os.path.join(a.db, "meta.json")))
    asof = meta["asOf"]
    today = datetime.date.today().isoformat()
    m = re.search(r"(\d{4}-\d{2}-\d{2})", os.path.basename(a.exclusives))
    sheet_date = m.group(1) if m else today
    listings = {}
    for f in os.listdir(os.path.join(a.db, "listings")):
        d = json.load(open(os.path.join(a.db, "listings", f)))
        listings[norm_addr(d.get("address"))] = d
    prev = {}
    pdir = os.path.join(a.prev_db or a.db, "earlyaccess")
    if os.path.isdir(pdir):
        for f in glob.glob(os.path.join(pdir, "*.json")):
            d = json.load(open(f)); prev[d["propertyId"]] = d
    cache_dir = os.path.join(ROOT, "data", "raw", "ea"); os.makedirs(cache_dir, exist_ok=True)

    # 1. crawl
    crawled, centroids = ({}, {})
    if not a.no_crawl:
        print("crawling Redfin.com coming soon…")
        extra = sorted({d.get('city') for d in listings.values() if d.get('city')})
        crawled, centroids = crawl_coming_soon(extra)
        json.dump({"asOf": today, "homes": crawled, "centroids": centroids}, open(os.path.join(cache_dir, f"crawl-{today}.json"), "w"))
    else:
        fs = sorted(glob.glob(os.path.join(cache_dir, "crawl-*.json")))
        if fs:
            c = json.load(open(fs[-1])); crawled, centroids = c["homes"], c["centroids"]; print(f"using cached crawl {fs[-1]}")
    # city centroids also from active listings
    for d in listings.values():
        rf = d.get("redfin") or {}
        if rf.get("lat") and d.get("city"):
            c = centroids.get(d["city"]); centroids[d["city"]] = c or (rf["lat"], rf["lng"])

    # 2. exclusives from the sheet
    docs = {}
    with open(a.exclusives, newline="", encoding="utf-8-sig") as f:
        rows = [{(k or "").strip().upper(): v for k, v in row.items()} for row in csv.DictReader(f)]  # header case varies week to week
    print(f"{len(rows)} private exclusives in the sheet")
    for r in rows:
        url = (r.get("URL") or "").strip()
        if url.startswith("/"):
            url = "https://www.redfin.com" + url
        m = re.search(r"/home/(\d+)", url)
        pid = m.group(1) if m else "x" + re.sub(r"[^0-9]", "", r.get("ADDRESS", ""))[:12]
        addr = (r.get("ADDRESS") or "").strip()
        parts = [p.strip() for p in addr.split(",")]
        street = parts[0] if parts else addr
        city = parts[1] if len(parts) > 1 else ""
        zip_m = re.search(r"\b(9\d{4})\b", addr)
        zc = zip_m.group(1) if zip_m else ""
        doc = {"propertyId": pid, "url": url, "address": street, "city": city, "zip": zc, "state": "CA", "price": money(r.get("PRICE")),
               "beds": money(r.get("BEDS")), "baths": money(r.get("BATHS")), "sqft": money(r.get("SQFT")), "marketLabel": r.get("MARKET"), "description": r.get("DESCRIPTION"),
               "sheetDate": sheet_date, "source": "sheet", "stage": "exclusive", "badge": "REDFIN EXCLUSIVE"}
        if doc["price"] and doc["sqft"]:
            doc["pricePerSqft"] = round(doc["price"] / doc["sqft"])
        chk = check_exclusive(pid) if pid.isdigit() else {}
        atf = chk.pop("atf", {}) if chk else {}
        doc["redfinCheck"] = {k: v for k, v in chk.items() if k != "atf"}
        for k in ("lat", "lng", "yearBuilt", "lotSize", "lastSoldPrice", "lastSoldDate"):
            if chk.get(k) is not None:
                doc[k] = chk[k]
        if chk.get("zip") and not zc:
            doc["zip"] = chk["zip"]
        live_match = listings.get(norm_addr(street)) if street else None
        if live_match:
            doc["stage"] = "live"; doc["dealId"] = live_match["dealId"]; doc["listingAgent"] = live_match.get("agent"); doc["dom"] = live_match.get("dom"); doc["tier"] = live_match.get("tier")
            doc["graduated"] = {"to": "MLS active", "dealId": live_match["dealId"], "dom": live_match.get("dom")}
        elif chk.get("publicStage") == "live":
            doc["stage"] = "live"; doc["graduated"] = {"to": f"Redfin.com shows {chk.get('redfinStatus')}", "dealId": None}
        elif chk.get("publicStage") == "comingsoon" or pid in crawled:
            doc["stage"] = "redfin"; doc["badge"] = "REDFIN COMING SOON"; doc["graduated"] = {"to": "Early Access coming soon on Redfin.com"}
        if pid in crawled:
            c = crawled.pop(pid)
            for k, v in c.items():
                if v not in (None, "") and k not in ("stage", "badge"):
                    doc[k] = v
            doc["stage"] = "redfin" if c["stage"] == "redfin" else doc["stage"]; doc["badge"] = c["badge"]
        if atf and not a.no_photos and doc["stage"] != "live":
            try:
                doc["thumbs"] = trim_thumbs(fetch_thumbs(atf, PHOTO_LIMIT))
            except Exception:
                doc["thumbs"] = []
        doc["area"] = area_of(doc.get("zip"), city)
        docs[pid] = doc
        print(f"  {street}, {city}: {doc['stage']} ({chk.get('redfinStatus','?')}, {len(doc.get('thumbs') or [])} photos)")
        time.sleep(0.4)

    # 3. crawled coming soon (not in the sheet)
    for pid, c in crawled.items():
        if area_of(c.get("zip")) == "Other":
            continue
        doc = dict(c); doc["source"] = "redfin.com"; doc["area"] = area_of(c.get("zip"), c.get("city"))
        live_match = listings.get(norm_addr(c.get("address")))
        if live_match:
            doc["dealId"] = live_match["dealId"]; doc["listingAgentSheet"] = live_match.get("agent")
        docs[pid] = doc
    # photos, remarks and agent for Redfin coming soon
    for pid, doc in docs.items():
        if doc["stage"] == "redfin" and doc.get("source") == "redfin.com" and not a.no_photos:
            try:
                atf = stingray(f"/stingray/api/home/details/aboveTheFold?propertyId={pid}&listingId={doc.get('listingId')}&accessLevel=1")
                doc["thumbs"] = fetch_thumbs(atf, PHOTO_LIMIT)
            except Exception as e:  # noqa
                doc["thumbs"] = []; doc["photoError"] = str(e)
            if not doc.get("remarks") or not doc.get("listingAgent"):
                try:
                    _, _, _, remarks, agent = fetch_listing_page(doc["url"].replace(BASE, ""))
                    doc["remarks"] = doc.get("remarks") or remarks; doc["listingAgent"] = doc.get("listingAgent") or agent
                except Exception:
                    pass
            time.sleep(0.5)

    # 4. first seen, days in stage, nearby cities, fingerprint
    for pid, doc in docs.items():
        p = prev.get(pid) or {}
        doc["asOf"] = asof; doc["checkedAt"] = today
        doc["firstSeen"] = p.get("firstSeen") or (sheet_date if doc.get("source") == "sheet" else today)
        if p.get("stage") and p.get("stage") != doc["stage"]:
            doc["stageChangedFrom"] = p["stage"]; doc["stageChangedAt"] = today
        else:
            doc["stageChangedAt"] = p.get("stageChangedAt") or doc["firstSeen"]
        d0 = datetime.date.fromisoformat(doc["firstSeen"])
        doc["daysInEarlyAccess"] = (datetime.date.today() - d0).days
        if doc["stage"] in ("redfin", "other"):
            used = doc.get("dom") if doc.get("dom") is not None else doc["daysInEarlyAccess"]
            doc["daysUsed"] = used; doc["daysLeft"] = max(0, EA_DAYS - used)
            doc["clock"] = "green" if used <= 7 else "amber" if used <= 14 else "red"
        if doc.get("lat") and centroids:
            near = sorted(((haversine(doc["lat"], doc["lng"], la, lo), c) for c, (la, lo) in centroids.items() if c != doc.get("city")), key=lambda x: x[0])
            doc["nearbyCities"] = [c for dist, c in near if dist <= 6][:5] or [c for dist, c in near[:3]]
        price = doc.get("price") or 0
        doc["fingerprint"] = {"priceMin": round(price * 0.90, -3), "priceMax": round(price * 1.05, -3), "bedsMin": max(1, int(doc.get("beds") or 1) - 1),
                              "bathsMin": max(1, math.floor(float(doc.get("baths") or 1)) - 1), "cities": [doc.get("city")] + (doc.get("nearbyCities") or []),
                              "type": {1: "Single family", 2: "Condo", 3: "Townhouse", 4: "Multi-family", 5: "Land", 6: "Other", 13: "Mobile"}.get(doc.get("uiPropertyType") or doc.get("propertyType"), "Home")}
        rem = (doc.get("remarks") or "")
        feats = [k for k, pat in [("view", r"\bview"), ("pool", r"\bpool"), ("ADU", r"\badu\b|guest house|casita"), ("remodeled", r"remodel|renovat|updated"), ("large lot", r"lot|acre"), ("garage", r"garage"), ("single story", r"single[- ]story|one[- ]story"), ("HOA", r"\bhoa\b"), ("new construction", r"new construction|newly built")] if re.search(pat, rem, re.I)]
        doc["features"] = feats
    out_dir = os.path.join(a.db, "earlyaccess")
    os.makedirs(out_dir, exist_ok=True)
    for f in glob.glob(os.path.join(out_dir, "*.json")):
        os.remove(f)
    manifest = []
    for pid, doc in docs.items():
        json.dump(doc, open(os.path.join(out_dir, f"{pid}.json"), "w"))
        manifest.append({"collection": "earlyaccess", "doc_id": pid, "file": f"earlyaccess/{pid}.json"})
    # homes that were in Early Access last week and are gone now (sold, withdrawn, or dropped from the sheet)
    gone = [pid for pid in prev if pid not in docs]
    by_stage = {}
    for d in docs.values():
        s = by_stage.setdefault(d["stage"], {"count": 0, "volume": 0, "laCount": 0})
        s["count"] += 1; s["volume"] += d.get("price") or 0
        if d.get("area") == "Los Angeles County":
            s["laCount"] += 1
    week = {"asOf": asof, "checkedAt": today, "sheetDate": sheet_date, "total": len(docs), "byStage": by_stage,
            "exclusives": by_stage.get("exclusive", {}).get("count", 0), "redfinComingSoon": by_stage.get("redfin", {}).get("count", 0),
            "otherComingSoon": by_stage.get("other", {}).get("count", 0), "graduated": by_stage.get("live", {}).get("count", 0),
            "preMarketVolume": sum(d.get("price") or 0 for d in docs.values() if d["stage"] in ("exclusive", "redfin")),
            "newThisWeek": [pid for pid, d in docs.items() if pid not in prev and d["stage"] != "live"], "gone": gone,
            "byArea": {}, "eaDays": EA_DAYS}
    for d in docs.values():
        week["byArea"][d.get("area")] = week["byArea"].get(d.get("area"), 0) + 1
    json.dump(week, open(os.path.join(a.db, "eaweek.json"), "w"), indent=1)
    manifest.append({"collection": "eaweeks", "doc_id": asof, "file": "eaweek.json"})
    json.dump(manifest, open(os.path.join(a.db, "ea-manifest.json"), "w"), indent=1)
    # batches
    vers = json.load(open(a.versions)) if os.path.exists(a.versions) else {}
    batches, cur, cur_bytes = [], [], 0
    for m_ in manifest:
        b = os.path.getsize(os.path.join(a.db, m_["file"]))
        if cur and (cur_bytes + b > 980_000 or len(cur) >= 50):
            batches.append(cur); cur, cur_bytes = [], 0
        w = {"op": "set", "collection": m_["collection"], "doc_id": m_["doc_id"], "file_path": os.path.abspath(os.path.join(a.db, m_["file"]))}
        key = f'{w["collection"]}/{w["doc_id"]}'
        if key in vers:
            w["if_version"] = vers[key]
        if a.bump:
            vers[key] = vers.get(key, 0) + 1
        cur.append(w); cur_bytes += b
    if cur:
        batches.append(cur)
    # delete last week's docs that are gone (the page shows every earlyaccess doc, so stale ones must leave the database)
    dels = []
    for pid in gone:
        key = f"earlyaccess/{pid}"
        if key in vers:
            dels.append({"op": "delete", "collection": "earlyaccess", "doc_id": pid, "if_version": vers[key]})
            if a.bump:
                del vers[key]
    for i in range(0, len(dels), 50):
        batches.append(dels[i:i + 50])
    bdir = os.path.join(a.db, "batches"); os.makedirs(bdir, exist_ok=True)
    for f in glob.glob(os.path.join(bdir, "batch-ea*.json")):
        os.remove(f)
    for i, b in enumerate(batches):
        json.dump(b, open(os.path.join(bdir, f"batch-ea{i:02d}.json"), "w"), separators=(",", ":"))
    if a.bump:
        json.dump(vers, open(a.versions, "w"), indent=0, sort_keys=True)
    sizes = [os.path.getsize(os.path.join(a.db, m_["file"])) for m_ in manifest]
    print(f"{len(docs)} Early Access docs: {week['exclusives']} private exclusives, {week['redfinComingSoon']} Redfin coming soon, {week['otherComingSoon']} other brokerages, "
          f"{week['graduated']} graduated to live; {len(batches)} batch file(s), largest doc {max(sizes)/1024:.0f} KB{' (versions bumped)' if a.bump else ''}")


if __name__ == "__main__":
    main()
