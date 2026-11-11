"""Builds the fillable, clickable PDF workbook (ReportLab, AcroForm fields)."""
import io
import os

from reportlab.lib.colors import HexColor, Color, white
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.fonts import addMapping
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

from . import common

W, H = 612, 792
ML, MR = 50, 50
CW = W - ML - MR
BOTTOM = 62
TOP = H - 54


def esc(t):
    return str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def register_fonts(assets):
    f = os.path.join(assets, "fonts")
    reg = {
        "Serif": "SourceSerif4-400.ttf", "Serif-SB": "SourceSerif4-600.ttf", "Serif-B": "SourceSerif4-700.ttf",
        "Serif-It": "SourceSerif4-400i.ttf", "Serif-SBIt": "SourceSerif4-600i.ttf",
        "Sans": "Inter-400.ttf", "Sans-M": "Inter-500.ttf", "Sans-SB": "Inter-600.ttf", "Sans-B": "Inter-700.ttf",
        "Wide": "Jost-400.ttf", "Wide-M": "Jost-500.ttf", "Wide-SB": "Jost-600.ttf", "Hand": "Caveat-500.ttf",
    }
    for name, fn in reg.items():
        pdfmetrics.registerFont(TTFont(name, os.path.join(f, fn)))
    addMapping("Sans", 0, 0, "Sans"); addMapping("Sans", 1, 0, "Sans-SB"); addMapping("Sans", 0, 1, "Sans"); addMapping("Sans", 1, 1, "Sans-SB")
    addMapping("Serif", 0, 0, "Serif"); addMapping("Serif", 1, 0, "Serif-SB"); addMapping("Serif", 0, 1, "Serif-It"); addMapping("Serif", 1, 1, "Serif-SBIt")


