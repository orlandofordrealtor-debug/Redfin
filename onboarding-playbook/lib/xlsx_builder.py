"""Builds the dashboard workbook (.xlsx): central dashboard + one tab per module + trackers."""
import math
import os

from openpyxl import Workbook
from openpyxl.drawing.image import Image as XLImage
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

from . import common

STATUS = ["Not started", "In progress", "Done"]
HEAD = "Georgia"
BODY = "Arial"


def hx(c):
    return c.replace("#", "").upper()


class XL:
    def __init__(self, content, assets, tmpdir):
        self.c = content
        self.assets = assets
        self.tmp = tmpdir
        t = {k: hx(v) for k, v in content.THEME.items()}
        self.t = t
        self.fill = {k: PatternFill("solid", start_color=v, end_color=v) for k, v in t.items()}
        self.fill["white"] = PatternFill("solid", start_color="FFFFFF", end_color="FFFFFF")
        self.fill["green_l"] = PatternFill("solid", start_color="E3ECDF", end_color="E3ECDF")
        self.fill["amber_l"] = PatternFill("solid", start_color="F5E7CC", end_color="F5E7CC")
        self.fill["red_l"] = PatternFill("solid", start_color="F4DCDA", end_color="F4DCDA")
        thin = Side(style="thin", color=t["line"])
        self.box = Border(left=thin, right=thin, top=thin, bottom=thin)
        self.under = Border(bottom=Side(style="thin", color="E6DED4"))
        self.redline = Border(bottom=Side(style="medium", color=t["red"]))
        self.wb = Workbook()
        self.tabs = {}      # mid -> sheet title
        self.pct = {}       # mid -> "'Tab'!$E$5"
        self.done = {}      # mid -> (status range string, n actions)
        self.links = []     # (sheet, cell, target sheet) internal links for later Google fix-up
        b = content.BRAND
        self.TIER = b.get("tier", "Program")
        self.PRICE = b.get("price_tier", "top-tier")
        self.AI = b.get("assistant", "your AI assistant")
        self.ORG = b.get("org", "company")

    # ------------------------------------------------------------- styling helpers
    def font(self, size=10, bold=False, color=None, italic=False, head=False):
        return Font(name=HEAD if head else BODY, size=size, bold=bold, italic=italic, color=color or self.t["charcoal"])

    def paint(self, ws, rows, cols, fill="ivory"):
        for r in range(1, rows + 1):
            for c in range(1, cols + 1):
                ws.cell(r, c).fill = self.fill[fill]

    def setup(self, ws, widths, rows=120, tab_color=None):
        ws.sheet_view.showGridLines = False
        ws.sheet_view.zoomScale = 100
        for i, w in enumerate(widths, start=1):
            ws.column_dimensions[get_column_letter(i)].width = w
        self.paint(ws, rows, len(widths) + 2)
        if tab_color:
            ws.sheet_properties.tabColor = tab_color

    def merge_text(self, ws, r, c1, c2, value, font=None, fill=None, align=None, height=None, border=None):
        ws.merge_cells(start_row=r, start_column=c1, end_row=r, end_column=c2)
        cell = ws.cell(r, c1, value)
        cell.font = font or self.font()
        cell.alignment = align or Alignment(wrap_text=True, vertical="center")
        if fill:
            for c in range(c1, c2 + 1):
                ws.cell(r, c).fill = self.fill[fill] if isinstance(fill, str) else fill
        if border:
            for c in range(c1, c2 + 1):
                ws.cell(r, c).border = border
        if height:
            ws.row_dimensions[r].height = height
        return cell

    def est_height(self, text, width_chars, size=10, min_h=18):
        lines = 0
        for para in str(text).split("\n"):
            lines += max(1, math.ceil(len(para) * (size / 10) / max(width_chars * 1.05, 1)))
        return max(min_h, lines * (size * 1.38) + 8)

    def banner(self, ws, ncols, eyebrow, title, kicker, back=True):
        last = ncols
        for r in (1, 2, 3, 4):
            for c in range(1, last + 1):
                ws.cell(r, c).fill = self.fill["espresso"]
        ws.row_dimensions[1].height = 24
        ws.row_dimensions[2].height = 36
        ws.row_dimensions[3].height = 22
        ws.row_dimensions[4].height = 8
        b = self.c.BRAND
        ws.cell(1, 2, f"{b['lockup_top']}  ·  {b['lockup_by']} {b['lockup_brand']}     |     {eyebrow.upper()}").font = Font(name=BODY, size=8.5, bold=True, color="CDBFB1")
        ws.cell(1, 2).alignment = Alignment(vertical="bottom")
        ws.cell(2, 2, title).font = Font(name=HEAD, size=20, bold=True, color="FFFFFF")
        ws.cell(2, 2).alignment = Alignment(vertical="center")
        ws.cell(3, 2, kicker).font = Font(name=HEAD, size=11, italic=True, color="E8DED2")
        ws.cell(3, 2).alignment = Alignment(vertical="top")
        for c in range(1, last + 1):
            ws.cell(5, c).fill = self.fill["red"]
        ws.row_dimensions[5].height = 3
        if back:
            cell = ws.cell(1, last - 1, "← Dashboard")
            cell.font = Font(name=BODY, size=9, bold=True, color="F6D2CE", underline="single")
            cell.alignment = Alignment(horizontal="right", vertical="bottom")
            self.internal(ws, cell, "Dashboard")

    def internal(self, ws, cell, target):
        cell.hyperlink = f"#'{target}'!A1"
        self.links.append((ws.title, cell.coordinate, target))

    def section(self, ws, r, c1, c2, text, sub=None):
        ws.row_dimensions[r].height = 26
        cell = ws.cell(r, c1, text.upper())
        cell.font = Font(name=BODY, size=10, bold=True, color=self.t["charcoal"])
        cell.alignment = Alignment(vertical="bottom")
        for c in range(c1, c2 + 1):
            ws.cell(r, c).border = self.redline
        if sub:
            r += 1
            self.merge_text(ws, r, c1, c2, sub, self.font(9.5, color=self.t["muted"], italic=True),
                            height=self.est_height(sub, sum(ws.column_dimensions[get_column_letter(c)].width for c in range(c1, c2 + 1)), 9.5))
        return r + 1

    def header_row(self, ws, r, cols, labels, fill="espresso"):
        ws.row_dimensions[r].height = 22
        for c, lab in zip(cols, labels):
            cell = ws.cell(r, c, lab.upper() if lab else "")
            cell.font = Font(name=BODY, size=8.5, bold=True, color="F3EBE1" if fill == "espresso" else self.t["charcoal"])
            cell.fill = self.fill[fill]
            cell.alignment = Alignment(vertical="center", wrap_text=True)

    def input(self, cell, value=None, size=10, wrap=True, fmt=None):
        if value is not None:
            cell.value = value
        cell.fill = self.fill["white"]
        cell.border = self.box
        cell.font = self.font(size)
        cell.alignment = Alignment(wrap_text=wrap, vertical="top")
        if fmt:
            cell.number_format = fmt

    def status_validation(self, ws):
        dv = DataValidation(type="list", formula1='"' + ",".join(STATUS) + '"', allow_blank=True)
        dv.error = "Choose Not started, In progress, or Done"
        dv.prompt = "Pick a status"
        ws.add_data_validation(dv)
        return dv

    def status_format(self, ws, rng):
        first = rng.split(":")[0].replace("$", "")
        ws.conditional_formatting.add(rng, FormulaRule(formula=[f'{first}="Done"'], fill=self.fill["green_l"], font=Font(color="3F5A3B", bold=True)))
        ws.conditional_formatting.add(rng, FormulaRule(formula=[f'{first}="In progress"'], fill=self.fill["amber_l"], font=Font(color="7A5520", bold=True)))

    def link_formula(self, url, label):
        return f'=HYPERLINK("{url}","{label.replace(chr(34), "")}")'

    def res_rows(self, ws, r, rids, c_label=2, c_title=3, c_link=4, c_access=6, last=7):
        self.header_row(ws, r, [c_label, c_title, c_link, c_access], ["Resource", "What it is", "Open", "Access"], fill="taupe")
        for c in range(c_label, last + 1):
            ws.cell(r, c).fill = self.fill["taupe"]
        r += 1
        for rid in rids:
            res = common.resource(self.c, rid)
            ws.cell(r, c_label, res["label"]).font = self.font(9.5, True, self.t["red_dark"])
            ws.cell(r, c_title, f"{res['title']}: {res['desc']}").font = self.font(9.5)
            ws.cell(r, c_title).alignment = Alignment(wrap_text=True, vertical="top")
            ws.cell(r, c_label).alignment = Alignment(wrap_text=True, vertical="top")
            cell = ws.cell(r, c_link, self.link_formula(res["url"], "Open link ↗"))
            cell.font = Font(name=BODY, size=9.5, bold=True, color=self.t["red"], underline="single")
            cell.alignment = Alignment(vertical="top")
            ws.cell(r, c_access, res["access"]).font = self.font(8.5, color=self.t["muted"])
            ws.cell(r, c_access).alignment = Alignment(wrap_text=True, vertical="top")
            ws.row_dimensions[r].height = self.est_height(res["title"] + res["desc"], ws.column_dimensions[get_column_letter(c_title)].width, 9.5, 30)
            for c in range(c_label, last + 1):
                ws.cell(r, c).border = self.under
            r += 1
        return r + 1

    # ------------------------------------------------------------- module tab skeleton
    WIDTHS = [2.5, 6, 52, 16, 16, 18, 30, 2.5]

    def module_tab(self, mid):
        c = self.c
        m = c.MODULES[mid]
        p = common.phase_of(c, mid)
        title = f"{m['num']} {self.short(m['title'])}"
        ws = self.wb.create_sheet(title)
        self.tabs[mid] = title
        self.setup(ws, self.WIDTHS, 160, self.t["espresso"])
        self.banner(ws, 8, f"Phase {p['num']} · {p['name']}  ·  Module {m['num']}  ·  {m['time']}", m["title"], m["kicker"])
        # progress strip
        ws.row_dimensions[7].height = 24
        ws.cell(7, 2, "MODULE PROGRESS").font = self.font(8.5, True, self.t["muted"])
        ws.merge_cells("B7:C7")
        r0 = 13
        n = len(m["actions"])
        rng = f"$D${r0}:$D${r0 + n - 1}"
        pc = ws.cell(7, 4, f'=IFERROR(COUNTIF({rng},"Done")/{n},0)')
        pc.number_format = "0%"
        pc.font = Font(name=HEAD, size=16, bold=True, color=self.t["red_dark"])
        pc.alignment = Alignment(horizontal="center", vertical="center")
        bar = ws.cell(7, 5, '=REPT("█",ROUND(D7*20,0))&REPT("░",20-ROUND(D7*20,0))')
        bar.font = Font(name=BODY, size=10, color=self.t["red"])
        ws.merge_cells("E7:G7")
        bar.alignment = Alignment(vertical="center")
        self.pct[mid] = f"'{title}'!$D$7"
        self.done[mid] = (f"'{title}'!{rng}", n)
        # intro
        txt = m["intro"] + (("  " + "The goal: " + m["goal"]) if m.get("goal") else "")
        self.merge_text(ws, 9, 2, 7, txt, self.font(10.5, head=True), height=self.est_height(txt, 150, 10.5))
        if m.get("source") == "coach":
            cell = ws.cell(10, 2, f"MANAGER COACHING FRAMEWORK · built from the {self.PRICE} Audit items; not official {self.ORG} policy")
            cell.font = self.font(8.5, True, self.t["red_dark"])
        # actions
        ws.cell(11, 2, "YOUR ACTIONS").font = self.font(10, True)
        for col in range(2, 8):
            ws.cell(11, col).border = self.redline
        ws.row_dimensions[11].height = 24
        self.header_row(ws, 12, [2, 3, 4, 5, 6], ["#", "Action", "Status", "Due date", "Notes"])
        ws.merge_cells("F12:G12")
        for col in range(2, 8):
            ws.cell(12, col).fill = self.fill["espresso"]
        dv = self.status_validation(ws)
        for i, a in enumerate(m["actions"]):
            r = r0 + i
            ws.cell(r, 2, i + 1).font = self.font(10, True, self.t["muted"], head=True)
            ws.cell(r, 2).alignment = Alignment(horizontal="center", vertical="top")
            ws.cell(r, 3, a["text"]).font = self.font(10)
            ws.cell(r, 3).alignment = Alignment(wrap_text=True, vertical="top")
            st = ws.cell(r, 4)
            self.input(st, "Not started", 9.5, False)
            st.alignment = Alignment(horizontal="center", vertical="top")
            dv.add(st)
            self.input(ws.cell(r, 5), None, 9.5, False, "mmm d, yyyy")
            ws.merge_cells(start_row=r, start_column=6, end_row=r, end_column=7)
            self.input(ws.cell(r, 6), None, 9.5)
            ws.cell(r, 7).border = self.box
            ws.row_dimensions[r].height = self.est_height(a["text"], 52, 10, 22)
        self.status_format(ws, f"D{r0}:D{r0 + n - 1}")
        return ws, r0 + n + 1

    def short(self, t):
        for m in self.c.MODULES.values():
            if m["title"] == t and m.get("short"):
                return m["short"]
        return t[:20]

    def checklist(self, ws, r, title, items, sub=None, key=None):
        r = self.section(ws, r, 2, 7, title, sub)
        dv = self.status_validation(ws)
        start = r
        for i, t in enumerate(items):
            ws.cell(r, 2, "☐").font = self.font(11, color=self.t["muted"])
            ws.cell(r, 2).alignment = Alignment(horizontal="center", vertical="top")
            ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=5)
            ws.cell(r, 3, t).font = self.font(10)
            ws.cell(r, 3).alignment = Alignment(wrap_text=True, vertical="top")
            st = ws.cell(r, 6)
            self.input(st, "Not started", 9.5, False)
            st.alignment = Alignment(horizontal="center", vertical="top")
            dv.add(st)
            ws.row_dimensions[r].height = self.est_height(t, 84, 10, 22)
            r += 1
        self.status_format(ws, f"F{start}:F{r - 1}")
        return r + 1

    # ------------------------------------------------------------- module content
    def build_m01(self):
        ws, r = self.module_tab("m01")
        r += 1
        r = self.section(ws, r, 2, 7, f"Score yourself through a {self.PRICE} seller's eyes", "Choose Yes, No, or N/A for every item. For every No, write what needs to improve. The module that closes each gap is linked on the right.")
        dv = DataValidation(type="list", formula1='"Yes,No,N/A"', allow_blank=True)
        ws.add_data_validation(dv)
        first = None
        for s in self.c.AUDIT:
            self.merge_text(ws, r, 2, 7, f"{s['num']}  {s['title'].upper()}  ·  {s['question']}", Font(name=BODY, size=9, bold=True, color=self.t["charcoal"]), "taupe_light", height=22)
            r += 1
            self.header_row(ws, r, [3, 4, 5, 7], ["Item", "Response", "If no, what needs to improve?", "Fix in module"], fill="taupe")
            for col in range(2, 8):
                ws.cell(r, col).fill = self.fill["taupe"]
            r += 1
            for it in s["items"]:
                if first is None:
                    first = r
                ws.cell(r, 3, it["label"]).font = self.font(10, True)
                ws.cell(r, 3).alignment = Alignment(vertical="top", wrap_text=True)
                cell = ws.cell(r, 4)
                self.input(cell, None, 10, False)
                cell.alignment = Alignment(horizontal="center", vertical="top")
                dv.add(cell)
                ws.merge_cells(start_row=r, start_column=5, end_row=r, end_column=6)
                self.input(ws.cell(r, 5), None, 9.5)
                ws.cell(r, 6).border = self.box
                fx = self.c.MODULES[it["fix"]]
                lk = ws.cell(r, 7, f"Module {fx['num']}: {fx['title']} →")
                lk.font = Font(name=BODY, size=9, color=self.t["red_dark"], underline="single")
                lk.alignment = Alignment(wrap_text=True, vertical="top")
                self.pending_fix = getattr(self, "pending_fix", [])
                self.pending_fix.append((ws, lk, it["fix"]))
                ws.row_dimensions[r].height = 32
                r += 1
            r += 1
        last = r - 2
        resp = f"$D${first}:$D${last}"
        ws.conditional_formatting.add(resp, CellIsRule(operator="equal", formula=['"Yes"'], fill=self.fill["green_l"], font=Font(color="3F5A3B", bold=True)))
        ws.conditional_formatting.add(resp, CellIsRule(operator="equal", formula=['"No"'], fill=self.fill["red_l"], font=Font(color=self.t["red_dark"], bold=True)))
        r = self.section(ws, r, 2, 7, f"Your {self.PRICE} readiness")
        for col in range(2, 8):
            for rr in range(r, r + 4):
                ws.cell(rr, col).fill = self.fill["espresso"]
        labels = [("Yes", f'=COUNTIF({resp},"Yes")'), ("No", f'=COUNTIF({resp},"No")'), ("N/A", f'=COUNTIF({resp},"N/A")'), ("Scored", f'=(COUNTIF({resp},"Yes")+COUNTIF({resp},"No")+COUNTIF({resp},"N/A"))&" of 10"')]
        for i, (lab, f) in enumerate(labels):
            ws.cell(r, 3 + i if i else 3, None)
        ws.row_dimensions[r].height = 20
        ws.row_dimensions[r + 1].height = 34
        ws.row_dimensions[r + 2].height = 20
        ws.row_dimensions[r + 3].height = 30
        cols = [3, 4, 5, 6]
        for (lab, f), col in zip(labels, cols):
            a = ws.cell(r, col, lab.upper()); a.font = Font(name=BODY, size=8.5, bold=True, color="CDBFB1"); a.alignment = Alignment(horizontal="center")
            b = ws.cell(r + 1, col, f); b.font = Font(name=HEAD, size=18, bold=True, color="FFFFFF"); b.alignment = Alignment(horizontal="center", vertical="center")
        ws.cell(r, 7, "READINESS").font = Font(name=BODY, size=8.5, bold=True, color="CDBFB1")
        ws.cell(r, 7).alignment = Alignment(horizontal="center")
        sc = ws.cell(r + 1, 7, f"=IF(D{r + 1}+E{r + 1}=0,\"\",D{r + 1}/(D{r + 1}+E{r + 1}))".replace("D" + str(r + 1), "D" + str(r + 1)))
        # Yes is in column C? keep explicit references
        yes_cell, no_cell = f"C{r + 1}", f"D{r + 1}"
        sc.value = f'=IF(({yes_cell}+{no_cell})=0,"",{yes_cell}/({yes_cell}+{no_cell}))'
        sc.number_format = "0%"
        sc.font = Font(name=HEAD, size=22, bold=True, color="F6D2CE")
        sc.alignment = Alignment(horizontal="center", vertical="center")
        bands = self.c.AUDIT_BANDS
        band_f = f'=IF((COUNTIF({resp},"Yes")+COUNTIF({resp},"No")+COUNTIF({resp},"N/A"))<10,"Score all 10 items to see your band",IF(G{r + 1}>={bands[0]["min"] / 100},"{bands[0]["name"]}: {bands[0]["text"]}",IF(G{r + 1}>={bands[1]["min"] / 100},"{bands[1]["name"]}: {bands[1]["text"]}","{bands[2]["name"]}: {bands[2]["text"]}")))'
        ws.merge_cells(start_row=r + 3, start_column=3, end_row=r + 3, end_column=7)
        bc = ws.cell(r + 3, 3, band_f)
        bc.font = Font(name=HEAD, size=11, italic=True, color="FFFFFF")
        bc.alignment = Alignment(wrap_text=True, vertical="center")
        self.readiness = f"'{ws.title}'!$G${r + 1}"
        self.audit_resp = f"'{ws.title}'!{resp}"
        r += 5
        bands = self.c.AUDIT_BANDS
        note = ("Readiness = Yes ÷ (Yes + No). N/A items don't count against you. Bands ("
                + " · ".join((f"{x['min']}%+ {x['name']}" if x["min"] else f"below {bands[-2]['min']}% {x['name']}") for x in bands)
                + f") are suggested coaching bands, not an official {self.ORG} standard.")
        self.merge_text(ws, r, 2, 7, note, self.font(9, italic=True, color=self.t["muted"]), height=30)

    def build_m02(self):
        ws, r = self.module_tab("m02")
        m = self.c.MODULES["m02"]
        steps = [b for b in m["blocks"] if b["type"] == "steps"][0]
        r = self.section(ws, r + 1, 2, 7, steps["title"])
        for s in steps["items"]:
            ws.cell(r, 2, s["num"]).font = Font(name=HEAD, size=12, bold=True, color=self.t["red"])
            ws.cell(r, 2).alignment = Alignment(horizontal="center", vertical="top")
            ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=5)
            ws.cell(r, 3, f"{s['title']}: {s['text']}").font = self.font(10)
            ws.cell(r, 3).alignment = Alignment(wrap_text=True, vertical="top")
            res = common.resource(self.c, s["resource"])
            lk = ws.cell(r, 6, self.link_formula(res["url"], res["label"] + " ↗"))
            lk.font = Font(name=BODY, size=9.5, bold=True, color=self.t["red"], underline="single")
            lk.alignment = Alignment(wrap_text=True, vertical="top")
            ws.cell(r, 7, res["access"]).font = self.font(8.5, color=self.t["muted"])
            ws.cell(r, 7).alignment = Alignment(wrap_text=True, vertical="top")
            ws.row_dimensions[r].height = self.est_height(s["text"], 84, 10, 30)
            for col in range(2, 8):
                ws.cell(r, col).border = self.under
            r += 1
        std = [b for b in m["blocks"] if b["type"] == "checklist"][0]
        r = self.checklist(ws, r + 1, std["title"], std["items"])

    def build_m03(self):
        ws, r = self.module_tab("m03")
        f = self.c.ASSISTANT_FLOW
        r = self.section(ws, r + 1, 2, 7, f"Set up {self.AI}'s memory", "Answer both questions. Your next step updates automatically.")
        dv = DataValidation(type="list", formula1='"Yes,No"', allow_blank=True)
        ws.add_data_validation(dv)
        for i, q in enumerate((f["q1"], f["q2"])):
            ws.merge_cells(start_row=r + i, start_column=2, end_row=r + i, end_column=3)
            ws.cell(r + i, 2, q).font = self.font(10.5, True, head=True)
            ws.cell(r + i, 2).alignment = Alignment(vertical="center")
            cell = ws.cell(r + i, 4)
            self.input(cell, None, 10, False)
            cell.alignment = Alignment(horizontal="center", vertical="center")
            dv.add(cell)
            ws.row_dimensions[r + i].height = 24
        q1, q2 = f"D{r}", f"D{r + 1}"
        r += 2
        ws.row_dimensions[r].height = 34
        ws.cell(r, 2, "NEXT STEP").font = self.font(8.5, True, self.t["red_dark"])
        ws.cell(r, 2).alignment = Alignment(vertical="center")
        ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=7)
        nx = ws.cell(r, 3, f'=IF({q1}="","Answer question 1.",IF({q1}="No","{f["no1_title"]}: use the memory prompt below.",IF({q2}="","Answer question 2.",IF({q2}="No","{f["no2_title"]}: use the {self.TIER} prompt below.","{f["ready_title"]} {f["ready_text"]} Next: Module 08."))))')
        nx.font = Font(name=HEAD, size=12, bold=True, color=self.t["charcoal"])
        nx.fill = self.fill["taupe_light"]
        nx.alignment = Alignment(vertical="center", wrap_text=True)
        for col in range(3, 8):
            ws.cell(r, col).fill = self.fill["taupe_light"]
        r += 2
        for b in self.c.MODULES["m03"]["blocks"]:
            if b["type"] != "prompt":
                continue
            r = self.section(ws, r, 2, 7, b["title"], b["desc"] + f" Click the cell, copy, and paste into {self.AI}.")
            ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=7)
            cell = ws.cell(r, 2, b["text"])
            self.input(cell, None, 9.5)
            for col in range(2, 8):
                ws.cell(r, col).border = self.box
            ws.row_dimensions[r].height = min(409, self.est_height(b["text"], 150, 9.5))
            r += 1
            r = self.res_rows(ws, r + 1, [b["resource"]])

    def build_m04(self):
        ws, r = self.module_tab("m04")
        m = self.c.MODULES["m04"]
        blocks = {b["type"] + (b.get("id") or ""): b for b in m["blocks"]}
        crit = [b for b in m["blocks"] if b["type"] == "criteria"][0]
        r = self.section(ws, r + 1, 2, 7, "Step 01 · " + crit["title"], crit["intro"])
        self.header_row(ws, r, [2, 3, 6], ["", "Look for", "See an example"], fill="taupe")
        for col in range(2, 8):
            ws.cell(r, col).fill = self.fill["taupe"]
        r += 1
        for it in crit["items"]:
            res = common.resource(self.c, it["resource"])
            ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=5)
            ws.cell(r, 2, f"{it['title']}: {it['text']}").font = self.font(10)
            ws.cell(r, 2).alignment = Alignment(wrap_text=True, vertical="top")
            lk = ws.cell(r, 6, self.link_formula(res["url"], res["title"] + " ↗"))
            lk.font = Font(name=BODY, size=9.5, bold=True, color=self.t["red"], underline="single")
            lk.alignment = Alignment(wrap_text=True, vertical="top")
            ws.merge_cells(start_row=r, start_column=6, end_row=r, end_column=7)
            ws.row_dimensions[r].height = 30
            for col in range(2, 8):
                ws.cell(r, col).border = self.under
            r += 1
        tbl = [b for b in m["blocks"] if b["type"] == "table"][0]
        r = self.section(ws, r + 1, 2, 7, tbl["title"])
        self.header_row(ws, r, [2, 5], tbl["headers"])
        ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=4)
        ws.merge_cells(start_row=r, start_column=5, end_row=r, end_column=7)
        for col in range(2, 8):
            ws.cell(r, col).fill = self.fill["espresso"]
        r += 1
        for a, b in tbl["rows"]:
            ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=4)
            ws.merge_cells(start_row=r, start_column=5, end_row=r, end_column=7)
            ws.cell(r, 2, a).font = self.font(10)
            ws.cell(r, 5, b).font = self.font(10, True)
            ws.row_dimensions[r].height = 22
            for col in range(2, 8):
                ws.cell(r, col).border = self.under
            r += 1
        facts = [b for b in m["blocks"] if b.get("id") == "m04_facts"][0]
        r = self.checklist(ws, r + 1, "Step 02 · " + facts["title"], facts["items"], facts.get("intro"))
        tpl = [b for b in m["blocks"] if b["type"] == "template"][0]
        r = self.section(ws, r, 2, 7, "Step 03 · " + tpl["title"], tpl["intro"])
        cells = []
        for f in tpl["fields"]:
            ws.cell(r, 2, f["label"].upper()).font = self.font(8.5, True)
            ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
            ws.cell(r, 2).alignment = Alignment(vertical="top", wrap_text=True)
            ws.cell(r + 1, 2, f["guide"]).font = self.font(8.5, italic=True, color=self.t["muted"])
            ws.merge_cells(start_row=r + 1, start_column=2, end_row=r + 1, end_column=3)
            ws.cell(r + 1, 2).alignment = Alignment(vertical="top", wrap_text=True)
            ws.merge_cells(start_row=r, start_column=4, end_row=r + 1, end_column=7)
            self.input(ws.cell(r, 4), None, 10)
            for rr in (r, r + 1):
                for col in range(4, 8):
                    ws.cell(rr, col).border = self.box
            ws.row_dimensions[r].height = 18
            ws.row_dimensions[r + 1].height = max(26, 14 * f["lines"] + 8, self.est_height(f["guide"], 58, 8.5) - 18)
            cells.append(f"D{r}")
            r += 2
        wc = "+".join(f'IF(LEN(TRIM({c}))=0,0,LEN(TRIM({c}))-LEN(SUBSTITUTE(TRIM({c})," ",""))+1)' for c in cells)
        ws.cell(r, 2, "WORD COUNT").font = self.font(8.5, True, self.t["muted"])
        w = ws.cell(r, 4, f"={wc}")
        w.font = Font(name=HEAD, size=13, bold=True, color=self.t["red_dark"])
        w.alignment = Alignment(horizontal="center")
        ws.cell(r, 5, "Target: about 200 words").font = self.font(9, italic=True, color=self.t["muted"])
        r += 2
        chk = [b for b in m["blocks"] if b.get("id") == "m04_checks"][0]
        r = self.checklist(ws, r, "Step 04 · " + chk["title"], chk["items"])
        x = self.c.CASE_EXAMPLE
        r = self.section(ws, r, 2, 7, "Example · A completed case study", x["note"])
        rows = [("Headline", x["headline"]), ("Numbers", "  ·  ".join(f"{k}: {v}" for k, v in x["stats"])), ("The Challenge", x["challenge"]),
                ("The Strategy", "\n".join(f"{i + 1}. {t} {d}" for i, (t, d) in enumerate(x["strategy"]))), ("The Result", x["result"]), ("In the Seller's Words", "“" + x["quote"] + "”")]
        for lab, val in rows:
            ws.cell(r, 2, lab.upper()).font = self.font(8.5, True, self.t["muted"])
            ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
            ws.merge_cells(start_row=r, start_column=4, end_row=r, end_column=7)
            ws.cell(r, 4, val).font = self.font(9.5, lab == "Headline")
            ws.cell(r, 4).alignment = Alignment(wrap_text=True, vertical="top")
            ws.row_dimensions[r].height = self.est_height(val, 80, 9.5, 20)
            for col in range(2, 8):
                ws.cell(r, col).border = self.under
            r += 1
        self.res_rows(ws, r + 1, [it["resource"] for it in crit["items"] if it.get("resource")])

    def build_m05(self):
        ws, r = self.module_tab("m05")
        m = self.c.MODULES["m05"]
        vp = [b for b in m["blocks"] if b["type"] == "builder"][0]
        r = self.section(ws, r + 1, 2, 7, vp["title"], vp["intro"] + "  Formula: " + vp["formula"])
        refs = {}
        for f in vp["fields"]:
            ws.cell(r, 2, f["label"].upper()).font = self.font(8.5, True)
            ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
            ws.cell(r, 2).value = f"{f['label'].upper()}  ·  {f['guide']}"
            ws.cell(r, 2).alignment = Alignment(wrap_text=True, vertical="center")
            ws.merge_cells(start_row=r, start_column=4, end_row=r, end_column=7)
            self.input(ws.cell(r, 4), None, 10)
            for col in range(4, 8):
                ws.cell(r, col).border = self.box
            ws.row_dimensions[r].height = 30
            refs[f["id"]] = f"D{r}"
            r += 1
        r += 1
        ws.cell(r, 2, f"YOUR {self.TIER.upper()} VALUE PROP").font = Font(name=BODY, size=8.5, bold=True, color="CDBFB1")
        for col in range(2, 8):
            ws.cell(r, col).fill = self.fill["espresso"]
            ws.cell(r + 1, col).fill = self.fill["espresso"]
        ws.merge_cells(start_row=r + 1, start_column=2, end_row=r + 1, end_column=7)

        def ref(k, ph):
            return f'IF({refs[k]}="","{ph}",{refs[k]})'
        sent = f'="I help "&{ref("vp_who", "[who]")}&" in "&{ref("vp_where", "[where]")}&" "&{ref("vp_what", "[achieve what]")}&" through "&{ref("vp_how", "[how]")}&", proven by "&{ref("vp_proof", "[your result]")}&"."'
        sc = ws.cell(r + 1, 2, sent)
        sc.font = Font(name=HEAD, size=13, color="FFFFFF")
        sc.alignment = Alignment(wrap_text=True, vertical="center")
        ws.row_dimensions[r + 1].height = 48
        r += 3
        talk = [b for b in m["blocks"] if b["type"] == "talk"][0]
        r = self.section(ws, r, 2, 7, talk["title"], talk["intro"])
        self.header_row(ws, r, [2, 3, 5], ["Time", "Beat", "Your notes"])
        ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=4)
        ws.merge_cells(start_row=r, start_column=5, end_row=r, end_column=7)
        for col in range(2, 8):
            ws.cell(r, col).fill = self.fill["espresso"]
        r += 1
        for b in talk["beats"]:
            ws.cell(r, 2, b["time"]).font = self.font(8.5, True, self.t["red_dark"])
            ws.cell(r, 2).alignment = Alignment(vertical="top", wrap_text=True)
            ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=4)
            ws.cell(r, 3, f"{b['title']}: {b['text']}").font = self.font(9.5)
            ws.cell(r, 3).alignment = Alignment(wrap_text=True, vertical="top")
            ws.merge_cells(start_row=r, start_column=5, end_row=r, end_column=7)
            self.input(ws.cell(r, 5), None, 9.5)
            for col in range(5, 8):
                ws.cell(r, col).border = self.box
            ws.row_dimensions[r].height = 44
            r += 1
        mat = [b for b in m["blocks"] if b.get("id") == "m05_mat"][0]
        self.checklist(ws, r + 1, mat["title"], mat["items"])

    def build_m06(self):
        ws, r = self.module_tab("m06")
        m = self.c.MODULES["m06"]
        steps = [b for b in m["blocks"] if b["type"] == "steps"][0]
        r = self.section(ws, r + 1, 2, 7, steps["title"])
        for s in steps["items"]:
            ws.cell(r, 2, s["num"]).font = Font(name=HEAD, size=12, bold=True, color=self.t["red"])
            ws.cell(r, 2).alignment = Alignment(horizontal="center", vertical="top")
            ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=7)
            ws.cell(r, 3, f"{s['title']}: {s['text']}").font = self.font(10)
            ws.cell(r, 3).alignment = Alignment(wrap_text=True, vertical="top")
            ws.row_dimensions[r].height = self.est_height(s["title"] + s["text"], 130, 10, 22)
            for col in range(2, 8):
                ws.cell(r, col).border = self.under
            r += 1
        r = self.section(ws, r + 1, 2, 7, "Your two-touch mail sequence", "Copy the note into your notecard, then personalize every bracket.")
        for t in self.c.TOUCHES:
            ws.cell(r, 2, t["tag"].upper()).font = Font(name=BODY, size=8.5, bold=True, color="FFFFFF")
            ws.cell(r, 2).fill = self.fill["red"]
            ws.cell(r, 2).alignment = Alignment(wrap_text=True, vertical="top", horizontal="center")
            ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=7)
            ws.cell(r, 3, f"{t['title']} ({t['when']}): {t['text']}").font = self.font(10, True)
            ws.cell(r, 3).alignment = Alignment(wrap_text=True, vertical="top")
            ws.row_dimensions[r].height = 30
            r += 1
            ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=7)
            nc = ws.cell(r, 3, t["note"])
            nc.font = Font(name=HEAD, size=10.5, italic=True, color="2B2B3A")
            nc.fill = self.fill["paper"]
            nc.alignment = Alignment(wrap_text=True, vertical="top")
            for col in range(3, 8):
                ws.cell(r, col).fill = self.fill["paper"]
                ws.cell(r, col).border = self.box
            ws.row_dimensions[r].height = self.est_height(t["note"], 120, 10.5, 30)
            r += 2
        r = self.section(ws, r, 2, 7, "Expired outreach tracker", "Enter the Touch 1 date; the Touch 2 window (10–14 days later) calculates for you. Row 1 is a fictional example; overwrite it.")
        hdr = ["#", "Property address", "Owner verified", "Touch 1 sent", "Touch 2 window", "Response / next step"]
        self.header_row(ws, r, [2, 3, 4, 5, 6, 7], hdr)
        r += 1
        ex = ["Example: 1 Sample Ridge Rd (fictional)", "Yes", "=DATE(2026,11,12)", "", "Relaunch proposal ready; awaiting text"]
        yn = DataValidation(type="list", formula1='"Yes,No"', allow_blank=True)
        ws.add_data_validation(yn)
        for i in range(8):
            rr = r + i
            ws.cell(rr, 2, i + 1).font = self.font(9, True, self.t["muted"], head=True)
            ws.cell(rr, 2).alignment = Alignment(horizontal="center")
            for col in (3, 4, 5, 7):
                self.input(ws.cell(rr, col), None, 9.5, col in (3, 7))
            yn.add(ws.cell(rr, 4))
            ws.cell(rr, 5).number_format = "mmm d, yyyy"
            w = ws.cell(rr, 6, f'=IF(E{rr}="","",TEXT(E{rr}+10,"mmm d")&" – "&TEXT(E{rr}+14,"mmm d"))')
            w.font = self.font(9.5, True, self.t["red_dark"])
            w.fill = self.fill["taupe_light"]
            w.border = self.box
            ws.row_dimensions[rr].height = 22
            if i == 0:
                ws.cell(rr, 3).value = ex[0]
                ws.cell(rr, 4).value = ex[1]
                ws.cell(rr, 5).value = ex[2]
                ws.cell(rr, 7).value = ex[4]
                for col in (3, 4, 5, 7):
                    ws.cell(rr, col).font = self.font(9.5, italic=True, color=self.t["muted"])
        self.expired_range = (f"'{ws.title}'!$E${r + 1}:$E${r + 7}")
        r += 9
        tips = [b for b in m["blocks"] if b["type"] == "tips"][0]
        r = self.section(ws, r, 2, 7, tips["title"], "  ·  ".join(t["text"] for t in tips["items"]))
        self.res_rows(ws, r, [t["resource"] for t in tips["items"] if t.get("resource")])

    def build_m07(self):
        ws, r = self.module_tab("m07")
        m = self.c.MODULES["m07"]
        steps = [b for b in m["blocks"] if b["type"] == "steps"][0]
        r = self.section(ws, r + 1, 2, 7, steps["title"])
        for s in steps["items"]:
            ws.cell(r, 2, s["num"]).font = Font(name=HEAD, size=12, bold=True, color=self.t["red"])
            ws.cell(r, 2).alignment = Alignment(horizontal="center", vertical="top")
            ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=7)
            ws.cell(r, 3, f"{s['title']}: {s['text']}").font = self.font(10)
            ws.cell(r, 3).alignment = Alignment(wrap_text=True, vertical="top")
            ws.row_dimensions[r].height = self.est_height(s["text"], 130, 10, 22)
            r += 1
        chips = [b for b in m["blocks"] if b["type"] == "chips"][0]
        r = self.section(ws, r + 1, 2, 7, chips["title"], chips["intro"] + "  " + "  ·  ".join(chips["items"]))
        em = [b for b in m["blocks"] if b["type"] == "email"][0]
        r = self.section(ws, r, 2, 7, em["title"], "Subject: " + em["subject"])
        ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=7)
        cell = ws.cell(r, 2, em["body"])
        self.input(cell, None, 10)
        for col in range(2, 8):
            ws.cell(r, col).border = self.box
        ws.row_dimensions[r].height = self.est_height(em["body"], 150, 10)
        r += 2
        cards = [b for b in m["blocks"] if b["type"] == "cards"][0]
        r = self.section(ws, r, 2, 7, cards["title"], cards["intro"])
        for x in cards["items"]:
            ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
            ws.cell(r, 2, x["title"]).font = self.font(10, True, head=True)
            ws.merge_cells(start_row=r, start_column=4, end_row=r, end_column=7)
            ws.cell(r, 4, x["text"]).font = self.font(10)
            ws.cell(r, 4).alignment = Alignment(wrap_text=True, vertical="top")
            ws.row_dimensions[r].height = 30
            for col in range(2, 8):
                ws.cell(r, col).border = self.under
            r += 1
        r = self.section(ws, r + 1, 2, 7, "Referral partner pipeline", "Row 1 is a fictional example; overwrite it.")
        self.header_row(ws, r, [2, 3, 4, 5, 6, 7], ["#", "Name & firm", "Type", "Outreach sent", "Meeting date", "Value delivered / next step"])
        r += 1
        types = DataValidation(type="list", formula1='"' + ",".join(chips["items"]) + '"', allow_blank=True)
        ws.add_data_validation(types)
        for i in range(10):
            rr = r + i
            ws.cell(rr, 2, i + 1).font = self.font(9, True, self.t["muted"], head=True)
            ws.cell(rr, 2).alignment = Alignment(horizontal="center")
            for col in range(3, 8):
                self.input(ws.cell(rr, col), None, 9.5, col in (3, 7))
            types.add(ws.cell(rr, 4))
            ws.cell(rr, 5).number_format = "mmm d, yyyy"
            ws.cell(rr, 6).number_format = "mmm d, yyyy"
            ws.row_dimensions[rr].height = 22
            if i == 0:
                vals = {3: "Example: Jordan Sample, Sample Wealth Partners (fictional)", 4: "Wealth Managers", 5: "=DATE(2026,11,13)", 7: "Offer annual home-value review for top clients"}
                for col, v in vals.items():
                    ws.cell(rr, col).value = v
                    ws.cell(rr, col).font = self.font(9.5, italic=True, color=self.t["muted"])
        self.meeting_range = f"'{ws.title}'!$F${r + 1}:$F${r + 9}"
        self.outreach_range = f"'{ws.title}'!$E${r + 1}:$E${r + 9}"

    def build_m08(self):
        ws, r = self.module_tab("m08")
        r = self.section(ws, r + 1, 2, 7, f"Three prompts to mine your {self.TIER} pipeline", f"Enter your {self.TIER} price point once. Every prompt below fills it in; click a prompt cell, copy, paste into {self.AI}.")
        ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
        ws.cell(r, 2, f"MY {self.TIER.upper()} PRICE POINT").font = Font(name=BODY, size=9, bold=True, color="FFFFFF")
        for col in range(2, 8):
            ws.cell(r, col).fill = self.fill["espresso"]
        price = ws.cell(r, 4)
        self.input(price, "$5,000,000", 11, False)
        ws.cell(r, 5, "← edit this").font = Font(name=BODY, size=9, italic=True, color="CDBFB1")
        ws.row_dimensions[r].height = 26
        pref = f"$D${r}"
        r += 2
        for p in self.c.PIPELINE_PROMPTS:
            ws.cell(r, 2, p["title"].upper()).font = self.font(9.5, True)
            ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
            ws.merge_cells(start_row=r, start_column=4, end_row=r, end_column=7)
            ws.cell(r, 4, p["desc"]).font = self.font(9.5, italic=True, color=self.t["muted"])
            for col in range(2, 8):
                ws.cell(r, col).border = self.redline
            r += 1
            ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=7)
            txt = p["text"].replace('"', '""')
            cell = ws.cell(r, 2, f'=SUBSTITUTE("{txt}","[$X]",IF({pref}="","[$X]",{pref}))')
            self.input(cell, None, 9.5)
            for col in range(2, 8):
                ws.cell(r, col).border = self.box
            ws.row_dimensions[r].height = self.est_height(p["text"], 150, 9.5)
            r += 2
        pp = [b for b in self.c.MODULES["m08"]["blocks"] if b["type"] == "pipeline_prompts"]
        if pp and pp[0].get("resource"):
            r = self.res_rows(ws, r, [pp[0]["resource"]])
        r = self.section(ws, r, 2, 7, "Weekly pipeline log", "Run all three prompts each week and log what you act on. Row 1 is a fictional example.")
        self.header_row(ws, r, [2, 3, 4, 5, 6, 7], ["Wk", "Top opportunities found", "Week of", "# found", "Follow-ups sent", "Next best action"])
        r += 1
        for i in range(8):
            rr = r + i
            ws.cell(rr, 2, i + 1).font = self.font(9, True, self.t["muted"], head=True)
            ws.cell(rr, 2).alignment = Alignment(horizontal="center")
            for col in range(3, 8):
                self.input(ws.cell(rr, col), None, 9.5, col in (3, 7))
            ws.cell(rr, 4).number_format = "mmm d, yyyy"
            ws.row_dimensions[rr].height = 22
            if i == 0:
                for col, v in {3: f"Example: 3 move-up buyers viewing {self.PRICE}+ homes (fictional)", 4: "=DATE(2026,11,16)", 5: 3, 6: 2, 7: "Call the two with tours this week"}.items():
                    ws.cell(rr, col).value = v
                    ws.cell(rr, col).font = self.font(9.5, italic=True, color=self.t["muted"])

    # ------------------------------------------------------------- other tabs
    def build_commitments(self):
        ws = self.wb.create_sheet("My 3 Commitments")
        self.setup(ws, self.WIDTHS, 60, self.t["red"])
        cm = self.c.COMMITMENTS
        self.banner(ws, 8, "Close the session", cm["title"], cm["question"])
        r = 7
        for lab, val, name in (("Agent Name", None, "agent"), ("Manager Name", self.c.BRAND["manager_name"], "manager")):
            ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
            ws.cell(r, 2, lab + ":").font = Font(name=HEAD, size=11, italic=True, color=self.t["charcoal"])
            ws.merge_cells(start_row=r, start_column=4, end_row=r, end_column=6)
            self.input(ws.cell(r, 4), val, 11, False)
            for col in range(4, 7):
                ws.cell(r, col).border = self.box
            ws.row_dimensions[r].height = 24
            setattr(self, "cm_" + name, f"'{ws.title}'!$D${r}")
            r += 1
        r += 1
        self.merge_text(ws, r, 2, 7, cm["guide"], self.font(10, italic=True, color=self.t["muted"]), height=20)
        r += 1
        self.header_row(ws, r, [2, 3, 6, 7], ["#", "Commitment", "By when", "Status"])
        ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=5)
        for col in range(2, 8):
            ws.cell(r, col).fill = self.fill["espresso"]
        r += 1
        dv = self.status_validation(ws)
        self.cm_rows = []
        for i in (1, 2, 3):
            ws.cell(r, 2, f"{i}.").font = Font(name=HEAD, size=20, bold=True, italic=True, color=self.t["charcoal"])
            ws.cell(r, 2).alignment = Alignment(horizontal="center", vertical="center")
            ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=5)
            self.input(ws.cell(r, 3), None, 10.5)
            for col in range(3, 6):
                ws.cell(r, col).border = self.box
            self.input(ws.cell(r, 6), None, 10, False, "mmm d, yyyy")
            st = ws.cell(r, 7)
            self.input(st, "Not started", 10, False)
            dv.add(st)
            ws.row_dimensions[r].height = 46
            self.cm_rows.append(r)
            r += 1
        self.status_format(ws, f"G{self.cm_rows[0]}:G{self.cm_rows[-1]}")
        self.cm_sheet = ws.title
        r += 1
        r = self.section(ws, r, 2, 7, "Need ideas? Try one of these")
        for ex in cm["examples"]:
            ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=7)
            ws.cell(r, 2, "•  " + ex).font = self.font(10)
            ws.row_dimensions[r].height = 20
            r += 1
        r += 1
        self.merge_text(ws, r, 2, 7, "Agent signature: ______________________________      Manager signature: ______________________________", self.font(10, italic=True, color=self.t["muted"], head=True), height=26)

    def build_team(self):
        ws = self.wb.create_sheet("Team Tracker")
        widths = [2.5, 24, 12, 11, 12] + [7.5] * 8 + [9, 10, 30, 30, 30, 12, 26, 2.5]
        self.setup(ws, widths, 60, self.t["charcoal"])
        last = len(widths)
        self.banner(ws, last, "Manager view", "Team Tracker", "One row per agent. Track phase, readiness, every module, and their 3 commitments.")
        r = 7
        hdr = ["Agent", "Start date", "Readiness %", "Current phase"] + [self.c.MODULES[mid]["num"] for mid in common.module_order(self.c)] + ["Modules done", "% complete", "Commitment 1", "Commitment 2", "Commitment 3", "Next 1:1", "Coaching notes"]
        cols = list(range(2, 2 + len(hdr)))
        self.header_row(ws, r, cols, hdr)
        ws.row_dimensions[r].height = 34
        for c in cols:
            ws.cell(r, c).alignment = Alignment(wrap_text=True, vertical="center", horizontal="center" if c > 2 else "left")
        r += 1
        mods = common.module_order(self.c)
        mdv = DataValidation(type="list", formula1='"' + ",".join(STATUS) + '"', allow_blank=True)
        pdv = DataValidation(type="list", formula1='"' + ",".join(p["name"] for p in self.c.PHASES) + ',Complete"', allow_blank=True)
        ws.add_data_validation(mdv)
        ws.add_data_validation(pdv)
        first = r
        for i in range(25):
            rr = r + i
            for c in cols:
                ws.cell(rr, c).border = self.box
                ws.cell(rr, c).fill = self.fill["white"]
                ws.cell(rr, c).font = self.font(9.5)
                ws.cell(rr, c).alignment = Alignment(vertical="center", wrap_text=c in (16, 17, 18, 20))
            ws.cell(rr, 3).number_format = "mmm d, yyyy"
            ws.cell(rr, 4).number_format = "0%"
            pdv.add(ws.cell(rr, 5))
            for j in range(len(mods)):
                mdv.add(ws.cell(rr, 6 + j))
                ws.cell(rr, 6 + j).alignment = Alignment(horizontal="center", vertical="center")
            ml, mr_ = get_column_letter(6), get_column_letter(5 + len(mods))
            done = ws.cell(rr, 14, f'=IF($B{rr}="","",COUNTIF({ml}{rr}:{mr_}{rr},"Done"))')
            done.alignment = Alignment(horizontal="center", vertical="center")
            pct = ws.cell(rr, 15, f'=IF($B{rr}="","",N14/{len(mods)})'.replace("N14", f"N{rr}"))
            pct.number_format = "0%"
            pct.font = self.font(10, True, self.t["red_dark"])
            pct.alignment = Alignment(horizontal="center", vertical="center")
            ws.cell(rr, 19).number_format = "mmm d, yyyy"
            ws.row_dimensions[rr].height = 22
        ex = {2: "Example Agent (fictional)", 3: "=DATE(2026,11,11)", 4: 0.6, 5: "Prepare", 6: "Done", 7: "In progress", 16: "Publish first case study by Dec 5", 17: "Touch 1 to 3 expireds by Fri", 18: "Email 5 wealth advisors this month", 19: "=DATE(2026,11,18)", 20: "Strong audit; needs case study + headshot"}
        for c, v in ex.items():
            ws.cell(first, c).value = v
            ws.cell(first, c).font = self.font(9.5, italic=True, color=self.t["muted"])
        rng = f"{get_column_letter(6)}{first}:{get_column_letter(5 + len(mods))}{first + 24}"
        self.status_format(ws, rng)
        ws.conditional_formatting.add(f"O{first}:O{first + 24}", FormulaRule(formula=[f'AND(ISNUMBER(O{first}),O{first}=1)'], fill=self.fill["green_l"]))
        ws.freeze_panes = ws.cell(first, 3)
        self.team_sheet = ws.title
        self.team_first = first
        r = first + 26
        self.merge_text(ws, r, 2, 13, f"How to use: add each agent's name in column B; pick a status for each module (01–08); enter their {self.PRICE} Audit readiness from their copy. Modules done and % complete calculate automatically. Row 1 is a fictional example; overwrite it.", self.font(9, italic=True, color=self.t["muted"]), height=30)

    def build_resources(self):
        ws = self.wb.create_sheet("Resources")
        widths = [2.5, 15, 14, 34, 46, 18, 26, 2.5]
        self.setup(ws, widths, 60, self.t["red_dark"])
        self.banner(ws, 8, "Resource library", "Every QR code, one click away", "All links from the printed worksheets, decoded and verified.")
        r = 7
        self.header_row(ws, r, [2, 3, 4, 5, 6, 7], ["QR code", "Module", "Resource", "What it is", "Open", "Access"])
        r += 1
        os.makedirs(self.tmp, exist_ok=True)
        for mid in common.module_order(self.c):
            for rid, res in self.c.RESOURCES.items():
                if res.get("module") != mid or not res.get("url"):
                    continue
                ws.row_dimensions[r].height = 74
                png = common.qr_png(res["url"], os.path.join(self.tmp, f"qr_{rid}.png"), 300)
                img = XLImage(png)
                img.width = img.height = 88
                ws.add_image(img, f"B{r}")
                mc = ws.cell(r, 3, f"Module {self.c.MODULES[mid]['num']}")
                mc.font = self.font(9.5, True, self.t["red_dark"], underline=None) if False else self.font(9.5, True, self.t["red_dark"])
                self.internal(ws, mc, self.tabs[mid])
                ws.cell(r, 4, f"{res['label']}\n{res['title']}").font = self.font(10, True, head=True)
                ws.cell(r, 5, res["desc"]).font = self.font(9.5)
                lk = ws.cell(r, 6, self.link_formula(res["url"], "Open link ↗"))
                lk.font = Font(name=BODY, size=10, bold=True, color=self.t["red"], underline="single")
                ws.cell(r, 7, res["access"]).font = self.font(9, color=self.t["muted"])
                for c in range(2, 8):
                    ws.cell(r, c).alignment = Alignment(wrap_text=True, vertical="center")
                    ws.cell(r, c).border = self.under
                r += 1
        r += 1
        self.merge_text(ws, r, 2, 7, self.c.PHOTO_CREDIT + f" Links marked {self.ORG} sign-in open with your {self.ORG} Google account or intranet login.", self.font(9, italic=True, color=self.t["muted"]), height=24)

    def build_howto(self):
        ws = self.wb.create_sheet("How To Use", 1)
        self.setup(ws, self.WIDTHS, 60, self.t["taupe"])
        b = self.c.BRAND
        self.banner(ws, 8, "Start here", "How to use your dashboard", b["tagline"])
        r = 7
        steps = [
            ("Make your own copy", "In Google Sheets: File → Make a copy. In Excel: save a copy with your name in the file name."),
            ("Start on the Dashboard", f"It shows your overall progress, your {self.PRICE} readiness, every module's status, and your next best step."),
            ("Work each module tab in order", "Tabs 01–08 follow Prepare → Present → Win. Set each action's status to Done as you finish it; progress updates everywhere."),
            ("Use the links", "Every QR code from the printed worksheets is a clickable link here, in the PDF workbook, and in the web workflow."),
            ("Close with My 3 Commitments", "Write three specific commitments and review them with your manager at your next 1:1."),
        ]
        r = self.section(ws, r, 2, 7, "Five steps")
        for i, (t, d) in enumerate(steps):
            ws.cell(r, 2, i + 1).font = Font(name=HEAD, size=14, bold=True, color=self.t["red"])
            ws.cell(r, 2).alignment = Alignment(horizontal="center", vertical="top")
            ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=7)
            ws.cell(r, 3, f"{t}: {d}").font = self.font(10.5)
            ws.cell(r, 3).alignment = Alignment(wrap_text=True, vertical="top")
            ws.row_dimensions[r].height = 32
            r += 1
        r = self.section(ws, r + 1, 2, 7, "Legend")
        legend = [("white", "White cell with a border", "Type here (inputs, notes, dates, dropdowns)."),
                  ("taupe_light", "Shaded cell", "Calculated for you. Don't overwrite."),
                  ("green_l", "Green status", "Done"), ("amber_l", "Amber status", "In progress"),
                  ("paper", "Italic grey row", "Fictional example row in each tracker; overwrite it.")]
        for fill, lab, d in legend:
            cell = ws.cell(r, 2)
            cell.fill = self.fill[fill]
            cell.border = self.box
            ws.cell(r, 3, lab).font = self.font(10, True)
            ws.merge_cells(start_row=r, start_column=4, end_row=r, end_column=7)
            ws.cell(r, 4, d).font = self.font(10)
            ws.row_dimensions[r].height = 20
            r += 1
        r = self.section(ws, r + 1, 2, 7, "The other two tools")
        d = self.c.DELIVERABLES
        for lab, url, desc in (("Web workflow", d.get("web") or d.get("folder"), "Interactive, step-by-step version with live audit scoring and copy buttons."),
                               ("PDF workbook", d.get("pdf") or d.get("folder"), "Fillable, clickable PDF of the full program."),
                               ("Program folder", d.get("folder"), "All three files in one place.")):
            ws.cell(r, 3, lab).font = self.font(10, True)
            if url:
                lk = ws.cell(r, 4, self.link_formula(url, "Open ↗"))
                lk.font = Font(name=BODY, size=10, bold=True, color=self.t["red"], underline="single")
            else:
                ws.cell(r, 4, "Link from your manager").font = self.font(9.5, italic=True, color=self.t["muted"])
            ws.merge_cells(start_row=r, start_column=5, end_row=r, end_column=7)
            ws.cell(r, 5, desc).font = self.font(9.5, color=self.t["muted"])
            ws.cell(r, 5).alignment = Alignment(wrap_text=True)
            ws.row_dimensions[r].height = 22
            r += 1

    def build_dashboard(self):
        ws = self.wb.active
        ws.title = "Dashboard"
        widths = [2.5, 6, 34, 12, 14, 9, 9, 11, 24, 14, 14, 30, 2.5]
        self.setup(ws, widths, 70, self.t["red"])
        last = len(widths)
        b = self.c.BRAND
        self.banner(ws, last, "Agent onboarding dashboard", b["program"], b["tagline"] + "  " + b["subtitle"], back=False)
        r = 7
        # agent info
        info = [("AGENT", None, "agent"), ("MANAGER", None, "manager"), ("START DATE", None, "start")]
        ws.row_dimensions[r].height = 22
        ws.cell(r, 2, "AGENT").font = self.font(8.5, True, self.t["muted"])
        ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=3)
        self.input(ws.cell(r, 3), f"=IF({self.cm_agent}=\"\",\"Type your name on My 3 Commitments\",{self.cm_agent})", 11, False)
        ws.cell(r, 3).fill = self.fill["taupe_light"]
        ws.cell(r, 4, "MANAGER").font = self.font(8.5, True, self.t["muted"])
        ws.merge_cells(start_row=r, start_column=5, end_row=r, end_column=6)
        mc = ws.cell(r, 5, f"={self.cm_manager}")
        self.input(mc, None, 10, False)
        mc.fill = self.fill["taupe_light"]
        ws.cell(r, 8, "START DATE").font = self.font(8.5, True, self.t["muted"])
        self.input(ws.cell(r, 9), None, 10, False, "mmm d, yyyy")
        r += 2
        # KPI tiles
        mods = common.module_order(self.c)
        total_actions = sum(len(self.c.MODULES[m]["actions"]) for m in mods)
        done_sum = "+".join(f'COUNTIF({self.done[m][0]},"Done")' for m in mods)
        tiles = [
            ("OVERALL PROGRESS", f"=({done_sum})/{total_actions}", "0%", f'=({done_sum})&" of {total_actions} actions done"'),
            (f"{self.PRICE.upper()} READINESS", f'=IF({self.readiness}="","—",{self.readiness})', "0%", f'=(COUNTIF({self.audit_resp},"Yes")+COUNTIF({self.audit_resp},"No")+COUNTIF({self.audit_resp},"N/A"))&" of 10 audit items scored"'),
            ("MODULES COMPLETE", "=" + "+".join(f"IF({self.pct[m]}=1,1,0)" for m in mods), "0", f'="of {len(mods)} modules"'),
            ("EXPIRED TOUCHES", f"=COUNT({self.expired_range})", "0", '="Touch 1 notes mailed"'),
            ("REFERRAL MEETINGS", f"=COUNT({self.meeting_range})", "0", f'=COUNT({self.outreach_range})&" outreach emails sent"'),
            ("COMMITMENTS", f"=COUNTA('{self.cm_sheet}'!C{self.cm_rows[0]}:C{self.cm_rows[-1]})", "0", f"=COUNTIF('{self.cm_sheet}'!G{self.cm_rows[0]}:G{self.cm_rows[-1]},\"Done\")&\" of 3 done\""),
        ]
        spans = [(2, 3), (4, 5), (6, 8), (9, 9), (10, 11), (12, 12)]
        for (lab, f, fmt, sub), (c1, c2) in zip(tiles, spans):
            for rr in range(r, r + 4):
                for c in range(c1, c2 + 1):
                    ws.cell(rr, c).fill = self.fill["espresso"]
            for rr in (r, r + 1, r + 2):
                if c2 > c1:
                    ws.merge_cells(start_row=rr, start_column=c1, end_row=rr, end_column=c2)
            a = ws.cell(r, c1, lab); a.font = Font(name=BODY, size=8, bold=True, color="CDBFB1"); a.alignment = Alignment(horizontal="center", vertical="bottom")
            v = ws.cell(r + 1, c1, f); v.font = Font(name=HEAD, size=24, bold=True, color="FFFFFF"); v.number_format = fmt; v.alignment = Alignment(horizontal="center", vertical="center")
            s = ws.cell(r + 2, c1, sub); s.font = Font(name=BODY, size=8.5, color="E6DCCF"); s.alignment = Alignment(horizontal="center", vertical="top", wrap_text=True)
            for c in range(c1, c2 + 1):
                ws.cell(r + 3, c).fill = self.fill["red"]
        ws.row_dimensions[r].height = 22
        ws.row_dimensions[r + 1].height = 40
        ws.row_dimensions[r + 2].height = 26
        ws.row_dimensions[r + 3].height = 3
        overall = f"B{r + 1}"
        r += 5
        # phase progress
        r = self.section(ws, r, 2, last - 1, "Phase progress")
        for p in self.c.PHASES:
            n = sum(len(self.c.MODULES[m]["actions"]) for m in p["modules"])
            f = "=(" + "+".join(f'COUNTIF({self.done[m][0]},"Done")' for m in p["modules"]) + f")/{n}"
            ws.cell(r, 2, p["num"]).font = Font(name=HEAD, size=14, bold=True, color=self.t["red"])
            ws.cell(r, 2).alignment = Alignment(horizontal="center", vertical="center")
            ws.cell(r, 3, f"{p['name'].upper()}  ·  {p['title']}").font = self.font(9.5, True)
            ws.cell(r, 3).alignment = Alignment(wrap_text=True, vertical="center")
            pc = ws.cell(r, 4, f)
            pc.number_format = "0%"
            pc.font = Font(name=HEAD, size=13, bold=True, color=self.t["red_dark"])
            pc.alignment = Alignment(horizontal="center", vertical="center")
            ws.merge_cells(start_row=r, start_column=5, end_row=r, end_column=9)
            bar = ws.cell(r, 5, f'=REPT("█",ROUND(D{r}*30,0))&REPT("░",30-ROUND(D{r}*30,0))')
            bar.font = Font(name=BODY, size=11, color=self.t["red"])
            bar.alignment = Alignment(vertical="center")
            ws.row_dimensions[r].height = 30
            for c in range(2, last):
                ws.cell(r, c).border = self.under
            r += 1
        r += 1
        # module table
        r = self.section(ws, r, 2, last - 1, "Your modules", "Set statuses on each module tab; this table updates automatically. Click Open to jump to a module.")
        hdr = ["#", "Module", "Phase", "Time", "Actions", "Done", "Progress", "", "Status", "Open tab", "Key resource"]
        self.header_row(ws, r, list(range(2, 13)), hdr)
        ws.merge_cells(start_row=r, start_column=8, end_row=r, end_column=9)
        r += 1
        first = r
        for mid in mods:
            m = self.c.MODULES[mid]
            p = common.phase_of(self.c, mid)
            ws.cell(r, 2, m["num"]).font = Font(name=HEAD, size=11, bold=True, color=self.t["red"])
            ws.cell(r, 2).alignment = Alignment(horizontal="center", vertical="center")
            ws.cell(r, 3, m["title"]).font = self.font(10, True)
            ws.cell(r, 4, p["name"]).font = self.font(9.5, color=self.t["muted"])
            ws.cell(r, 5, m["time"]).font = self.font(9, color=self.t["muted"])
            ws.cell(r, 6, self.done[mid][1]).font = self.font(10)
            ws.cell(r, 7, f'=COUNTIF({self.done[mid][0]},"Done")').font = self.font(10, True)
            pc = ws.cell(r, 8, f"={self.pct[mid]}")
            pc.number_format = "0%"
            pc.font = self.font(10, True, self.t["red_dark"])
            bar = ws.cell(r, 9, f'=REPT("█",ROUND(H{r}*12,0))&REPT("░",12-ROUND(H{r}*12,0))')
            bar.font = Font(name=BODY, size=9, color=self.t["red"])
            st = ws.cell(r, 10, f'=IF(H{r}=0,"Not started",IF(H{r}=1,"Complete","In progress"))')
            st.font = self.font(9.5, True)
            st.alignment = Alignment(horizontal="center", vertical="center")
            op = ws.cell(r, 11, "Open →")
            op.font = Font(name=BODY, size=10, bold=True, color=self.t["red"], underline="single")
            op.alignment = Alignment(horizontal="center", vertical="center")
            self.internal(ws, op, self.tabs[mid])
            if m.get("key_resource"):
                res = common.resource(self.c, m["key_resource"])
                kr = ws.cell(r, 12, self.link_formula(res["url"], res["label"] + " ↗"))
                kr.font = Font(name=BODY, size=9.5, color=self.t["red_dark"], underline="single")
            ws.cell(r, 14, f"=IF(H{r}<1,1,0)")
            for c in range(2, 13):
                ws.cell(r, c).border = self.under
                if c not in (2, 10, 11):
                    ws.cell(r, c).alignment = Alignment(vertical="center", wrap_text=c in (3, 12))
            ws.row_dimensions[r].height = 26
            r += 1
        last_row = r - 1
        ws.column_dimensions["N"].hidden = True
        st_rng = f"J{first}:J{last_row}"
        ws.conditional_formatting.add(st_rng, CellIsRule(operator="equal", formula=['"Complete"'], fill=self.fill["green_l"], font=Font(color="3F5A3B", bold=True)))
        ws.conditional_formatting.add(st_rng, CellIsRule(operator="equal", formula=['"In progress"'], fill=self.fill["amber_l"], font=Font(color="7A5520", bold=True)))
        r += 1
        # next best step
        ws.row_dimensions[r].height = 34
        ws.cell(r, 2, "NEXT BEST STEP").font = Font(name=BODY, size=8.5, bold=True, color="FFFFFF")
        ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
        for c in range(2, last):
            ws.cell(r, c).fill = self.fill["red"]
        ws.cell(r, 2).alignment = Alignment(vertical="center")
        ws.merge_cells(start_row=r, start_column=4, end_row=r, end_column=last - 1)
        nb = ws.cell(r, 4, f'=IFERROR("Continue Module "&INDEX(B{first}:B{last_row},MATCH(1,N{first}:N{last_row},0))&": "&INDEX(C{first}:C{last_row},MATCH(1,N{first}:N{last_row},0)),"Every module is complete. Review your 3 Commitments with your manager.")')
        nb.font = Font(name=HEAD, size=13, bold=True, color="FFFFFF")
        nb.alignment = Alignment(vertical="center")
        r += 2
        # commitments summary
        r = self.section(ws, r, 2, last - 1, "My 3 Commitments")
        for i, cr in enumerate(self.cm_rows):
            ws.cell(r, 2, f"{i + 1}.").font = Font(name=HEAD, size=13, bold=True, italic=True)
            ws.cell(r, 2).alignment = Alignment(horizontal="center")
            ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=9)
            cc = ws.cell(r, 3, f"=IF('{self.cm_sheet}'!C{cr}=\"\",\"Not set yet: open My 3 Commitments\",'{self.cm_sheet}'!C{cr})")
            cc.font = self.font(10)
            cc.alignment = Alignment(wrap_text=True, vertical="center")
            d = ws.cell(r, 10, f"=IF('{self.cm_sheet}'!F{cr}=\"\",\"\",'{self.cm_sheet}'!F{cr})")
            d.number_format = "mmm d"
            d.font = self.font(9.5, color=self.t["muted"])
            s = ws.cell(r, 11, f"='{self.cm_sheet}'!G{cr}")
            s.font = self.font(9.5, True)
            ws.row_dimensions[r].height = 24
            for c in range(2, last):
                ws.cell(r, c).border = self.under
            r += 1
        op = ws.cell(r, 3, "Open My 3 Commitments →")
        op.font = Font(name=BODY, size=10, bold=True, color=self.t["red"], underline="single")
        self.internal(ws, op, self.cm_sheet)
        r += 2
        # quick links
        r = self.section(ws, r, 2, last - 1, "Quick links")
        d = self.c.DELIVERABLES
        ql = [("How to use this dashboard", None, "How To Use"), ("Resource library (all QR links)", None, "Resources"), ("Team Tracker (manager)", None, "Team Tracker")]
        if d.get("pdf"):
            ql.insert(0, ("PDF workbook (fillable)", d["pdf"], None))
        if d.get("web") or d.get("folder"):
            ql.insert(0, ("Web workflow / program folder", d.get("web") or d.get("folder"), None))
        for lab, url, tab in ql:
            if url:
                cell = ws.cell(r, 3, self.link_formula(url, lab + " ↗"))
            else:
                cell = ws.cell(r, 3, lab + " →")
                self.internal(ws, cell, tab)
            cell.font = Font(name=BODY, size=10, bold=True, color=self.t["red"], underline="single")
            ws.row_dimensions[r].height = 20
            r += 1
        r += 1
        self.merge_text(ws, r, 2, last - 1, f"Program lead: {b['manager_name']}, {b['manager_title']}  ·  {b['version']}  ·  Coaching add-ons are labelled; they are not official {self.ORG} policy.", self.font(8.5, italic=True, color=self.t["muted"]), height=20)
        ws.freeze_panes = "A6"

    def fix_audit_links(self):
        for ws, cell, mid in getattr(self, "pending_fix", []):
            self.internal(ws, cell, self.tabs[mid])

    def build(self, out):
        builders = [self.build_m01, self.build_m02, self.build_m03, self.build_m04, self.build_m05, self.build_m06, self.build_m07, self.build_m08]
        # Dashboard is the default first sheet; module tabs are created after it.
        self.wb.active.title = "Dashboard"
        for f in builders:
            f()
        self.fix_audit_links()
        self.build_commitments()
        self.build_team()
        self.build_resources()
        self.build_dashboard()
        self.build_howto()
        # tab order: Dashboard, How To Use, modules..., commitments, team, resources
        self.wb.active = 0
        for ws in self.wb.worksheets:
            ws.sheet_view.tabSelected = ws.title == "Dashboard"
            ws.page_setup.orientation = "landscape"
            ws.page_setup.fitToWidth = 1
            ws.page_setup.fitToHeight = 0
            ws.sheet_properties.pageSetUpPr.fitToPage = True
        self.wb.properties.title = self.c.BRAND["doc_title"] + " Dashboard"
        self.wb.properties.creator = self.c.BRAND["manager_name"]
        self.wb.save(out)
        return out


def build(content, assets, out_path):
    tmp = os.path.join(os.path.dirname(out_path), "_xlsx_tmp")
    return XL(content, assets, tmp).build(out_path)
