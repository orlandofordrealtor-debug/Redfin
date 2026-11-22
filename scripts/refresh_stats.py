#!/usr/bin/env python3
"""Weekly roster stats refresh for Spotlight Studio.

Reads agent documents exported from the Studio's database (one JSON file per agent,
named <doc_id>.json, as written by ArtifactData `list` with `out_dir`), fetches each
agent's public Redfin profile, and writes one merge-update file per agent to OUT_DIR.

Usage:
    python3 scripts/refresh_stats.py AGENTS_DIR OUT_DIR

Each update file holds only the fields to merge into the agent document:
    {"stats": {"deals", "volume", "highest", "updatedAt", "source", "fetched", "fetchedAt"}, ...}

Rules
- Numbers come only from the agent's public Redfin profile page. Nothing is estimated.
- A manager's manual override (stats.source == "manual") is kept until Redfin shows
  numbers different from the last ones fetched; then the fresh Redfin numbers win.
- License, phone and title are filled only when the roster field is empty.
- Agents without a profileUrl are skipped and listed in the summary.

Standard library only, so it runs in any fresh session.
"""
import html
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/130 Safari/537.36")


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf8", "ignore")


def parse_profile(page):
    text = re.sub(r"<script.*?</script>|<style.*?</style>", "", page, flags=re.S)
    lines = [l.strip() for l in html.unescape(re.sub(r"<[^>]+>", "\n", text)).split("\n") if l.strip()]
    out = {}
    for i, line in enumerate(lines):
        if line == "Total Deals" and i > 0:
            out["deals"] = lines[i - 1]
        elif line == "Sales volume" and i > 0:
            out["volume"] = lines[i - 1]
        elif line == "Highest sales price" and i > 0:
            out["highest"] = lines[i - 1]
        elif line == "License #" and i + 1 < len(lines) and "license" not in out:
            out["license"] = lines[i + 1]
    m = re.search(r'class="agent-hero-photo"[^>]*alt="([^"]+)"', page)
    if m:
        alt = html.unescape(m.group(1))
        t = re.match(r"^(.*?),\s*(.*?)(?:\s+in\s+.*)?$", alt)
        if t:
            out["name"] = t.group(1).strip()
            out["title"] = t.group(2).strip()
    m = re.search(r"tel:(\(\d{3}\) \d{3}-\d{4})", page)
    if m:
        out["phone"] = m.group(1)
    return out


def main(agents_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    summary = {"updated": [], "unchanged": [], "kept_manual": [], "skipped": [], "failed": []}
    for fn in sorted(os.listdir(agents_dir)):
        if not fn.endswith(".json"):
            continue
        doc_id = fn[:-5]
        with open(os.path.join(agents_dir, fn), encoding="utf8") as fh:
            doc = json.load(fh)
        if doc.get("active") is False:
            continue
        url = (doc.get("profileUrl") or "").strip()
        if not url.startswith("https://www.redfin.com/real-estate-agents/"):
            summary["skipped"].append(doc.get("name", doc_id))
            continue
        try:
            got = parse_profile(fetch(url))
        except Exception as exc:  # network or HTTP failure: leave the agent untouched
            summary["failed"].append(f"{doc.get('name', doc_id)}: {exc}")
            time.sleep(1.5)
            continue
        if not got.get("title") or not any(got.get(k) for k in ("deals", "volume", "highest")):
            summary["failed"].append(f"{doc.get('name', doc_id)}: no stats found on profile")
            time.sleep(1.5)
            continue
        fresh = {k: got.get(k, "") for k in ("deals", "volume", "highest")}
        cur = doc.get("stats") or {}
        last_fetched = cur.get("fetched") or {k: cur.get(k, "") for k in ("deals", "volume", "highest")}
        stats = {"fetched": fresh, "fetchedAt": now}
        if cur.get("source") == "manual" and fresh == last_fetched:
            summary["kept_manual"].append(doc.get("name", doc_id))
        else:
            stats.update(fresh)
            stats.update({"updatedAt": now, "source": "redfin-profile"})
            changed = any(str(cur.get(k, "")) != str(fresh[k]) for k in fresh)
            summary["updated" if changed else "unchanged"].append(
                f"{doc.get('name', doc_id)}: {fresh['deals']} deals, {fresh['volume']}, {fresh['highest']}")
        update = {"stats": stats}
        for field in ("license", "phone", "title"):
            if not (doc.get(field) or "").strip() and got.get(field):
                update[field] = got[field]
        with open(os.path.join(out_dir, doc_id + ".json"), "w", encoding="utf8") as fh:
            json.dump(update, fh)
        time.sleep(1.2)  # be polite to redfin.com
    with open(os.path.join(out_dir, "_summary.json"), "w", encoding="utf8") as fh:
        json.dump(summary, fh, indent=1)
    for key, items in summary.items():
        print(f"{key}: {len(items)}")
        for it in items:
            print(f"  - {it}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    main(sys.argv[1], sys.argv[2])