class Workbook:
    def __init__(self, content, assets, buf, pages=None):
        self.c = content
        self.assets = assets
        self.T = {k: HexColor(v) for k, v in content.THEME.items()}
        self.cv = canvas.Canvas(buf, pagesize=(W, H))
        self.cv.setTitle(content.BRAND["doc_title"])
        self.cv.setAuthor(content.BRAND["manager_name"])
        self.cv.setSubject(content.BRAND["program"])
        self.page = 1
        self.pages = pages or {}      # key -> page number (from pass 1)
        self.found = {}               # key -> page number (this pass)
        self.y = TOP
        self.cont = None              # continuation label
        self.photo_cache = {}
        self.fid = 0
        self.S = self.styles()
        b = content.BRAND
        self.TIER = b.get("tier", "Program")
        self.PRICE = b.get("price_tier", "top-tier")
        self.AI = b.get("assistant", "your AI assistant")
        self.ORG = b.get("org", "company")

    # ------------------------------------------------------------- basics
    def styles(self):
        T = self.T
        s = {}
        s["body"] = ParagraphStyle("body", fontName="Sans", fontSize=9.6, leading=14, textColor=T["charcoal"])
        s["body_m"] = ParagraphStyle("body_m", parent=s["body"], textColor=HexColor("#4C4440"))
        s["small"] = ParagraphStyle("small", fontName="Sans", fontSize=8.2, leading=11.4, textColor=T["muted"])
        s["intro"] = ParagraphStyle("intro", fontName="Serif", fontSize=12.6, leading=18.5, textColor=T["charcoal"])
        s["h3"] = ParagraphStyle("h3", fontName="Serif-SB", fontSize=15.5, leading=19, textColor=T["charcoal"])
        s["h4"] = ParagraphStyle("h4", fontName="Serif-SB", fontSize=11.8, leading=14.5, textColor=T["charcoal"])
        s["caps"] = ParagraphStyle("caps", fontName="Wide-SB", fontSize=7.6, leading=10, textColor=T["charcoal"])
        s["capsr"] = ParagraphStyle("capsr", parent=s["caps"], textColor=T["red_dark"])
        s["prompt"] = ParagraphStyle("prompt", fontName="Sans", fontSize=8.6, leading=12.6, textColor=HexColor("#3B3431"))
        s["hand"] = ParagraphStyle("hand", fontName="Hand", fontSize=15, leading=18.5, textColor=HexColor("#2B2B3A"))
        s["quote"] = ParagraphStyle("quote", fontName="Serif-It", fontSize=16, leading=22, textColor=T["charcoal"], alignment=TA_CENTER)
        s["white"] = ParagraphStyle("white", fontName="Sans", fontSize=9.4, leading=13.6, textColor=HexColor("#E6DCCF"))
        s["whiteh"] = ParagraphStyle("whiteh", fontName="Serif-SB", fontSize=12.5, leading=15.5, textColor=white)
        return s

    def P(self, text, style):
        return Paragraph(text, self.S[style] if isinstance(style, str) else style)

    def ph(self, text, style, width):
        p = self.P(text, style)
        _, h = p.wrap(width, 10000)
        return p, h

    def draw_p(self, text, style, x, y, width):
        p, h = self.ph(text, style, width)
        p.drawOn(self.cv, x, y - h)
        return h

    def fid_next(self, base):
        self.fid += 1
        return f"{base}_{self.fid}"

    def caps(self, text, x, y, size=7.6, color=None, font="Wide-SB", spacing=1.6):
        cv = self.cv
        cv.setFillColor(color or self.T["charcoal"])
        t = cv.beginText(x, y)
        t.setFont(font, size)
        t.setCharSpace(spacing)
        t.textOut(text.upper())
        t.setCharSpace(0)
        cv.drawText(t)
        return pdfmetrics.stringWidth(text.upper(), font, size) + spacing * len(text)

    def caps_w(self, text, size=7.6, font="Wide-SB", spacing=1.6):
        return pdfmetrics.stringWidth(text.upper(), font, size) + spacing * len(text)

    def photo(self, key, width, ratio):
        ck = (key, width, ratio)
        if ck not in self.photo_cache:
            data = common.prepare_photo(os.path.join(self.assets, "photos", self.c.PHOTOS[key][0]), width, 72, ratio)
            self.photo_cache[ck] = ImageReader(io.BytesIO(data))
        return self.photo_cache[ck]

    def mark(self, x, y, size, color):
        """Small arch mark used in the lockup."""
        cv = self.cv
        cv.saveState()
        cv.setStrokeColor(color)
        cv.setLineWidth(size * 0.18)
        r = size * 0.29
        cx = x + size * 0.5
        base = y
        top = y + size * 0.5
        p = cv.beginPath()
        p.moveTo(cx - r, base)
        p.lineTo(cx - r, top)
        p.arcTo(cx - r, top - r, cx + r, top + r, 180, -180)
        p.lineTo(cx + r, top - size * 0.12)
        cv.drawPath(p, stroke=1, fill=0)
        cv.restoreState()

    def lockup(self, x, y, scale=1.0, color=None):
        cv = self.cv
        color = color or self.T["charcoal"]
        b = self.c.BRAND
        sz = 13 * scale
        cv.setFillColor(color)
        t = cv.beginText(x, y)
        t.setFont("Wide-M", sz)
        t.setCharSpace(sz * 0.34)
        t.textOut(b["lockup_top"])
        t.setCharSpace(0)
        cv.drawText(t)
        by = y - sz * 0.95
        fs = sz * 0.68
        cv.setFont("Sans-B", fs)
        cv.drawString(x, by, b["lockup_by"])
        bx = x + pdfmetrics.stringWidth(b["lockup_by"] + " ", "Sans-B", fs)
        self.mark(bx, by - fs * 0.02, fs * 0.95, color)
        cv.setFillColor(color)
        cv.drawString(bx + fs * 0.98, by, b["lockup_brand"])

    def qr(self, url, x, y, size, link=True, bg=True):
        """Vector QR code with its bottom-left corner at (x, y)."""
        cv = self.cv
        m = common.qr_matrix(url)
        n = len(m)
        q = 1.5
        cell = size / (n + 2 * q)
        if bg:
            cv.setFillColor(white)
            cv.rect(x, y, size, size, stroke=0, fill=1)
        cv.setFillColor(self.T["charcoal"])
        for r, row in enumerate(m):
            cx = 0
            while cx < n:
                if row[cx]:
                    s = cx
                    while cx < n and row[cx]:
                        cx += 1
                    cv.rect(x + (q + s) * cell, y + size - (q + r + 1) * cell, (cx - s) * cell + 0.05, cell + 0.05, stroke=0, fill=1)
                else:
                    cx += 1
        if link:
            cv.linkURL(url, (x, y, x + size, y + size), relative=0, thickness=0)

    def link(self, url, rect):
        self.cv.linkURL(url, rect, relative=0, thickness=0)

    def internal(self, key, rect):
        self.cv.linkRect("", key, rect, relative=0, thickness=0)

    def round_rect(self, x, y, w, h, r, fill=None, stroke=None, lw=0.7):
        cv = self.cv
        if fill is not None:
            cv.setFillColor(fill)
        if stroke is not None:
            cv.setStrokeColor(stroke)
            cv.setLineWidth(lw)
        cv.roundRect(x, y, w, h, r, stroke=1 if stroke is not None else 0, fill=1 if fill is not None else 0)

    def badge(self, x, y, r, text, fill=None, size=9):
        cv = self.cv
        cv.setFillColor(fill or self.T["red"])
        cv.circle(x, y, r, stroke=0, fill=1)
        cv.setFillColor(white)
        cv.setFont("Serif-SB", size)
        cv.drawCentredString(x, y - size * 0.34, text)

    def button(self, x, y, label, url=None, key=None, dark=True, w=None):
        cv = self.cv
        tw = self.caps_w(label, 7, "Wide-SB", 1.2)
        bw = w or tw + 26
        bh = 20
        self.round_rect(x, y, bw, bh, 10, fill=self.T["espresso"] if dark else white, stroke=None if dark else self.T["line"])
        self.caps(label, x + (bw - tw) / 2, y + 7, 7, white if dark else self.T["charcoal"], "Wide-SB", 1.2)
        if url:
            self.link(url, (x, y, x + bw, y + bh))
        if key:
            self.internal(key, (x, y, x + bw, y + bh))
        return bw

    # ------------------------------------------------------------- fields
    def checkbox(self, name, x, y, size=10.5, tip=""):
        self.cv.acroForm.checkbox(name=name, tooltip=tip[:200], x=x, y=y, size=size, buttonStyle="check",
                                  borderColor=HexColor("#B9AC9F"), fillColor=white, textColor=self.T["red"],
                                  borderWidth=0.8, forceBorder=True, checked=False)

    def textfield(self, name, x, y, w, h, tip="", multiline=False, size=9.5, value=""):
        self.cv.acroForm.textfield(name=name, tooltip=tip[:200], x=x, y=y, width=w, height=h, value=value,
                                   fontName="Helvetica", fontSize=size, borderStyle="solid", borderWidth=0.7,
                                   borderColor=self.T["line"], fillColor=white, textColor=self.T["charcoal"],
                                   forceBorder=True, fieldFlags="multiline" if multiline else "")

    def radio(self, group, value, x, y, size=10.5, tip=""):
        self.cv.acroForm.radio(name=group, tooltip=tip[:200], value=value, selected=False, x=x, y=y, size=size,
                               buttonStyle="check", shape="square", borderColor=HexColor("#B9AC9F"), fillColor=white,
                               textColor=self.T["red"], borderWidth=0.8, borderStyle="solid", forceBorder=True)

    # ------------------------------------------------------------- pages
    def footer(self):
        cv = self.cv
        cv.setStrokeColor(self.T["line"])
        cv.setLineWidth(0.6)
        cv.line(ML, 40, W - MR, 40)
        self.lockup(ML, 26, 0.62)
        self.caps(self.c.BRAND["program"], W / 2 - self.caps_w(self.c.BRAND["program"], 6.4, "Wide-M", 1.1) / 2, 24, 6.4, self.T["muted"], "Wide-M", 1.1)
        cv.setFont("Serif-SB", 9)
        cv.setFillColor(self.T["charcoal"])
        cv.drawRightString(W - MR, 24, str(self.page))
        self.internal("start", (W - MR - 120, 18, W - MR - 18, 34))
        self.caps("Roadmap", W - MR - 70, 24, 6.2, self.T["red_dark"], "Wide-SB", 1.1)

    def bg(self):
        self.cv.setFillColor(self.T["ivory"])
        self.cv.rect(0, 0, W, H, stroke=0, fill=1)

    def newpage(self, footer=True):
        if footer:
            self.footer()
        self.cv.showPage()
        self.page += 1
        self.bg()
        self.y = TOP
        if self.cont:
            self.caps(self.cont + "  ·  continued", ML, H - 36, 7, self.T["muted"], "Wide-SB", 1.4)
            self.cv.setFillColor(self.T["red"])
            self.cv.rect(ML, H - 46, 28, 2, stroke=0, fill=1)
            self.y = H - 62

    def need(self, h):
        if self.y - h < BOTTOM:
            self.newpage()
            return True
        return False

    def anchor(self, key, title=None, level=0):
        self.cv.bookmarkPage(key)
        self.found[key] = self.page
        if title:
            self.cv.addOutlineEntry(title, key, level=level, closed=False)

    def pg(self, key):
        return self.pages.get(key, "")

    # ------------------------------------------------------------- cover
    def cover(self):
        cv = self.cv
        b = self.c.BRAND
        self.bg()
        img_h = 470
        cv.drawImage(self.photo("hero", 1700, W / img_h), 0, H - img_h, W, img_h)
        cv.saveState()
        for i in range(40):
            a = 0.82 * (1 - i / 40) ** 1.4
            cv.setFillColor(Color(0.13, 0.11, 0.10, alpha=a))
            cv.rect(i * (W * 0.75 / 40), H - img_h, W * 0.75 / 40 + 0.5, img_h, stroke=0, fill=1)
        cv.setFillColor(Color(0.13, 0.11, 0.10, alpha=0.35))
        cv.rect(0, H - img_h, W, img_h, stroke=0, fill=1)
        cv.restoreState()
        self.anchor("cover", b["doc_title"])
        self.lockup(ML, H - 70, 1.0, white)
        self.caps(b["eyebrow"] + "  ·  Agent Onboarding Workbook", ML, H - 230, 8, HexColor("#E6DCCF"), "Wide-M", 2.2)
        cv.setFillColor(self.T["red"])
        cv.rect(ML, H - 244, 40, 2.4, stroke=0, fill=1)
        st = ParagraphStyle("ct", fontName="Serif-SB", fontSize=40, leading=43, textColor=white)
        self.draw_p(esc(b["program"]), st, ML, H - 258, 380)
        cv.setFont("Serif-It", 17)
        cv.setFillColor(HexColor("#F1E9DF"))
        cv.drawString(ML, H - 372, b["tagline"])
        self.draw_p(esc(b["subtitle"]), ParagraphStyle("cs", fontName="Sans", fontSize=10.5, leading=15, textColor=HexColor("#DCD2C6")), ML, H - 386, 330)
        # lower half
        y = H - img_h - 46
        self.caps("Inside this workbook", ML, y, 7.6, self.T["red_dark"], "Wide-SB", 1.8)
        y -= 18
        col_w = (CW - 24) / 3
        for i, p in enumerate(self.c.PHASES):
            x = ML + i * (col_w + 12)
            self.round_rect(x, y - 128, col_w, 128, 8, fill=self.T["espresso"])
            self.caps("Phase " + p["num"], x + 14, y - 22, 6.8, HexColor("#CDBFB1"), "Wide-M", 1.8)
            cv.setFont("Serif-SB", 19)
            cv.setFillColor(white)
            cv.drawString(x + 14, y - 44, p["name"])
            yy = y - 64
            for mid in p["modules"]:
                m = self.c.MODULES[mid]
                cv.setFont("Serif-SB", 8)
                cv.setFillColor(HexColor("#CDBFB1"))
                cv.drawString(x + 14, yy, m["num"])
                cv.setFont("Sans", 7.8)
                cv.setFillColor(HexColor("#F3EBE1"))
                t = m["title"]
                while pdfmetrics.stringWidth(t, "Sans", 7.8) > col_w - 62:
                    t = t.rstrip("\u2026")[:-1].rstrip() + "\u2026"
                cv.drawString(x + 30, yy, t)
                pgn = self.pg(mid)
                if pgn:
                    cv.setFont("Serif-SB", 8)
                    cv.drawRightString(x + col_w - 12, yy, str(pgn))
                self.internal(mid, (x + 10, yy - 4, x + col_w - 8, yy + 10))
                yy -= 19
        y -= 150
        cv.setFont("Sans", 9)
        cv.setFillColor(self.T["muted"])
        cv.drawString(ML, y, f"Program lead: {b['manager_name']}, {b['manager_title']}  ·  {b['market']}  ·  {b['version']}")
        y -= 16
        cv.drawString(ML, y, "Type into any field, tick any box, tap any link or scan any QR code. Save often.")
        self.newpage(footer=False)

    # ------------------------------------------------------------- start page
    def start_page(self):
        cv = self.cv
        b = self.c.BRAND
        d = self.c.DELIVERABLES
        self.anchor("start", "Start here")
        self.caps("Start here", ML, self.y, 7.6, self.T["muted"], "Wide-M", 2)
        cv.setFillColor(self.T["red"])
        cv.rect(ML, self.y - 12, 34, 2.2, stroke=0, fill=1)
        self.y -= 24
        self.y -= self.draw_p(f"One program. Three tools. A clear path to your first {esc(self.PRICE)} listing.", ParagraphStyle("h", fontName="Serif-SB", fontSize=24, leading=28, textColor=self.T["charcoal"]), ML, self.y, 440)
        self.y -= 8
        self.y -= self.draw_p(f"Every worksheet from the {esc(self.TIER)} session is consolidated here into one guided workflow. Work top to bottom: each module opens with why it matters, gives you the tools, and closes with a short list of actions. Every QR code is also a clickable link.", "body_m", ML, self.y, 470)
        self.y -= 20
        # three tools
        col_w = (CW - 24) / 3
        links = {"web": d.get("web") or d.get("folder"), "pdf": None, "sheet": d.get("dashboard_copy")}
        labels = {"web": "Open web version", "pdf": None, "sheet": "Make my copy"}
        top = self.y
        for i, h in enumerate(self.c.HOW_TO):
            x = ML + i * (col_w + 12)
            self.round_rect(x, top - 118, col_w, 118, 8, fill=self.T["paper"], stroke=self.T["line"])
            self.badge(x + 24, top - 24, 11, str(i + 1), fill=self.T["espresso"], size=9)
            self.draw_p(esc(h["title"]), "h4", x + 14, top - 42, col_w - 28)
            self.draw_p(esc(h["text"]), "small", x + 14, top - 60, col_w - 28)
            if links[h["icon"]]:
                self.button(x + 14, top - 110, labels[h["icon"]], url=links[h["icon"]], dark=True)
            elif h["icon"] == "pdf":
                self.caps("You're in it now", x + 14, top - 103, 6.8, self.T["red_dark"], "Wide-SB", 1.2)
        self.y = top - 140
        # roadmap
        self.caps("Your roadmap", ML, self.y, 7.6, self.T["muted"], "Wide-M", 2)
        self.y -= 14
        rows = []
        for p in self.c.PHASES:
            for mid in p["modules"]:
                rows.append((p, mid))
        rh = 30
        tbl_top = self.y
        cv.setFillColor(self.T["espresso"])
        cv.roundRect(ML, tbl_top - 24, CW, 24, 6, stroke=0, fill=1)
        cv.rect(ML, tbl_top - 24, CW, 10, stroke=0, fill=1)
        cols = [ML + 12, ML + 80, ML + 120, ML + 330, ML + 400, ML + 462]
        for x, t in zip(cols, ["Phase", "#", "Module", "Time", "Actions", "Page"]):
            self.caps(t, x, tbl_top - 15, 6.6, HexColor("#F3EBE1"), "Wide-SB", 1.4)
        y = tbl_top - 24
        for i, (p, mid) in enumerate(rows):
            m = self.c.MODULES[mid]
            cv.setFillColor(self.T["paper"] if i % 2 == 0 else self.T["taupe_light"])
            cv.rect(ML, y - rh, CW, rh, stroke=0, fill=1)
            cy = y - rh / 2 - 3
            self.caps(p["name"], cols[0], cy, 6.8, self.T["red_dark"], "Wide-SB", 1.3)
            cv.setFont("Serif-SB", 9.5)
            cv.setFillColor(self.T["charcoal"])
            cv.drawString(cols[1], cy, m["num"])
            cv.setFont("Sans-SB", 9.4)
            cv.drawString(cols[2], cy, m["title"])
            cv.setFont("Sans", 8.6)
            cv.setFillColor(self.T["muted"])
            cv.drawString(cols[3], cy, m["time"].replace("–", "-").split(",")[0])
            cv.drawString(cols[4] + 14, cy, str(len(m["actions"])))
            cv.setFont("Serif-SB", 9.5)
            cv.setFillColor(self.T["red_dark"])
            cv.drawString(cols[5], cy, f"p. {self.pg(mid)}" if self.pg(mid) else "")
            self.internal(mid, (ML, y - rh, ML + CW, y))
            y -= rh
        # commitments + library rows
        for key, label, desc in (("commit", "My 3 Commitments", "With your manager"), ("library", "Resource Library", "All 11 links + QR")):
            cv.setFillColor(self.T["taupe"])
            cv.rect(ML, y - rh, CW, rh, stroke=0, fill=1)
            cy = y - rh / 2 - 3
            self.caps("Close", cols[0], cy, 6.8, self.T["red_dark"], "Wide-SB", 1.3)
            cv.setFont("Sans-SB", 9.4)
            cv.setFillColor(self.T["charcoal"])
            cv.drawString(cols[2], cy, label)
            cv.setFont("Sans", 8.6)
            cv.setFillColor(self.T["muted"])
            cv.drawString(cols[3], cy, desc)
            cv.setFont("Serif-SB", 9.5)
            cv.setFillColor(self.T["red_dark"])
            cv.drawString(cols[5], cy, f"p. {self.pg(key)}" if self.pg(key) else "")
            self.internal(key, (ML, y - rh, ML + CW, y))
            y -= rh
        self.y = y - 18
        # lead + legend
        self.round_rect(ML, self.y - 50, CW, 50, 8, fill=self.T["taupe_light"])
        self.badge(ML + 22, self.y - 25, 10, "★", size=9)
        self.draw_p(f"Your program lead: <b>{esc(b['manager_name'])}</b>, {esc(b['manager_title'])}. Finish with My 3 Commitments and review them together at your next 1:1. "
                    "Fields marked with a box are fillable: type directly into this PDF and save it.", "body_m", ML + 42, self.y - 9, CW - 56)
        self.y -= 62

    # ------------------------------------------------------------- phase divider
    def phase_page(self, p):
        cv = self.cv
        self.newpage()
        cv.drawImage(self.photo(p["photo"], 1500, W / H), 0, 0, W, H)
        cv.saveState()
        cv.setFillColor(Color(0.13, 0.11, 0.10, alpha=0.62))
        cv.rect(0, 0, W, H, stroke=0, fill=1)
        for i in range(40):
            a = 0.3 * (1 - i / 40)
            cv.setFillColor(Color(0.13, 0.11, 0.10, alpha=a))
            cv.rect(i * (W * 0.8 / 40), 0, W * 0.8 / 40 + 0.5, H, stroke=0, fill=1)
        cv.restoreState()
        self.anchor(p["id"], f"Phase {p['num']} · {p['name']}")
        self.lockup(ML, H - 70, 0.9, white)
        cv.saveState()
        cv.setStrokeColor(Color(1, 1, 1, alpha=0.55))
        cv.setLineWidth(1.2)
        t = cv.beginText(ML - 6, 360)
        t.setFont("Serif-SB", 260)
        t.setTextRenderMode(1)
        t.textOut(p["num"])
        t.setTextRenderMode(0)
        cv.drawText(t)
        cv.restoreState()
        self.caps("Phase " + p["num"], ML + 150, 560, 8, HexColor("#E6DCCF"), "Wide-M", 2.4)
        self.caps(p["name"], ML + 150, 542, 11, white, "Wide-M", 3.4)
        cv.setFillColor(self.T["red"])
        cv.rect(ML + 150, 528, 40, 2.4, stroke=0, fill=1)
        h = self.draw_p(esc(p["title"]), ParagraphStyle("pt", fontName="Serif-SB", fontSize=30, leading=34, textColor=white), ML + 150, 516, 350)
        y = 516 - h - 12
        y -= self.draw_p(esc(p["intro"]), ParagraphStyle("pi", fontName="Sans", fontSize=10.5, leading=15.5, textColor=HexColor("#E1D8CC")), ML + 150, y, 340)
        y -= 26
        for mid in p["modules"]:
            m = self.c.MODULES[mid]
            cv.setStrokeColor(Color(1, 1, 1, alpha=0.18))
            cv.setLineWidth(0.6)
            cv.line(ML + 150, y + 14, ML + 150 + 340, y + 14)
            self.badge(ML + 162, y + 1, 10, m["num"], size=8)
            cv.setFont("Serif-SB", 12.5)
            cv.setFillColor(white)
            cv.drawString(ML + 182, y - 3, m["title"])
            cv.setFont("Sans", 8.4)
            cv.setFillColor(HexColor("#CDBFB1"))
            cv.drawRightString(ML + 150 + 340, y - 3, (f"p. {self.pg(mid)}  ·  " if self.pg(mid) else "") + m["time"])
            self.internal(mid, (ML + 150, y - 10, ML + 490, y + 14))
            y -= 34
        self.cv.showPage()
        self.page += 1
        self.bg()
        self.y = TOP

    # ------------------------------------------------------------- module
    def module(self, mid):
        cv = self.cv
        m = self.c.MODULES[mid]
        p = common.phase_of(self.c, mid)
        if self.y < TOP - 1:
            self.newpage()
        self.cont = None
        self.anchor(mid, f"{m['num']} · {m['title']}", level=1)
        hh = 178
        top = H
        pw = 238
        cv.drawImage(self.photo(m["photo"], 900, pw / hh), 0, top - hh, pw, hh)
        cv.setFillColor(self.T["espresso"])
        cv.rect(pw, top - hh, W - pw, hh, stroke=0, fill=1)
        x = pw + 30
        self.badge(x + 14, top - 40, 14, m["num"], size=10.5)
        self.caps(f"Phase {p['num']}  ·  {p['name']}", x + 38, top - 43, 7, HexColor("#CDBFB1"), "Wide-M", 2)
        h = self.draw_p(esc(m["title"]), ParagraphStyle("mt", fontName="Serif-SB", fontSize=24, leading=27, textColor=white), x, top - 66, W - x - 30)
        yy = top - 66 - h - 4
        yy -= self.draw_p(esc(m["kicker"]), ParagraphStyle("mk", fontName="Serif-It", fontSize=11.5, leading=15, textColor=HexColor("#E8DED2")), x, yy, W - x - 30)
        yy -= 14
        pills = [m["time"], f"{len(m['actions'])} actions"] + (["Coaching framework"] if m.get("source") == "coach" else [])
        px = x
        for i, t in enumerate(pills):
            tw = self.caps_w(t, 6.6, "Wide-M", 1.2)
            fill = Color(0.69, 0.19, 0.18, alpha=0.45) if t == "Coaching framework" else Color(1, 1, 1, alpha=0.12)
            cv.setFillColor(fill)
            cv.roundRect(px, yy - 6, tw + 18, 17, 8.5, stroke=0, fill=1)
            self.caps(t, px + 9, yy, 6.6, HexColor("#EDE4D9"), "Wide-M", 1.2)
            px += tw + 26
        self.y = top - hh - 28
        self.cont = f"Module {m['num']}  ·  {m['title']}"
        # intro
        self.y -= self.draw_p(esc(m["intro"]), "intro", ML, self.y, CW)
        self.y -= 12
        if m.get("goal"):
            self.callout("The goal", m["goal"])
        self.actions(mid, m)
        for b in m["blocks"]:
            getattr(self, "b_" + b["type"])(b, m)
        self.y -= 6

    def actions(self, mid, m):
        cv = self.cv
        items = []
        for a in m["actions"]:
            p, h = self.ph(esc(a["text"]), "body", CW - 70)
            items.append((a, p, h))
        total = 40 + sum(h + 10 for _, _, h in items)
        self.need(total)
        top = self.y
        self.round_rect(ML, top - total, CW, total, 8, fill=self.T["paper"], stroke=self.T["line"])
        cv.setFillColor(self.T["red"])
        cv.rect(ML, top - total, 3, total, stroke=0, fill=1)
        self.caps("Your actions", ML + 18, top - 20, 7.6, self.T["charcoal"], "Wide-SB", 2)
        self.caps("Tick each one as you finish", ML + CW - 16 - self.caps_w("Tick each one as you finish", 6.4, "Wide-M", 1), top - 20, 6.4, self.T["muted"], "Wide-M", 1)
        y = top - 34
        for a, p, h in items:
            self.checkbox(a["id"], ML + 18, y - 12, 11, a["text"])
            p.drawOn(cv, ML + 38, y - h - 1)
            y -= h + 10
        self.y = top - total - 18

    # ------------------------------------------------------------- blocks
    def heading(self, b, keep=60):
        parts = []
        if b.get("source") == "coach":
            parts.append("coach")
        h_title = 0
        if b.get("title"):
            _, h_title = self.ph(esc(b["title"]), "h3", CW - 70)
        h_intro = 0
        if b.get("intro"):
            _, h_intro = self.ph(esc(b["intro"]), "body_m", CW)
        self.need(h_title + h_intro + keep + (16 if parts else 0) + 10)
        if parts:
            tw = self.caps_w("Manager coaching add-on", 6.4, "Wide-SB", 1.2)
            self.cv.setFillColor(Color(0.69, 0.19, 0.18, alpha=0.12))
            self.cv.roundRect(ML, self.y - 13, tw + 16, 15, 7.5, stroke=0, fill=1)
            self.caps("Manager coaching add-on", ML + 8, self.y - 8, 6.4, self.T["red_dark"], "Wide-SB", 1.2)
            self.y -= 22
        x = ML
        if b.get("step"):
            tw = self.caps_w("Step " + b["step"], 6.8, "Wide-SB", 1.3)
            self.round_rect(ML, self.y - 15, tw + 16, 16, 8, fill=self.T["espresso"])
            self.caps("Step " + b["step"], ML + 8, self.y - 10, 6.8, white, "Wide-SB", 1.3)
            x = ML + tw + 26
        if b.get("title"):
            self.y -= self.draw_p(esc(b["title"]), "h3", x, self.y + 1, CW - (x - ML))
        if b.get("intro"):
            self.y -= 4
            self.y -= self.draw_p(esc(b["intro"]), "body_m", ML, self.y, CW)
        self.y -= 10

    def callout(self, title, text, tone="coach"):
        p, h = self.ph(esc(text), "body_m", CW - 40)
        total = h + 36
        self.need(total)
        top = self.y
        self.round_rect(ML, top - total, CW, total, 6, fill=self.T["taupe_light"] if tone != "note" else HexColor("#EFEAE3"))
        self.cv.setFillColor(self.T["red"] if tone != "note" else self.T["espresso"])
        self.cv.rect(ML, top - total, 3, total, stroke=0, fill=1)
        self.caps(title, ML + 18, top - 18, 7.2, self.T["red_dark"] if tone != "note" else self.T["charcoal"], "Wide-SB", 1.6)
        p.drawOn(self.cv, ML + 18, top - 28 - h)
        self.y = top - total - 16

    def b_callout(self, b, m):
        self.callout(b["title"], b["text"], b.get("tone"))

    def b_quote(self, b, m):
        p, h = self.ph(esc(b["text"]), "quote", CW - 80)
        self.need(h + 40)
        self.cv.setFillColor(self.T["red"])
        self.cv.rect(W / 2 - 20, self.y - 6, 40, 2.4, stroke=0, fill=1)
        p.drawOn(self.cv, ML + 40, self.y - 20 - h)
        self.y -= h + 42

    def res_tile(self, rid, x, y, w, label=None, qr=58):
        """Draws a resource tile with top-left at (x, y). Returns height."""
        r = common.resource(self.c, rid)
        tx = x + qr + 20
        tw = w - qr - 30
        pl, hl = self.ph(esc((label or r["label"]).upper()), ParagraphStyle("rl", fontName="Wide-SB", fontSize=6.6, leading=8.6, textColor=self.T["red_dark"]), tw)
        pt, ht = self.ph(esc(r["title"]), ParagraphStyle("rt", fontName="Sans-SB", fontSize=8.8, leading=11, textColor=self.T["charcoal"]), tw)
        pa, ha = self.ph(esc(r["access"]) + "  ↗", ParagraphStyle("ra", fontName="Sans", fontSize=7, leading=9, textColor=self.T["muted"]), tw)
        th = hl + ht + ha + 6
        h = max(qr + 14, th + 16)
        self.round_rect(x, y - h, w, h, 6, fill=white, stroke=self.T["line"])
        self.qr(r["url"], x + 7, y - 7 - qr, qr, link=False)
        ty = y - (h - th) / 2
        pl.drawOn(self.cv, tx, ty - hl); ty -= hl + 3
        pt.drawOn(self.cv, tx, ty - ht); ty -= ht + 3
        pa.drawOn(self.cv, tx, ty - ha)
        self.link(r["url"], (x, y - h, x + w, y))
        return h

    def b_steps(self, b, m):
        self.heading(b, 70)
        for s in b["items"]:
            has = bool(s.get("resource"))
            tw = CW - 56 - (210 if has else 0) - 16
            pt, ht = self.ph(esc(s["title"]), "h4", tw)
            pb, hb = self.ph(esc(s["text"]), "body_m", tw)
            res_h = 72 if has else 0
            h = max(ht + hb + 28, res_h + 20, 50)
            self.need(h + 8)
            top = self.y
            self.round_rect(ML, top - h, CW, h, 7, fill=self.T["paper"], stroke=self.T["line"])
            self.badge(ML + 26, top - h / 2, 13, s["num"], size=9.5)
            ty = top - (h - ht - hb - 4) / 2
            pt.drawOn(self.cv, ML + 52, ty - ht)
            pb.drawOn(self.cv, ML + 52, ty - ht - 4 - hb)
            if has:
                rh = 72
                self.res_tile(s["resource"], ML + CW - 222, top - (h - rh) / 2, 210)
            self.y = top - h - 8
        self.y -= 10

    def b_checklist(self, b, m):
        two = len(b["items"]) > 6
        cols = 2 if two else 1
        cw = (CW - 30) / cols - (10 if two else 0)
        per = (len(b["items"]) + cols - 1) // cols
        cols_items = [b["items"][i * per:(i + 1) * per] for i in range(cols)]
        heights = []
        for col in cols_items:
            heights.append([self.ph(esc(t), "body", cw - 26)[1] for t in col])
        total = max(sum(h + 9 for h in hs) for hs in heights) + 18
        self.heading(b, min(total, 320))
        self.need(total)
        top = self.y
        self.round_rect(ML, top - total, CW, total, 7, fill=self.T["paper"], stroke=self.T["line"])
        idx = 0
        for ci, col in enumerate(cols_items):
            x = ML + 16 + ci * (cw + 20)
            y = top - 12
            for t, h in zip(col, heights[ci]):
                self.checkbox(f"{b['id']}_{idx}", x, y - 11.5, 10.5, t)
                self.draw_p(esc(t), "body", x + 20, y, cw - 26)
                y -= h + 9
                idx += 1
        self.y = top - total - 18

    def b_audit(self, b, m):
        cv = self.cv
        self.heading({"title": f"Score yourself through a {self.PRICE} seller's eyes", "intro": "Choose one response per item, then note what needs to improve for every No. Each item shows the module that closes the gap (tap it to jump there)."}, 120)
        xr = ML + 250
        for s in self.c.AUDIT:
            pq, hq = self.ph(esc(s["question"]), "small", CW - 60)
            hh = hq + 30
            self.need(hh + 46)
            top = self.y
            self.round_rect(ML, top - hh, CW, hh, 6, fill=self.T["taupe_light"])
            self.badge(ML + 20, top - hh / 2, 11, s["num"], fill=self.T["espresso"], size=8.5)
            self.caps(s["title"], ML + 40, top - 15, 7.6, self.T["charcoal"], "Wide-SB", 1.8)
            pq.drawOn(cv, ML + 40, top - 21 - hq)
            # column labels
            for i, lab in enumerate(("Yes", "No", "N/A")):
                self.caps(lab, xr + i * 34, top - hh + 6, 6.4, self.T["muted"], "Wide-SB", 1.2)
            self.caps("If no, what needs to improve?", xr + 108, top - hh + 6, 6.4, self.T["muted"], "Wide-SB", 1.1)
            self.y = top - hh - 4
            for it in s["items"]:
                rh = 40
                self.need(rh)
                top = self.y
                cv.setStrokeColor(HexColor("#EEE7DE"))
                cv.setLineWidth(0.6)
                cv.line(ML, top - rh, ML + CW, top - rh)
                cv.setFont("Sans-SB", 9.6)
                cv.setFillColor(self.T["charcoal"])
                cv.drawString(ML + 12, top - 16, it["label"])
                fx = self.c.MODULES[it["fix"]]
                lab = f"Fix in Module {fx['num']}: {fx['title']}  →"
                cv.setFont("Sans", 7.4)
                cv.setFillColor(self.T["red_dark"])
                cv.drawString(ML + 12, top - 29, lab)
                lw = pdfmetrics.stringWidth(lab, "Sans", 7.4)
                self.internal(it["fix"], (ML + 10, top - 32, ML + 14 + lw, top - 22))
                for i, v in enumerate(("yes", "no", "na")):
                    self.radio("audit_" + it["id"], v, xr + i * 34 + 2, top - 25, 11, f"{it['label']}: {v.upper()}")
                self.textfield("note_" + it["id"], xr + 108, top - 33, ML + CW - (xr + 108) - 6, 26, f"{it['label']}: what needs to improve?", True, 8.5)
                self.y = top - rh
            self.y -= 12
        # score box
        total = 92
        self.need(total + 10)
        top = self.y
        self.round_rect(ML, top - total, CW, total, 8, fill=self.T["espresso"])
        self.caps(f"Your {self.PRICE} readiness", ML + 18, top - 20, 7.4, HexColor("#CDBFB1"), "Wide-SB", 2)
        labels = [("Yes", "score_yes"), ("No", "score_no"), ("N/A", "score_na"), ("Readiness %", "score_pct")]
        for i, (lab, name) in enumerate(labels):
            x = ML + 18 + i * 74
            self.caps(lab, x, top - 40, 6.4, HexColor("#E6DCCF"), "Wide-M", 1.2)
            self.textfield(name, x, top - 70, 62, 22, lab, False, 11)
        bx = ML + 330
        self.caps("Readiness = Yes ÷ (Yes + No)", bx, top - 40, 6.4, HexColor("#E6DCCF"), "Wide-M", 1)
        yy = top - 54
        for band in self.c.AUDIT_BANDS:
            rng = f"{band['min']}%+" if band["min"] else "Below 60%"
            cv.setFont("Sans-SB", 8)
            cv.setFillColor(white)
            cv.drawString(bx, yy, f"{rng}  {band['name']}")
            yy -= 12
        self.caps("Suggested coaching bands", bx, yy - 2, 5.8, HexColor("#CDBFB1"), "Wide-M", 1)
        self.y = top - total - 20

    def b_flow(self, b, m):
        cv = self.cv
        f = self.c.ASSISTANT_FLOW
        self.heading({"title": f"Set up {self.AI}'s memory", "intro": f"A quick check to make sure {self.AI} understands your business. Tick your answers and follow the path."}, 150)
        w = (CW - 24) / 3
        h = 150
        top = self.y
        nodes = [
            (f["q1"], f["no1_title"], f["no1_resource"], "flow_q1"),
            (f["q2"], f["no2_title"], f["no2_resource"], "flow_q2"),
        ]
        for i, (q, fix, rid, name) in enumerate(nodes):
            x = ML + i * (w + 12)
            self.round_rect(x, top - h, w, h, 8, fill=self.T["taupe_light"])
            ph = self.draw_p(esc(q), "h4", x + 12, top - 12, w - 24)
            yy = top - 18 - ph
            for j, v in enumerate(("Yes", "No")):
                self.radio(name, v.lower(), x + 12 + j * 52, yy - 12, 11, f"{q} {v}")
                self.caps(v, x + 28 + j * 52, yy - 9, 7, self.T["charcoal"], "Wide-SB", 1.2)
            yy -= 26
            self.caps("If no:", x + 12, yy - 4, 6.4, self.T["red_dark"], "Wide-SB", 1.2)
            yy -= 8
            hh = self.draw_p(esc(fix), ParagraphStyle("fx", fontName="Sans-SB", fontSize=8.4, leading=10.5, textColor=self.T["charcoal"]), x + 12, yy, w - 24)
            yy -= hh + 6
            r = common.resource(self.c, rid)
            self.qr(r["url"], x + 12, yy - 40, 40)
            self.draw_p(esc(r["title"]) + " ↗", ParagraphStyle("fl", fontName="Sans", fontSize=7.4, leading=9.4, textColor=self.T["red_dark"]), x + 58, yy - 4, w - 70)
            self.link(r["url"], (x + 12, yy - 40, x + w - 12, yy))
            # arrow
            if i < 2:
                ax = x + w + 2
                cv.setFillColor(self.T["red"])
                p = cv.beginPath(); p.moveTo(ax, top - 40); p.lineTo(ax + 8, top - 46); p.lineTo(ax, top - 52); p.close()
                cv.drawPath(p, stroke=0, fill=1)
        x = ML + 2 * (w + 12)
        self.round_rect(x, top - h, w, h, 8, fill=HexColor("#E5EBE1"))
        ph = self.draw_p(esc(f["ready_title"]), ParagraphStyle("rd", fontName="Serif-SB", fontSize=14, leading=17, textColor=HexColor("#3F5A3B")), x + 12, top - 12, w - 24)
        self.draw_p(esc(f["ready_text"]) + f" Next: put {esc(self.AI)} to work in Module 08.", "body_m", x + 12, top - 20 - ph, w - 24)
        self.internal("m08", (x, top - h, x + w, top))
        self.y = top - h - 22

    def boxed_text(self, title, desc, text, style, resource=None):
        """Bordered box with a title row and long text that may split across pages."""
        cv = self.cv
        paras = [t for t in text.split("\n\n") if t.strip()]
        pt, ht = self.ph(esc(title), "h4", CW - 40)
        pd, hd = self.ph(esc(desc), "small", CW - 40) if desc else (None, 0)
        head = ht + hd + 30
        full = head + sum(self.ph(esc(t), style, CW - 40)[1] + 8 for t in paras) + (34 if resource else 0) + 10
        if full <= (TOP - BOTTOM) * 0.6:
            self.need(full)
        else:
            self.need(head + 70)
        state = {"top": self.y}

        def close(bottom):
            cv.saveState()
            cv.setStrokeColor(HexColor("#CDBFB1"))
            cv.setLineWidth(0.8)
            cv.setDash(3, 2)
            cv.roundRect(ML, bottom, CW, state["top"] - bottom, 7, stroke=1, fill=0)
            cv.restoreState()

        y = self.y
        pt.drawOn(cv, ML + 16, y - 14 - ht)
        if pd:
            pd.drawOn(cv, ML + 16, y - 18 - ht - hd)
        cv.setStrokeColor(HexColor("#E3DAD0")); cv.setLineWidth(0.6)
        cv.line(ML + 12, y - head + 8, ML + CW - 12, y - head + 8)
        y -= head
        for t in paras:
            p = self.P(esc(t), style)
            _, h = p.wrap(CW - 40, 10000)
            while y - h - 10 < BOTTOM:
                avail = y - BOTTOM - 12
                parts = p.split(CW - 40, avail) if avail > 26 else []
                if len(parts) == 2:
                    a, rest = parts
                    _, ha = a.wrap(CW - 40, 10000)
                    a.drawOn(cv, ML + 20, y - ha)
                    y -= ha
                    p = rest
                close(y - 8)
                self.y = y - 8
                self.newpage()
                state["top"] = self.y
                y = self.y - 14
                _, h = p.wrap(CW - 40, 10000)
            p.drawOn(cv, ML + 20, y - h)
            y -= h + 8
        if resource:
            if y - 34 < BOTTOM:
                close(y - 4)
                self.y = y - 4
                self.newpage()
                state["top"] = self.y
                y = self.y - 10
            r = common.resource(self.c, resource)
            self.qr(r["url"], ML + 16, y - 28, 26)
            cv.setFont("Sans-SB", 7.8)
            cv.setFillColor(self.T["red_dark"])
            lab = f"Source doc: {r['title']}  \u2197   ({r['access']})"
            cv.drawString(ML + 50, y - 18, lab)
            self.link(r["url"], (ML + 16, y - 28, ML + 54 + pdfmetrics.stringWidth(lab, "Sans-SB", 7.8), y - 2))
            y -= 34
        close(y - 6)
        self.y = y - 6

    def b_prompt(self, b, m):
        start_page = self.page
        self.boxed_text(b["title"], b["desc"], b["text"], "prompt", b.get("resource"))
        self.y -= 14

    def b_pipeline_prompts(self, b, m):
        cv = self.cv
        self.heading({"title": f"Three prompts to mine your {self.TIER} pipeline", "intro": f"Write your {self.TIER} price point once, then replace every [$X] before you paste a prompt into {self.AI}."}, 80)
        self.need(36)
        top = self.y
        self.round_rect(ML, top - 32, CW, 32, 6, fill=self.T["espresso"])
        self.caps(f"My {self.TIER} price point", ML + 16, top - 19, 7, white, "Wide-SB", 1.6)
        self.textfield("tier_price", ML + 170, top - 26, 150, 20, f"Your {self.TIER} price point", False, 10)
        self.y = top - 44
        for p in self.c.PIPELINE_PROMPTS:
            self.boxed_text(p["title"], p["desc"], p["text"], "prompt")
            self.y -= 10
        if b.get("resource"):
            self.need(76)
            h = self.res_tile(b["resource"], ML, self.y, 300, "All prompts · source doc")
            self.y -= h + 18

    def b_criteria(self, b, m):
        w = (CW - 30) / 4
        qr = 62
        hs = []
        for it in b["items"]:
            r = common.resource(self.c, it["resource"])
            _, h1 = self.ph(esc(it["title"].upper()), "caps", w - 20)
            _, h2 = self.ph(esc(it["text"]), "small", w - 20)
            _, h3 = self.ph("See an example ↗ " + esc(r["title"]), "small", w - 20)
            hs.append(qr + h1 + h2 + h3 + 42)
        h = max(hs)
        self.heading(b, h)
        self.need(h)
        top = self.y
        for i, it in enumerate(b["items"]):
            r = common.resource(self.c, it["resource"])
            x = ML + i * (w + 10)
            self.round_rect(x, top - h, w, h, 7, fill=self.T["paper"], stroke=self.T["line"])
            self.qr(r["url"], x + 10, top - 10 - qr, qr)
            yy = top - qr - 20
            yy -= self.draw_p(esc(it["title"].upper()), "caps", x + 10, yy, w - 20) + 4
            yy -= self.draw_p(esc(it["text"]), "small", x + 10, yy, w - 20) + 6
            hh = self.draw_p("<font name='Wide-SB' color='%s'>SEE AN EXAMPLE ↗</font><br/>%s" % (self.c.THEME["red_dark"], esc(r["title"])), "small", x + 10, yy, w - 20)
            self.link(r["url"], (x + 8, yy - hh - 2, x + w - 8, yy + 2))
        self.y = top - h - 18

    def b_table(self, b, m):
        cv = self.cv
        cw = CW / 2
        rows = b["rows"]
        hs = [max(self.ph(esc(r[0]), "body", cw - 28)[1], self.ph(esc(r[1]), "body", cw - 28)[1]) + 16 for r in rows]
        total = 26 + sum(hs)
        self.heading(b, total)
        self.need(total)
        top = self.y
        self.round_rect(ML, top - total, CW, total, 7, fill=self.T["paper"], stroke=self.T["line"])
        cv.setFillColor(self.T["espresso"])
        cv.roundRect(ML, top - 26, CW, 26, 7, stroke=0, fill=1)
        cv.rect(ML, top - 26, CW, 10, stroke=0, fill=1)
        for i, hdr in enumerate(b["headers"]):
            self.caps(hdr, ML + 14 + i * cw, top - 16, 6.8, HexColor("#F3EBE1"), "Wide-SB", 1.4)
        y = top - 26
        for r, h in zip(rows, hs):
            cv.setStrokeColor(HexColor("#EEE7DE"))
            cv.setLineWidth(0.6)
            cv.line(ML, y, ML + CW, y)
            cv.line(ML + cw, y, ML + cw, y - h)
            self.draw_p(esc(r[0]), "body", ML + 14, y - 8, cw - 28)
            self.draw_p(esc(r[1]), "body", ML + cw + 14, y - 8, cw - 28)
            y -= h
        self.y = top - total - 18

    def b_template(self, b, m):
        self.heading(b, 80)
        for f in b["fields"]:
            fh = 22 if f["lines"] == 1 else 14 + 13 * f["lines"]
            pg, hg = self.ph(esc(f["guide"]), "small", 138)
            h = max(fh, hg + 18) + 10
            self.need(h)
            top = self.y
            self.caps(f["label"], ML, top - 10, 7.2, self.T["charcoal"], "Wide-SB", 1.4)
            pg.drawOn(self.cv, ML, top - 16 - hg)
            self.textfield(f["id"], ML + 150, top - fh, CW - 150, fh, f["label"], f["lines"] > 1, 9.5)
            self.y = top - h
        self.y -= 12

    def b_example(self, b, m):
        cv = self.cv
        x = self.c.CASE_EXAMPLE
        sw = 150
        mw = CW - sw
        strat = "".join(f"<b>{i + 1}. {esc(t)}</b> {esc(d)}<br/>" for i, (t, d) in enumerate(x["strategy"]))
        pc, hc = self.ph(esc(x["challenge"]), "small", mw - 120)
        ps, hs = self.ph(strat, ParagraphStyle("st", parent=self.S["small"], textColor=self.T["charcoal"]), mw - 120)
        pr, hr = self.ph(esc(x["result"]), "small", mw - 120)
        total = 44 + 44 + hc + hs + hr + 46 + 46
        self.need(total)
        top = self.y
        self.round_rect(ML, top - total, CW, total, 8, fill=white, stroke=self.T["line"])
        cv.setFillColor(self.T["espresso"])
        cv.roundRect(ML, top - total, sw, total, 8, stroke=0, fill=1)
        cv.rect(ML + sw - 10, top - total, 10, total, stroke=0, fill=1)
        self.caps("Example", ML + 14, top - 22, 7, HexColor("#CDBFB1"), "Wide-M", 2)
        cv.setFillColor(self.T["red"])
        cv.rect(ML + 14, top - 32, 26, 2, stroke=0, fill=1)
        hh = self.draw_p("A Completed Case Study", ParagraphStyle("ex", fontName="Serif-SB", fontSize=18, leading=20, textColor=white), ML + 14, top - 42, sw - 28)
        self.draw_p(esc(x["note"]), ParagraphStyle("exn", fontName="Serif-It", fontSize=8.6, leading=11.5, textColor=HexColor("#D8CDBF")), ML + 14, top - 50 - hh, sw - 28)
        mx = ML + sw + 16
        head, _, rest = x["headline"].partition(":")
        cv.setFont("Sans-B", 11)
        cv.setFillColor(self.T["charcoal"])
        tw = pdfmetrics.stringWidth(head + ":", "Sans-B", 11) + pdfmetrics.stringWidth(rest, "Sans", 11)
        sx = mx + (mw - 32 - tw) / 2
        cv.drawString(sx, top - 24, head + ":")
        cv.setFont("Sans", 11)
        cv.drawString(sx + pdfmetrics.stringWidth(head + ":", "Sans-B", 11), top - 24, rest)
        cw4 = (mw - 32) / 4
        for i, (k, v) in enumerate(x["stats"]):
            cx = mx + i * cw4 + cw4 / 2
            cv.setFont("Sans", 7.4); cv.setFillColor(self.T["muted"]); cv.drawCentredString(cx, top - 44, k)
            cv.setFont("Sans-SB", 10.5); cv.setFillColor(self.T["charcoal"]); cv.drawCentredString(cx, top - 58, v)
            if i:
                cv.setStrokeColor(self.T["line"]); cv.line(mx + i * cw4, top - 36, mx + i * cw4, top - 64)
        y = top - 74
        for lab, p, h in (("The Challenge", pc, hc), ("The Strategy", ps, hs), ("The Result", pr, hr)):
            cv.setStrokeColor(HexColor("#EEE7DE")); cv.line(mx, y, ML + CW - 16, y)
            cv.setFont("Sans-SB", 8.4); cv.setFillColor(self.T["charcoal"]); cv.drawString(mx, y - 14, lab)
            p.drawOn(cv, mx + 90, y - 8 - h)
            y -= h + 18
        cv.setFillColor(HexColor("#8A817B"))
        cv.roundRect(mx, y - 34, mw - 32, 30, 5, stroke=0, fill=1)
        cv.setFont("Serif-It", 10.5); cv.setFillColor(white)
        cv.drawCentredString(mx + (mw - 32) / 2, y - 23, "“" + x["quote"] + "”  — Seller")
        self.y = top - total - 18

    def b_builder(self, b, m):
        self.heading(b, 150)
        self.callout("The formula", b["formula"], "note")
        w = (CW - 16) / 2
        fields = b["fields"]
        for i in range(0, len(fields), 2):
            pair = fields[i:i + 2]
            gh = max(self.ph(esc(f["guide"]), "small", w)[1] for f in pair)
            rowh = 16 + gh + 4 + 20 + 12
            self.need(rowh)
            top = self.y
            for j, f in enumerate(pair):
                x = ML + j * (w + 16)
                self.caps(f["label"], x, top - 8, 7, self.T["charcoal"], "Wide-SB", 1.4)
                self.draw_p(esc(f["guide"]), "small", x, top - 13, w)
                self.textfield(f["id"], x, top - 17 - gh - 20, w, 20, f["label"], False, 9.5)
            self.y = top - rowh
        self.need(70)
        top = self.y
        self.round_rect(ML, top - 64, CW, 64, 8, fill=self.T["espresso"])
        self.caps(f"My {self.TIER} Value Prop", ML + 16, top - 17, 7, HexColor("#CDBFB1"), "Wide-SB", 1.8)
        self.textfield("vp_sentence", ML + 16, top - 56, CW - 32, 32, f"Your {self.TIER} Value Prop", True, 10)
        self.y = top - 82

    def b_talk(self, b, m):
        cv = self.cv
        self.heading(b, 120)
        for i, beat in enumerate(b["beats"]):
            pt, ht = self.ph(esc(beat["text"]), "small", 190)
            h = max(ht + 26, 44)
            self.need(h + 6)
            top = self.y
            self.round_rect(ML, top - h, CW, h, 6, fill=self.T["paper"], stroke=self.T["line"])
            self.caps(beat["time"], ML + 12, top - 16, 6.8, self.T["red_dark"], "Wide-SB", 1.2)
            cv.setFont("Serif-SB", 10.5); cv.setFillColor(self.T["charcoal"]); cv.drawString(ML + 12, top - 31, beat["title"])
            pt.drawOn(cv, ML + 110, top - 10 - ht)
            self.textfield(f"talk_{i}", ML + 312, top - h + 6, CW - 324, h - 12, f"{beat['title']} notes", True, 8.5)
            self.y = top - h - 6
        self.y -= 12

    def b_touches(self, b, m):
        cv = self.cv
        self.heading({"title": "Your two-touch mail sequence", "intro": "A thoughtful, personal approach can open the door to a conversation and showcase your value."}, 200)
        w = (CW - 14) / 2
        hs = []
        for t in self.c.TOUCHES:
            _, h1 = self.ph(esc(t["text"]), "small", w - 28)
            _, h2 = self.ph(esc(t["note"]), "hand", w - 48)
            hs.append(h1 + h2 + 92)
        h = max(hs)
        self.need(h + 40)
        top = self.y
        for i, t in enumerate(self.c.TOUCHES):
            x = ML + i * (w + 14)
            self.round_rect(x, top - h, w, h, 8, fill=HexColor("#EDE6DC"))
            tw = self.caps_w(t["tag"], 6.8, "Wide-SB", 1.2)
            cv.setFillColor(self.T["red"]); cv.rect(x + 14, top - 26, tw + 14, 16, stroke=0, fill=1)
            self.caps(t["tag"], x + 21, top - 21, 6.8, white, "Wide-SB", 1.2)
            cv.setFont("Serif-SB", 12); cv.setFillColor(self.T["charcoal"]); cv.drawString(x + tw + 38, top - 22, t["title"])
            self.caps(t["when"], x + 14, top - 40, 6.4, self.T["muted"], "Wide-SB", 1.2)
            yy = top - 48
            yy -= self.draw_p(esc(t["text"]), "small", x + 14, yy, w - 28) + 10
            p, ph = self.ph(esc(t["note"]), "hand", w - 48)
            cv.setFillColor(HexColor("#FDFBF7"))
            cv.rect(x + 12, yy - ph - 24, w - 24, ph + 24, stroke=0, fill=1)
            p.drawOn(cv, x + 24, yy - 12 - ph)
            cv.setFillColor(self.T["red"]); cv.rect(x + w / 2 - 16, yy - ph - 18, 32, 1.6, stroke=0, fill=1)
        self.y = top - h - 10
        self.need(30)
        top = self.y
        self.caps("Touch 1 mailed on", ML, top - 14, 6.8, self.T["charcoal"], "Wide-SB", 1.2)
        self.textfield("touch1_date", ML + 110, top - 20, 100, 18, "Touch 1 mailed on", False, 9)
        self.caps("Touch 2 window (+10 to +14 days)", ML + 236, top - 14, 6.8, self.T["charcoal"], "Wide-SB", 1.2)
        self.textfield("touch2_window", ML + 412, top - 20, CW - 412, 18, "Touch 2 window", False, 9)
        self.y = top - 40

    def b_tips(self, b, m):
        self.heading(b, 80)
        w = (CW - 20) / 3
        h = 84
        self.need(h)
        top = self.y
        for i, t in enumerate(b["items"]):
            x = ML + i * (w + 10)
            self.round_rect(x, top - h, w, h, 7, fill=self.T["paper"], stroke=self.T["line"])
            if t.get("resource"):
                r = common.resource(self.c, t["resource"])
                self.qr(r["url"], x + 10, top - h + 10, 50)
                self.draw_p(esc(t["text"]), "body", x + 68, top - 12, w - 78)
                self.draw_p(esc(r["title"]) + " ↗", ParagraphStyle("tl", fontName="Sans-SB", fontSize=7.6, leading=9.6, textColor=self.T["red_dark"]), x + 68, top - 50, w - 78)
                self.link(r["url"], (x, top - h, x + w, top))
            else:
                self.draw_p(esc(t["text"]), "body", x + 12, top - 12, w - 24)
        self.y = top - h - 18

    def b_tracker(self, b, m):
        cv = self.cv
        self.heading(b, 24 + 22 * b["rows"])
        cols = b["columns"]
        widths = [0.30, 0.16, 0.15, 0.15, 0.24]
        widths = widths[:len(cols)]
        s = sum(widths)
        widths = [w / s * (CW - 24) for w in widths]
        rh = 22
        total = 24 + rh * b["rows"]
        self.need(total)
        top = self.y
        cv.setFillColor(self.T["taupe_light"])
        cv.roundRect(ML, top - 24, CW, 24, 6, stroke=0, fill=1)
        x = ML + 24
        for c, w in zip(cols, widths):
            self.caps(c, x + 2, top - 15, 6.2, self.T["charcoal"], "Wide-SB", 1)
            x += w
        y = top - 24
        for r in range(b["rows"]):
            cv.setFont("Serif-SB", 8); cv.setFillColor(self.T["muted"]); cv.drawCentredString(ML + 12, y - 14, str(r + 1))
            x = ML + 24
            for ci, w in enumerate(widths):
                self.textfield(f"{b['id']}_{r}_{ci}", x + 1, y - rh + 2, w - 3, rh - 4, f"{cols[ci]} row {r + 1}", False, 8.5)
                x += w
            y -= rh
        self.y = top - total - 18

    def b_chips(self, b, m):
        self.heading(b, 50)
        n = len(b["items"])
        w = (CW - (n - 1) * 8) / n
        h = 34
        self.need(h)
        top = self.y
        for i, t in enumerate(b["items"]):
            x = ML + i * (w + 8)
            self.round_rect(x, top - h, w, h, 6, fill=self.T["paper"], stroke=self.T["line"])
            p, ph = self.ph(esc(t.upper()), ParagraphStyle("ch", fontName="Wide-SB", fontSize=6.8, leading=8.6, textColor=self.T["charcoal"], alignment=TA_CENTER), w - 10)
            p.drawOn(self.cv, x + 5, top - h / 2 - ph / 2)
        self.y = top - h - 18

    def b_email(self, b, m):
        cv = self.cv
        paras = b["body"].split("\n\n")
        self.heading({"title": b["title"]}, 34 + sum(self.ph(esc(t).replace("\n", "<br/>"), "body", CW - 40)[1] + 8 for t in paras) + 14)
        ps = [self.ph(esc(t).replace("\n", "<br/>"), "body", CW - 40) for t in paras]
        total = 34 + sum(h + 8 for _, h in ps) + 14
        self.need(total)
        top = self.y
        self.round_rect(ML, top - total, CW, total, 7, fill=self.T["paper"], stroke=self.T["line"])
        self.caps("Subject", ML + 16, top - 20, 6.6, self.T["muted"], "Wide-SB", 1.4)
        cv.setFont("Sans-SB", 9.4); cv.setFillColor(self.T["red_dark"]); cv.drawString(ML + 70, top - 20, b["subject"])
        cv.setStrokeColor(self.T["line"]); cv.line(ML, top - 30, ML + CW, top - 30)
        y = top - 40
        for p, h in ps:
            p.drawOn(cv, ML + 20, y - h)
            y -= h + 8
        self.y = top - total - 18

    def b_cards(self, b, m):
        cv = self.cv
        n = len(b["items"])
        w = (CW - 32 - (n - 1) * 14) / n
        _, hi = self.ph(esc(b["intro"]), "white", CW - 32)
        hs = [self.ph(esc(x["title"]), "whiteh", w)[1] + self.ph(esc(x["text"]), "white", w)[1] for x in b["items"]]
        total = 44 + hi + max(hs) + 30
        self.need(total)
        top = self.y
        self.round_rect(ML, top - total, CW, total, 8, fill=self.T["espresso"])
        self.caps(b["title"], ML + 16, top - 20, 7.2, HexColor("#CDBFB1"), "Wide-SB", 2)
        cv.setFillColor(self.T["red"]); cv.rect(ML + 16, top - 30, 26, 2, stroke=0, fill=1)
        self.draw_p(esc(b["intro"]), "white", ML + 16, top - 38, CW - 32)
        y0 = top - 46 - hi
        for i, x in enumerate(b["items"]):
            xx = ML + 16 + i * (w + 14)
            if i:
                cv.setStrokeColor(Color(1, 1, 1, alpha=0.15)); cv.line(xx - 7, y0, xx - 7, top - total + 14)
            hh = self.draw_p(esc(x["title"]), "whiteh", xx, y0, w)
            self.draw_p(esc(x["text"]), "white", xx, y0 - hh - 4, w)
        self.y = top - total - 18

    # ------------------------------------------------------------- closing pages
    def commitments(self):
        cv = self.cv
        cm = self.c.COMMITMENTS
        self.cont = None
        self.newpage()
        self.anchor("commit", "My 3 Commitments")
        hh = 170
        cv.drawImage(self.photo("close", 1500, W / hh), 0, H - hh, W, hh)
        cv.saveState(); cv.setFillColor(Color(0.13, 0.11, 0.10, alpha=0.66)); cv.rect(0, H - hh, W, hh, stroke=0, fill=1); cv.restoreState()
        self.caps("Close the session", ML, H - 70, 7.6, HexColor("#E6DCCF"), "Wide-M", 2)
        cv.setFillColor(self.T["red"]); cv.rect(ML, H - 82, 34, 2.2, stroke=0, fill=1)
        self.draw_p("Commit to the three moves that matter most.", ParagraphStyle("ch", fontName="Serif-SB", fontSize=24, leading=28, textColor=white), ML, H - 94, 420)
        # card
        top = H - hh - 20
        ch = 494
        self.round_rect(ML, top - ch, CW, ch, 10, fill=self.T["paper"], stroke=self.T["line"])
        cw = self.caps_w(self.c.BRAND["eyebrow"], 8, "Wide-M", 2.6)
        self.caps(self.c.BRAND["eyebrow"], W / 2 - cw / 2, top - 30, 8, self.T["muted"], "Wide-M", 2.6)
        cv.setFillColor(self.T["red"]); cv.rect(W / 2 - 18, top - 40, 36, 2, stroke=0, fill=1)
        cv.setFont("Serif-SB", 28); cv.setFillColor(self.T["charcoal"]); cv.drawCentredString(W / 2, top - 72, cm["title"])
        qw = self.caps_w(cm["question"], 7.6, "Wide-M", 1.6)
        self.caps(cm["question"], W / 2 - qw / 2, top - 92, 7.6, self.T["muted"], "Wide-M", 1.6)
        y = top - 120
        cv.setFont("Serif-It", 11); cv.setFillColor(self.T["charcoal"])
        cv.drawString(ML + 20, y, "Agent Name:")
        self.textfield("cm_agent", ML + 98, y - 6, 150, 20, "Agent name", False, 10)
        cv.drawString(ML + 270, y, "Manager Name:")
        self.textfield("cm_manager", ML + 360, y - 6, CW - 380, 20, "Manager name", False, 10, self.c.BRAND["manager_name"])
        y -= 30
        self.draw_p(esc(cm["guide"]), "small", ML + 20, y, CW - 40)
        y -= 30
        for i in (1, 2, 3):
            cv.setStrokeColor(HexColor("#EEE7DE")); cv.line(ML + 20, y, ML + CW - 20, y)
            cv.setFont("Serif-SBIt", 30); cv.setFillColor(self.T["charcoal"]); cv.drawString(ML + 22, y - 40, f"{i}.")
            self.caps("Commitment", ML + 64, y - 14, 6.4, self.T["muted"], "Wide-SB", 1.2)
            self.textfield(f"cm_{i}", ML + 64, y - 64, CW - 64 - 130, 46, f"Commitment {i}", True, 10)
            self.caps("By when", ML + CW - 120, y - 14, 6.4, self.T["muted"], "Wide-SB", 1.2)
            self.textfield(f"cm_{i}_by", ML + CW - 120, y - 40, 100, 20, f"Commitment {i} due date", False, 10)
            y -= 76
        y -= 4
        self.caps("Need ideas? Try one of these", ML + 20, y, 6.6, self.T["red_dark"], "Wide-SB", 1.4)
        y -= 6
        for ex in cm["examples"]:
            y -= self.draw_p("•  " + esc(ex), "small", ML + 20, y, CW - 40) + 2
        y = top - ch - 20
        cv.setFont("Serif-It", 10); cv.setFillColor(self.T["muted"])
        cv.drawString(ML, y, "Agent signature  ______________________________          Manager signature  ______________________________")

    def library(self):
        cv = self.cv
        self.cont = None
        self.footer()
        cv.showPage()
        self.page += 1
        self.bg()
        self.y = TOP
        self.anchor("library", "Resource Library")
        self.caps("Resource library", ML, self.y, 7.6, self.T["muted"], "Wide-M", 2)
        cv.setFillColor(self.T["red"]); cv.rect(ML, self.y - 12, 34, 2.2, stroke=0, fill=1)
        self.y -= 24
        self.y -= self.draw_p("Every QR code, one tap away.", ParagraphStyle("h", fontName="Serif-SB", fontSize=24, leading=28, textColor=self.T["charcoal"]), ML, self.y, CW)
        self.y -= 6
        self.y -= self.draw_p(f"All links from the printed worksheets, decoded and verified. Tap a card or scan its code. Links marked “{esc(self.ORG)} sign-in” open with your {esc(self.ORG)} Google account or intranet login.", "body_m", ML, self.y, CW)
        self.y -= 16
        tiles = []
        for mid in common.module_order(self.c):
            for rid, r in self.c.RESOURCES.items():
                if r.get("module") == mid and r.get("url"):
                    tiles.append((mid, rid, r))
        w = (CW - 12) / 2
        h = 78
        for i, (mid, rid, r) in enumerate(tiles):
            col = i % 2
            if col == 0:
                self.need(h + 10)
                rowtop = self.y
            x = ML + col * (w + 12)
            self.round_rect(x, rowtop - h, w, h, 7, fill=self.T["paper"], stroke=self.T["line"])
            self.qr(r["url"], x + 10, rowtop - h + 10, h - 20, link=False)
            tx = x + h + 2
            tw = w - h - 12
            yy = rowtop - 12
            yy -= self.draw_p(esc(f"MODULE {self.c.MODULES[mid]['num']}  ·  {r['label'].upper()}"), ParagraphStyle("lm", fontName="Wide-SB", fontSize=6.2, leading=8, textColor=self.T["red_dark"]), tx, yy, tw) + 3
            yy -= self.draw_p(esc(r["title"]), ParagraphStyle("lt", fontName="Serif-SB", fontSize=10.5, leading=12.5, textColor=self.T["charcoal"]), tx, yy, tw) + 2
            yy -= self.draw_p(esc(r["desc"]), ParagraphStyle("ld", fontName="Sans", fontSize=7.4, leading=9.4, textColor=self.T["muted"]), tx, yy, tw) + 2
            self.draw_p(esc(r["access"]) + "  ↗", ParagraphStyle("la", fontName="Sans-SB", fontSize=6.8, leading=8.6, textColor=HexColor("#8E847C")), tx, yy, tw)
            self.link(r["url"], (x, rowtop - h, x + w, rowtop))
            if col == 1 or i == len(tiles) - 1:
                self.y = rowtop - h - 8
        self.y -= 8
        notes = (f"{esc(self.c.PHOTO_CREDIT)} The 123 Maple Ave case study is fictional, as noted on the original worksheet. "
                 f"Sections labelled “Manager coaching add-on” or “Coaching framework” are coaching guidance, not official {esc(self.ORG)} policy. "
                 "Verify every market number in the MLS before sharing it with a client.")
        _, hn = self.ph(notes, "small", CW)
        self.need(hn + 10)
        self.y -= self.draw_p(notes, "small", ML, self.y, CW)
        self.footer()
        cv.showPage()

    # ------------------------------------------------------------- build
    def build(self):
        self.cover()
        self.start_page()
        for p in self.c.PHASES:
            self.cont = None
            self.phase_page(p)
            for i, mid in enumerate(p["modules"]):
                if i:
                    self.cont = None
                    self.newpage()
                self.module(mid)
        self.cont = None
        self.commitments()
        self.library()
        self.cv.save()
        return self.found


def build(content, assets, out_path):
    register_fonts(assets)
    buf = io.BytesIO()
    pages = Workbook(content, assets, buf).build()
    buf = io.BytesIO()
    Workbook(content, assets, buf, pages).build()
    with open(out_path, "wb") as f:
        f.write(buf.getvalue())
    return out_path
