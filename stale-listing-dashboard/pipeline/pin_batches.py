#!/usr/bin/env python3
"""
Add version pins to push batches so existing documents can be overwritten.

  python3 pin_batches.py --db data/db/<date> --versions data/db/versions.json

versions.json maps "collection/doc_id" -> current version in the artifact
database. Documents not in the map are new and get no pin. After a push,
bump the map with --bump so next week's pins are right.
"""
import argparse, json, os, glob


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--versions", required=True)
    ap.add_argument("--bump", action="store_true", help="after a successful push: record the new versions")
    a = ap.parse_args()
    vers = json.load(open(a.versions)) if os.path.exists(a.versions) else {}
    bdir = os.path.join(a.db, "batches")
    files = sorted(glob.glob(os.path.join(bdir, "batch*.json")))
    pinned = new = 0
    for f in files:
        b = json.load(open(f))
        for w in b:
            key = f'{w["collection"]}/{w["doc_id"]}'
            if key in vers:
                w["if_version"] = vers[key]; pinned += 1
            else:
                w.pop("if_version", None); new += 1
            if a.bump:
                vers[key] = vers.get(key, 0) + 1
        json.dump(b, open(f, "w"), separators=(",", ":"))
    if a.bump:
        json.dump(vers, open(a.versions, "w"), indent=0, sort_keys=True)
    print(f"{len(files)} batches: {pinned} pinned, {new} new{' (versions bumped)' if a.bump else ''}")


if __name__ == "__main__":
    main()
