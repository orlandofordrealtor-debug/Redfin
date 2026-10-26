# Dependencies: every library, CDN, font, runtime capability and storage key

One item per line. Versions are exactly as pinned in dashboard.html.

## Browser libraries (loaded from CDN by dashboard.html)

- html2canvas 1.4.1 from https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js (renders page sections to images for the share-out and one-pager exports).
- jsPDF 2.5.1 (UMD build) from https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js (PDF exports).
- SheetJS xlsx 0.18.5 from https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js (.xlsx exports for Google Sheets and CSV parsing of the Weekly upload).
- No other JavaScript libraries; all charts are hand-written inline SVG; no React, no Tailwind, no jQuery.

## Fonts

- Google Fonts stylesheet: https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&display=swap
- Display font: Outfit (weights 500, 600, 700) via the CSS variable --font-display.
- Body font: Source Sans 3 (400, 600, 700 and 400 italic) via --font-body, falling back to Segoe UI, system-ui, sans-serif.
- Monospace: ui-monospace, Menlo, Consolas, monospace (system fonts, not loaded).
- Printable one-pager and emailed HTML use Helvetica, Arial, sans-serif (system fonts).

## Claude Artifact runtime (window.claude)

- claude.use("db"): the artifact's shared database; the page subscribes to collections listings, coaching, meta, market, playbook, weeks, openhouses, ohweeks, earlyaccess, eaweeks and eameta with onSnapshot listeners and writes coaching and eameta documents.
- claude.use("user"): viewer identity (name) used to sign coaching entries and personalise Ava prompts.
- claude.use("sample"): asks Claude for text from inside the page (AI coaching drafts).
- claude.use("downloads"): hands the viewer a file to save (CSV, .xlsx, PDF, HTML exports).
- window.claude.hot: hot-reload hook checked at startup; UNVERIFIED beyond its presence in the code.
- The artifact is published with capabilities db, user, sample and downloads; the artifact id is 81ALWMGv7Ku9ATQf1iHA2T and the page's database is tied to that artifact (a new account must publish a new artifact and reload the data-export).

## Browser storage keys

- localStorage "slcc-theme": "light" or "dark"; the page defaults to light when the key is absent.
- localStorage "slcc-assump": JSON of the pricing assumptions object S.a (rate, down payment, carrying cost, drift, stale discounts, urgency premium, closing costs, open house rate, norm and spend threshold).
- No sessionStorage, cookies or IndexedDB are used.
- URL hash routing: the page listens for hashchange and calls routeFromHash(); in-page links set location.hash to "openhouses" and "earlyaccess"; the view and selected property are kept in page state S.view and the hash.

## External links the page opens (no data is sent)

- https://www.redfin.com/... listing pages and photo CDN images referenced by the Redfin data.
- https://www.google.com/maps/search/<address> map links.
- https://mail.google.com/mail/ compose links for the ready-to-send emails.

## Python pipeline

- Python 3.13.16 was used; nothing newer than Python 3.9 syntax is required (UNVERIFIED below 3.9).
- Standard library only for the core: argparse, base64, csv, datetime, glob, html, io, json, math, os, re, shutil, sys, time, urllib.parse, urllib.request.
- Optional third-party: Pillow (PIL) for thumbnail resizing, brightness and letterbox trimming in fetch_listings.py, seed_db.py and early_access.py; when Pillow is missing the scripts still run and photos are skipped.
- No requirements.txt exists; install with: pip install pillow.
- Network: outbound HTTPS to https://www.redfin.com (stingray JSON endpoints and listing pages) with a desktop Chrome user agent string set in fetch_listings.py.

## Redfin.com endpoints used by the pipeline

- https://www.redfin.com/stingray/do/location-autocomplete?v=2&location=<city> (city to region id).
- https://www.redfin.com/stingray/api/gis?al=1&region_id=<id>&region_type=<6 city or 1 neighborhood>&status=1&v=8&num_homes=350 (active plus coming-soon homes per city).
- https://www.redfin.com/stingray/api/home/details/aboveTheFold?propertyId=<pid>&listingId=<lid>&accessLevel=1 (photos, remarks, price history, agent).
- https://www.redfin.com/stingray/api/home/details/belowTheFold?... (facts, lot, year built, cumulative days on market).
- https://www.redfin.com/stingray/api/home/details/similars/listings?... (active comparable listings used for the competition block).
- https://www.redfin.com/stingray/api/home/details/similars/solds?... (sold comparables used for the sold-comp anchor).
- https://www.redfin.com/stingray/do/location-autocomplete (shared with early_access.py).
- Exact query parameters for belowTheFold and similars calls are set in pipeline/fetch_listings.py stingray() calls.
- Responses begin with the prefix {}&& before the JSON; the pipeline strips it.
- Redfin may answer 403 on detail endpoints and 202 with an empty body on listing pages; see DATA-REFRESH.md for the fallback rules.

## Tooling used by Claude around the pipeline (not required by the page)

- ArtifactData tool (Claude Code / Cowork) to push batches of 50 pinned writes and to export collections.
- Artifact tool to publish dashboard.html with the capabilities above.
- Google Drive connector to read the shared sheets and to create the Early Access Google Sheet.
- Git repository orlandofordrealtor-debug/redfin, branch claude/redfin-stale-listing-dashboard-fijdv3.

## Brand assets

- brand/logo.svg (Redfin Powered by Rocket, dark text for the light theme).
- brand/logo-reversed.svg (white version for the dark theme and dark backgrounds).
- brand/mark.svg (icon mark used in the header and favicon).
