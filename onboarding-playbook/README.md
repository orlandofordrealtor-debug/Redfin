# Onboarding Playbook Builder

Turns one content file into three matching, branded deliverables for an agent onboarding program:

| Output | What it is |
|---|---|
| `*-Workflow.html` | Single-file interactive web workflow. Phase banners, module checklists with saved progress (browser `localStorage`), live self-audit scoring with a fix list, copy-to-clipboard prompts, a 2-minute talk timer, a follow-up date helper, editable trackers, commitments with email/print, and a QR resource library. Works offline except for web fonts. |
| `*-Workbook.pdf` | Fillable, clickable PDF (AcroForm checkboxes, radio buttons, text fields), vector QR codes, internal jump links, and a bookmark outline. |
| `*-Dashboard.xlsx` | Dashboard workbook: KPI tiles, phase and module progress, next best step, one tab per module with status dropdowns, trackers, a manager team tracker, and a resource library with QR images. Converts cleanly to Google Sheets. |

## Layout

```
build.py               CLI entry point
content.example.py     Placeholder content showing the full schema (copy to content.py)
lib/common.py          Content loading, QR codes, photo processing
lib/html_builder.py    Web workflow  (+ lib/web/style.css, lib/web/app.js)
lib/pdf_builder.py     Fillable PDF  (ReportLab)
lib/xlsx_builder.py    Dashboard workbook (openpyxl)
lib/xlsx_post.py       Restores in-workbook hyperlinks after a LibreOffice recalculation
```

`content.py`, `assets/` and `dist/` are gitignored on purpose: real program content, brand assets
and internal links stay out of this repository.

## Build

```bash
pip install reportlab openpyxl qrcode pillow pypdf
cp content.example.py content.py      # then replace every value
python3 build.py --content content.py --assets assets --out dist --name My-Program
```

Assets the builders expect:

- `assets/fonts/`: static TTFs from Google Fonts (OFL): `SourceSerif4-{400,600,700,400i,600i}.ttf`,
  `Inter-{400,500,600,700}.ttf`, `Jost-{300,400,500,600}.ttf`, `Caveat-500.ttf`.
- `assets/photos/`: one JPEG per key in `PHOTOS` (`hero.jpg`, `prepare.jpg`, `m01.jpg`, ...).

After building the workbook, recalculate it so cached values exist, then restore internal links:

```bash
python3 <xlsx-skill>/scripts/recalc.py dist/My-Program-Dashboard.xlsx 90
python3 lib/xlsx_post.py dist/My-Program-Dashboard.xlsx
```

## Content schema (summary)

- `BRAND`, `THEME`: names, labels (`tier`, `price_tier`, `assistant`, `org`, `store_key`) and colors.
- `RESOURCES`: every link, keyed by id. Each gets a clickable button and a vector QR code.
- `DELIVERABLES`: links to the hosted copies of the three outputs, so each one links to the others.
- `PHASES`: three phases, each listing its module ids.
- `MODULES` (`m01` to `m08`): `title`, `kicker`, `time`, `intro`, `actions` (the trackable checklist) and
  `blocks`. Block types: `audit`, `callout`, `quote`, `steps`, `checklist`, `flow`, `prompt`,
  `pipeline_prompts`, `criteria`, `table`, `template`, `example`, `builder`, `talk`, `touches`, `tips`,
  `tracker`, `chips`, `email`, `cards`.
- `AUDIT`, `AUDIT_BANDS`, `PIPELINE_PROMPTS`, `ASSISTANT_FLOW`, `TOUCHES`, `CASE_EXAMPLE`,
  `COMMITMENTS`, `HOW_TO`: data used by those blocks.

Mark coaching additions with `"source": "coach"` so every output labels them as such.

## Hosting the web workflow

The HTML file is fully self-contained (photos and QR codes are embedded). Host it wherever your
team can reach it: an intranet page, Google Sites (embed), or any static host. Opening the file
directly from a download also works. Each viewer's progress is saved only in their own browser.
