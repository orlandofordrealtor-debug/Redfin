#!/usr/bin/env python3
"""Build the onboarding playbook: web workflow (HTML), fillable PDF, dashboard (XLSX).

Usage:
  python3 build.py --content content.py --assets assets --out dist [--only html,pdf,xlsx]

The content module defines the program (see content.example.py for the schema).
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib import common  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--content", default="content.py")
    ap.add_argument("--assets", default="assets")
    ap.add_argument("--out", default="dist")
    ap.add_argument("--only", default="html,pdf,xlsx")
    ap.add_argument("--name", default="Playbook")
    a = ap.parse_args()
    c = common.load_content(a.content)
    os.makedirs(a.out, exist_ok=True)
    want = set(a.only.split(","))
    if "html" in want:
        from lib import html_builder
        p = html_builder.build(c, a.assets, os.path.join(a.out, a.name + "-Workflow.html"))
        print("html ", p, os.path.getsize(p))
    if "pdf" in want:
        from lib import pdf_builder
        p = pdf_builder.build(c, a.assets, os.path.join(a.out, a.name + "-Workbook.pdf"))
        print("pdf  ", p, os.path.getsize(p))
    if "xlsx" in want:
        from lib import xlsx_builder
        p = xlsx_builder.build(c, a.assets, os.path.join(a.out, a.name + "-Dashboard.xlsx"))
        print("xlsx ", p, os.path.getsize(p))


if __name__ == "__main__":
    main()
