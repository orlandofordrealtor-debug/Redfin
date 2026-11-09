#!/usr/bin/env python3
"""Download the board's Google Fonts once and write them as inline @font-face CSS.

The published page loads fonts from Google Fonts directly. Local renders (PNG and MP4)
use this inlined copy so headless Chromium never depends on network access for type.
"""
import base64
import re
import subprocess
import sys
from pathlib import Path

CSS_URL = ("https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,100..900"
           "&family=JetBrains+Mono:wght@500;700;800&display=swap")
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


def fetch(url):
    return subprocess.run(["curl", "-sSfL", "-A", UA, url], check=True, capture_output=True).stdout


def main(out):
    css = fetch(CSS_URL).decode()
    blocks = re.findall(r"/\*\s*([\w-]+)\s*\*/\s*(@font-face\s*{[^}]*})", css)
    keep = []
    for subset, block in blocks:
        if subset not in {"latin", "latin-ext"}:
            continue
        url = re.search(r"url\((https://[^)]+)\)", block).group(1)
        data = base64.b64encode(fetch(url)).decode()
        keep.append(block.replace(url, f"data:font/woff2;base64,{data}"))
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_text("\n".join(keep))
    print(f"wrote {len(keep)} @font-face blocks to {out} ({Path(out).stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main(sys.argv[1])
