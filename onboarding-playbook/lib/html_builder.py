"""Builds the single-file, self-contained interactive web workflow."""
import html
import json
import os

from . import common

E = html.escape
WEB = os.path.join(common.HERE, "web")

ARROW = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12L12 4M6 4h6v6"/></svg>'
COPY = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/></svg>'
MARK = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.2 17V9.6a5.8 5.8 0 0 1 11.6 0v2.6" fill="none" stroke="currentColor" stroke-width="3.6"/></svg>'

ICONS = {
    "web": '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M3 8h18"/></svg>',
    "pdf": '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
    "sheet": '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>',
    "Wealth Managers": '<svg viewBox="0 0 24 24"><path d="M3 20h18M5 20V10M19 20V10M9 20v-6M15 20v-6M12 3l9 5H3z"/></svg>',
    "Estate Attorneys": '<svg viewBox="0 0 24 24"><path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7h6zM19 7l-3 7h6z"/></svg>',
    "CPAs": '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h2M12 18h4"/></svg>',
    "Financial Advisors": '<svg viewBox="0 0 24 24"><path d="M3 17l5-5 4 4 8-8M15 8h5v5"/></svg>',
    "Builders": '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 16 0M2 12h20M10 4v4M14 4v4M4 16h16v4H4z"/></svg>',
    "Architects": '<svg viewBox="0 0 24 24"><path d="M12 3l-7 18M12 3l7 18M8 14h8M12 3v3"/></svg>',
}


class Builder:
    def __init__(self, c, assets):
        self.c = c
        self.assets = assets
        self.photo_cache = {}
        b = c.BRAND
        self.TIER = b.get("tier", "Program")
        self.PRICE = b.get("price_tier", "top-tier")
        self.AI = b.get("assistant", "your AI assistant")
        self.ORG = b.get("org", "company")

    # ------------------------------------------------------------------ utils
    def photo(self, key, width, ratio=None, q=68):
        ck = (key, width, ratio)
        if ck not in self.photo_cache:
            fname = self.c.PHOTOS[key][0]
            data = common.prepare_photo(os.path.join(self.assets, "photos", fname), width, q, ratio)
            self.photo_cache[ck] = common.data_uri_jpeg(data)
        return self.photo_cache[ck]

    def qr(self, rid):
        return f'<svg viewBox="0 0 1 1" aria-hidden="true"><use href="#qr-{rid}"/></svg>'

    def qr_symbols(self):
        out = []
        for rid, r in self.c.RESOURCES.items():
            if not r.get("url"):
                continue
            n, d = common.qr_svg_path(r["url"])
            out.append(f'<symbol id="qr-{rid}" viewBox="-1 -1 {n + 2} {n + 2}"><rect x="-1" y="-1" width="{n + 2}" height="{n + 2}" fill="#fff"/><path d="{d}" fill="{self.c.THEME["charcoal"]}"/></symbol>')
        return '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' + "".join(out) + "</svg>"

    def res_mini(self, rid, label=None, compact=False):
        r = common.resource(self.c, rid)
        cls = "res-mini compact" if compact else "res-mini"
        return (f'<a class="{cls}" href="{E(r["url"])}" target="_blank" rel="noopener">'
                f'<span class="qr">{self.qr(rid)}</span>'
                f'<span class="rtx"><span class="rl">{E(label or r["label"])}</span><span class="rt">{E(r["title"])}</span>'
                f'<span class="ra">{E(r["access"])}</span></span><span class="go">OPEN {ARROW}</span></a>')

    def lockup(self, cls=""):
        b = self.c.BRAND
        return (f'<span class="lockup {cls}"><span class="l-top">{E(b["lockup_top"])}</span>'
                f'<span class="l-by">{E(b["lockup_by"])} {MARK}{E(b["lockup_brand"])}</span></span>')

    def mod_title(self, mid):
        return self.c.MODULES[mid]["title"]

    # ------------------------------------------------------------------ blocks
    def blk_head(self, b, extra=""):
        step = f'<span class="step">STEP {E(b["step"])}</span>' if b.get("step") else ""
        title = f'<div class="blk-title">{step}<h3>{E(b["title"])}</h3></div>' if b.get("title") else ""
        src = '<span class="src-coach">Manager coaching add-on</span>' if b.get("source") == "coach" else ""
        intro = f'<p class="blk-intro">{E(b["intro"])}</p>' if b.get("intro") else ""
        return src + title + intro + extra

    def b_audit(self, b, m):
        secs = []
        for s in self.c.AUDIT:
            rows = []
            for it in s["items"]:
                fx = it["fix"]
                rows.append(
                    f'<div class="aud-item" data-aud-item="{it["id"]}"><div class="aud-row"><span class="lbl">{E(it["label"])}</span>'
                    f'<span class="seg" role="group" aria-label="{E(it["label"])}">'
                    f'<button type="button" data-v="yes" aria-pressed="false">YES</button><button type="button" data-v="no" aria-pressed="false">NO</button><button type="button" data-v="na" aria-pressed="false">N/A</button></span></div>'
                    f'<div class="fixwrap"><label for="n-{it["id"]}">If no, what needs to improve?</label><textarea class="tx" id="n-{it["id"]}" data-note="{it["id"]}" rows="2" placeholder="Be specific: what would a {self.PRICE} seller need to see?"></textarea>'
                    f'<div class="fixto">Fix it in <a href="#{fx}">Module {self.c.MODULES[fx]["num"]}: {E(self.mod_title(fx))}</a></div></div></div>')
            secs.append(f'<div class="aud-sec"><header><span class="n">{s["num"]}</span><div><h4>{E(s["title"])}</h4><p>{E(s["question"])}</p></div></header>{"".join(rows)}</div>')
        r = 74
        gauge = (f'<div class="gauge"><svg viewBox="0 0 170 170" width="170" height="170"><circle cx="85" cy="85" r="{r}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="10"/>'
                 f'<circle id="gauge-arc" cx="85" cy="85" r="{r}" fill="none" stroke="{self.c.THEME["red"]}" stroke-width="10" stroke-linecap="round" stroke-dasharray="{2 * 3.14159265 * r:.2f}" stroke-dashoffset="{2 * 3.14159265 * r:.2f}" style="transition:stroke-dashoffset .6s"/></svg>'
                 f'<div class="gv"><div><b id="g-score">—</b><small>Readiness</small></div></div></div>')
        score = (f'<div class="score"><h4>Your {self.PRICE} readiness</h4>{gauge}<div class="band" id="g-band"></div><p class="band-t" id="g-band-t"></p>'
                 f'<div class="counts"><div><b id="c-yes">0</b><span>Yes</span></div><div><b id="c-no">0</b><span>No</span></div><div><b id="c-na">0</b><span>N/A</span></div></div>'
                 f'<div class="fixlist"><h5>Your fix list</h5><div id="fixlist"></div></div></div>')
        self.score_panel = score
        return f'<div class="blk">{self.blk_head({"title": f"Score yourself through a {self.PRICE} seller\'s eyes", "intro": "Choose one response per item. Every No opens a note field and points you to the module that closes the gap. Your score updates live."})}{"".join(secs)}</div>'

    def b_callout(self, b, m):
        tone = "note" if b.get("tone") == "note" else ""
        return f'<div class="blk"><div class="callout {tone}"><h4>{E(b["title"])}</h4><p>{E(b["text"])}</p></div></div>'

    def b_quote(self, b, m):
        return f'<div class="blk quote"><p>{E(b["text"])}</p></div>'

    def b_steps(self, b, m):
        rows = []
        for s in b["items"]:
            res = self.res_mini(s["resource"]) if s.get("resource") else "<span></span>"
            rows.append(f'<div class="step-row"><span class="sn">{E(s["num"])}</span><div><h4>{E(s["title"])}</h4><p>{E(s["text"])}</p></div>{res}</div>')
        return f'<div class="blk">{self.blk_head(b)}<div class="steps">{"".join(rows)}</div></div>'

    def b_checklist(self, b, m):
        items = "".join(
            f'<label class="check"><input type="checkbox" data-id="{b["id"]}_{i}"><span>{E(t)}</span></label>'
            for i, t in enumerate(b["items"]))
        two = " two" if len(b["items"]) > 6 else ""
        return f'<div class="blk">{self.blk_head(b)}<div class="clist{two}">{items}</div></div>'

    def b_flow(self, b, m):
        f = self.c.ASSISTANT_FLOW

        def yn(q):
            return f'<div class="yn"><button type="button" data-flow="{q}" data-v="yes">YES</button><button type="button" data-flow="{q}" data-v="no">NO</button></div>'
        n1 = f'<div class="fnode" id="fn-q1"><h4>{E(f["q1"])}</h4>{yn("q1")}<div class="fix"><b>{E(f["no1_title"])}</b><p>{E(f["no1_text"])}</p>{self.res_mini(f["no1_resource"], compact=True)}</div></div>'
        n2 = f'<div class="fnode dim" id="fn-q2"><h4>{E(f["q2"])}</h4>{yn("q2")}<div class="fix"><b>{E(f["no2_title"])}</b><p>{E(f["no2_text"])}</p>{self.res_mini(f["no2_resource"], compact=True)}</div></div>'
        n3 = f'<div class="fnode ready dim" id="fn-ready"><h4>{E(f["ready_title"])}</h4><p>{E(f["ready_text"])}</p><p class="muted" style="font-size:13.5px">Next: put {E(self.AI)} to work in <a href="#m08">Module 08</a>.</p></div>'
        return f'<div class="blk">{self.blk_head({"title": f"Set up {self.AI}\'s memory", "intro": f"A quick check to make sure {self.AI} understands your business."})}<div class="flow">{n1}{n2}{n3}</div></div>'

    def prompt_card(self, pid, title, desc, text, resource=None, price=False):
        body = E(text)
        if price:
            body = body.replace("[$X]", '<span class="px hl">[$X]</span>')
        res = self.res_mini(resource, "Source doc") if resource else ""
        return (f'<div class="prompt"><header><h4>{E(title)}</h4>'
                f'<button class="btn dark sm" type="button" data-copy="#pr-{pid}">{COPY} Copy prompt</button></header>'
                f'<p class="pdesc">{E(desc)}</p><pre id="pr-{pid}">{body}</pre>'
                f'<div class="pfoot"><button class="btn line sm" type="button" data-expand="#pr-{pid}">Expand</button>{res}</div></div>')

    def b_prompt(self, b, m):
        return f'<div class="blk">{self.prompt_card(b["id"], b["title"], b["desc"], b["text"], b.get("resource"))}</div>'

    def b_pipeline_prompts(self, b, m):
        bar = (f'<div class="price-bar"><label for="tier-price">Your {E(self.TIER)} price point</label>'
               '<input class="tx" id="tier-price" data-field="tier_price" placeholder="e.g. $5,000,000">'
               '<small>Fills every [$X] below so you can copy and run.</small></div>')
        cards = "".join(self.prompt_card(p["id"], p["title"], p["desc"], p["text"], None, True) for p in self.c.PIPELINE_PROMPTS)
        return f'<div class="blk">{self.blk_head({"title": f"Three prompts to mine your {self.TIER} pipeline"})}{bar}{cards}<div style="margin-top:6px">{self.res_mini(b["resource"], "All prompts · source doc") if b.get("resource") else ""}</div></div>'

    def b_criteria(self, b, m):
        cards = []
        for it in b["items"]:
            r = common.resource(self.c, it["resource"])
            cards.append(f'<div class="c"><a class="qr" href="{E(r["url"])}" target="_blank" rel="noopener" aria-label="Open example">{self.qr(r["id"])}</a>'
                         f'<h4>{E(it["title"])}</h4><p>{E(it["text"])}</p>'
                         f'<a class="ex" href="{E(r["url"])}" target="_blank" rel="noopener">See an example ↗<small>{E(r["title"])}</small></a></div>')
        return f'<div class="blk">{self.blk_head(b)}<div class="crit">{"".join(cards)}</div></div>'

    def b_table(self, b, m):
        th = "".join(f"<th>{E(h)}</th>" for h in b["headers"])
        rows = "".join("<tr>" + "".join(f"<td>{E(c)}</td>" for c in r) + "</tr>" for r in b["rows"])
        return f'<div class="blk">{self.blk_head(b)}<table class="tbl"><thead><tr>{th}</tr></thead><tbody>{rows}</tbody></table></div>'

    def b_template(self, b, m):
        fs = []
        for f in b["fields"]:
            tag = (f'<textarea class="tx" data-field="{f["id"]}" rows="{max(2, f["lines"])}"></textarea>' if f["lines"] > 1
                   else f'<input class="tx" data-field="{f["id"]}">')
            fs.append(f'<div class="f"><label>{E(f["label"])}</label><small>{E(f["guide"])}</small>{tag}</div>')
        prev = (f'<div class="preview" id="cs-preview"><div class="ph"><span>Live one-page preview</span><span>{E(self.TIER)} Case Study</span></div><div class="pb">'
                '<h4 id="pv-headline"></h4>'
                '<div class="row"><b>The Challenge</b><div id="pv-challenge"></div></div>'
                '<div class="row"><b>The Strategy</b><div id="pv-strategy"></div></div>'
                '<div class="row"><b>The Result</b><div id="pv-result"></div></div>'
                '<div class="pq" id="pv-quote"></div></div>'
                f'<div class="pf"><span class="wc" id="cs-wc"></span><button class="btn dark sm" type="button" id="cs-copy">{COPY} Copy text</button></div></div>')
        return f'<div class="blk">{self.blk_head(b)}<div class="tpl"><div>{"".join(fs)}</div>{prev}</div></div>'

    def b_example(self, b, m):
        x = self.c.CASE_EXAMPLE
        stats = "".join(f"<div><small>{E(k)}</small><b>{E(v)}</b></div>" for k, v in x["stats"])
        strat = "".join(f"<li><b>{E(t)}</b> {E(d)}</li>" for t, d in x["strategy"])
        head, _, rest = x["headline"].partition(":")
        return (f'<div class="blk"><div class="example"><div class="side"><span class="eyebrow" style="color:#CDBFB1">Example</span><span class="rule"></span>'
                f'<h4>A Completed Case Study</h4><p>{E(x["note"])}</p></div><div class="main"><h5><b>{E(head)}:</b>{E(rest)}</h5><div class="st">{stats}</div>'
                f'<div class="er"><b>The Challenge</b><div>{E(x["challenge"])}</div></div>'
                f'<div class="er"><b>The Strategy</b><ol>{strat}</ol></div>'
                f'<div class="er" style="border-bottom:0"><b>The Result</b><div>{E(x["result"])}</div></div>'
                f'<div class="eq">“{E(x["quote"])}”<br><small style="font-style:normal;opacity:.8">— Seller</small></div></div></div></div>')

    def b_builder(self, b, m):
        fs = "".join(f'<div><label>{E(f["label"])}</label><small>{E(f["guide"])}</small><input class="tx" data-field="{f["id"]}"></div>' for f in b["fields"])
        return (f'<div class="blk">{self.blk_head(b)}<div class="vp-formula">{E(b["formula"])}</div><div class="vp-grid">{fs}</div>'
                f'<div class="vp-out"><span class="caps">Your {E(self.TIER)} Value Prop</span><p id="vp-out"></p><button class="btn sm" type="button" id="vp-copy">{COPY} Copy</button></div></div>')

    def b_talk(self, b, m):
        beats = "".join(f'<div class="beat"><span class="tm">{E(x["time"])}</span><h5>{E(x["title"])}</h5><p>{E(x["text"])}</p>'
                        f'<textarea class="tx" data-field="talk_{i}" placeholder="Your notes"></textarea></div>' for i, x in enumerate(b["beats"]))
        timer = '<div class="timer"><span class="clock" id="talk-clock">2:00</span><button class="btn red sm" type="button" id="talk-start">Start 2:00 practice</button><button class="btn line sm" type="button" id="talk-reset">Reset</button><span class="muted" style="font-size:14px">The beat you should be on lights up as you talk.</span></div>'
        return f'<div class="blk">{self.blk_head(b)}<div class="talk">{beats}</div>{timer}</div>'

    def b_touches(self, b, m):
        cards = []
        for i, t in enumerate(self.c.TOUCHES):
            cards.append(f'<div class="touch"><span class="tg">{E(t["tag"])}</span><h4>{E(t["title"])}</h4><span class="when">{E(t["when"])}</span>'
                         f'<p class="tx2">{E(t["text"])}</p><div class="note-card" id="touch-{i}">{E(t["note"])}</div>'
                         f'<div class="foot"><button class="btn dark sm" type="button" data-copy="#touch-{i}">{COPY} Copy note</button></div></div>')
        helper = ('<div class="datehelp"><label for="t1d">Touch 1 mailed on</label><input class="tx" type="date" id="t1d" data-field="touch1_date">'
                  '<span class="out" id="touch-out"></span></div>')
        return f'<div class="blk">{self.blk_head({"title": "Your two-touch mail sequence", "intro": "A thoughtful, personal approach can open the door to a conversation and showcase your value."})}<div class="touches">{"".join(cards)}</div>{helper}</div>'

    def b_tips(self, b, m):
        tips = "".join(f'<div class="tip"><span>{E(t["text"])}</span>{self.res_mini(t["resource"], compact=True) if t.get("resource") else ""}</div>' for t in b["items"])
        return f'<div class="blk">{self.blk_head(b)}<div class="tips">{tips}</div></div>'

    def b_tracker(self, b, m):
        th = "<th>#</th>" + "".join(f"<th>{E(c)}</th>" for c in b["columns"])
        rows = "".join("<tr><td class=\"idx\">" + str(r + 1) + "</td>" + "".join(
            f'<td><input data-trk="{b["id"]}" data-r="{r}" data-c="{c}" aria-label="{E(col)} row {r + 1}"></td>' for c, col in enumerate(b["columns"])) + "</tr>"
            for r in range(b["rows"]))
        return f'<div class="blk">{self.blk_head(b, "")}<div class="trk-wrap"><table class="trk"><thead><tr>{th}</tr></thead><tbody>{rows}</tbody></table></div></div>'

    def b_chips(self, b, m):
        chips = "".join(f'<div class="prochip">{ICONS.get(t, "")}{E(t)}</div>' for t in b["items"])
        return f'<div class="blk">{self.blk_head(b)}<div class="prochips">{chips}</div></div>'

    def b_email(self, b, m):
        return (f'<div class="blk">{self.blk_head({"title": b["title"]})}<div class="email"><div class="subj"><b>Subject</b>{E(b["subject"])}</div>'
                f'<pre id="em-{b["id"]}">{E(b["body"])}</pre><div class="ef"><button class="btn dark sm" type="button" data-copy="#em-{b["id"]}">{COPY} Copy email</button>'
                f'<button class="btn line sm" type="button" data-mailto="#em-{b["id"]}" data-subject="{E(b["subject"])}">Open in my email</button></div></div></div>')

    def b_cards(self, b, m):
        cs = "".join(f'<div><h5>{E(x["title"])}</h5><p>{E(x["text"])}</p></div>' for x in b["items"])
        return f'<div class="blk"><div class="darkcards"><span class="caps">{E(b["title"])}</span><span class="rule"></span><p>{E(b["intro"])}</p><div class="dc">{cs}</div></div></div>'

    # ------------------------------------------------------------------ sections
    def topbar(self):
        nav = [("start", "Start"), ("prepare", "Prepare"), ("present", "Present"), ("win", "Win"), ("commit", "Commit"), ("library", "Resources")]
        links = "".join(f'<a href="#{i}">{E(t)}</a>' for i, t in nav)
        circ = 2 * 3.14159265 * 18
        ring = (f'<div class="ring-wrap"><span class="lbl">Your<br>progress</span><div class="ring"><svg viewBox="0 0 44 44" width="44" height="44">'
                f'<circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="4"/>'
                f'<circle id="ring-arc" cx="22" cy="22" r="18" fill="none" stroke="{self.c.THEME["red"]}" stroke-width="4" stroke-linecap="round" stroke-dasharray="{circ:.2f}" stroke-dashoffset="{circ:.2f}" style="transition:stroke-dashoffset .5s"/></svg>'
                f'<span class="v" id="ring-val">0%</span></div><button class="reset" id="reset" type="button" title="Clear progress on this device">Reset</button></div>')
        return f'<header class="topbar"><div class="wrap"><a href="#top" style="color:inherit;text-decoration:none">{self.lockup()}</a><nav aria-label="Sections">{links}</nav>{ring}</div></header>'

    def hero(self):
        b = self.c.BRAND
        d = self.c.DELIVERABLES
        n_mod = len(self.c.MODULES)
        n_res = sum(1 for r in self.c.RESOURCES.values() if r.get("qr"))
        ctas = [f'<a class="btn red" href="#start">Begin onboarding {ARROW}</a>']
        if d.get("pdf"):
            ctas.append(f'<a class="btn ghost" href="{E(d["pdf"])}" target="_blank" rel="noopener">PDF workbook {ARROW}</a>')
        if d.get("dashboard_copy"):
            ctas.append(f'<a class="btn ghost" href="{E(d["dashboard_copy"])}" target="_blank" rel="noopener">Copy my dashboard {ARROW}</a>')
        return (f'<section class="hero" id="top"><img class="bg" src="{self.photo("hero", 2000, None, 70)}" alt="">'
                f'<div class="wrap"><span class="eyebrow">{E(b["eyebrow"])} · Agent Onboarding</span><span class="rule"></span>'
                f'<h1>{E(b["program"])}</h1><p class="tag">{E(b["tagline"])}</p><p class="sub">{E(b["subtitle"])}</p>'
                f'<div class="ctas">{"".join(ctas)}</div>'
                f'<div class="stats"><div><b>3</b><span>Phases</span></div><div><b>{n_mod}</b><span>Modules</span></div><div><b>{n_res}</b><span>Linked resources</span></div><div><b>3</b><span>Commitments</span></div></div></div></section>')

    def start(self):
        c = self.c
        d = c.DELIVERABLES
        btns = {"web": ('<a class="btn line sm" href="#prepare">Start Phase 1</a>'),
                "pdf": (f'<a class="btn line sm" href="{E(d["pdf"])}" target="_blank" rel="noopener">Open PDF {ARROW}</a>' if d.get("pdf") else ""),
                "sheet": (f'<a class="btn line sm" href="{E(d["dashboard_copy"])}" target="_blank" rel="noopener">Make my copy {ARROW}</a>' if d.get("dashboard_copy") else "")}
        cards = "".join(f'<div class="card howto"><div class="ico">{ICONS[h["icon"]]}</div><h3>{E(h["title"])}</h3><p>{E(h["text"])}</p>{btns[h["icon"]]}</div>' for h in c.HOW_TO)
        phases = []
        for p in c.PHASES:
            mods = "".join(f'<a class="rm-mod" href="#{mid}"><span class="n">{c.MODULES[mid]["num"]}</span><span class="t">{E(c.MODULES[mid]["title"])}</span><span class="chip ns" data-mod-chip="{mid}">Not started</span></a>' for mid in p["modules"])
            phases.append(f'<div class="rm-phase"><span class="ph">Phase {p["num"]}</span><h3>{E(p["name"])}</h3><div class="bar"><i data-phase-bar="{p["id"]}"></i></div>{mods}</div>')
        b = c.BRAND
        lead = (f'<div class="lead-line"><span class="badge" style="width:36px;height:36px;font-size:13px">★</span><span>Your program lead: <b>{E(b["manager_name"])}</b>, {E(b["manager_title"])}. '
                f'Finish with <a href="#commit">My 3 Commitments</a> and review them together at your next 1:1.</span></div>')
        return (f'<section class="block" id="start" data-nav="start"><div class="wrap"><div class="sec-head"><span class="eyebrow">Start here</span><span class="rule"></span>'
                f'<h2>One program. Three tools. A clear path to your first {E(self.PRICE)} listing.</h2>'
                f'<p>Every worksheet from the {E(self.TIER)} session lives here as one guided workflow. Work top to bottom. Each module ends with clear actions, and every QR code is a clickable link.</p></div>'
                f'<div class="grid3">{cards}</div><div class="sec-head" style="margin:56px 0 0"><span class="eyebrow">Your roadmap</span></div>'
                f'<div class="roadmap">{"".join(phases)}</div>{lead}</div></section>')

    def phase_banner(self, p):
        return (f'<section class="phase" id="{p["id"]}" data-nav="{p["id"]}"><img class="bg" src="{self.photo(p["photo"], 1800, None, 66)}" alt="">'
                f'<div class="wrap"><div class="big">{p["num"]}</div><div><span class="eyebrow">Phase {p["num"]}</span><div class="ph-name">{E(p["name"])}</div><span class="rule"></span>'
                f'<h2>{E(p["title"])}</h2><p>{E(p["intro"])}</p><div class="pbar"><div class="bar"><i data-phase-bar="{p["id"]}"></i></div><span data-phase-pct="{p["id"]}">0% complete</span></div></div></div></section>')

    def module(self, mid, nxt):
        c = self.c
        m = c.MODULES[mid]
        p = common.phase_of(c, mid)
        coach = '<span class="pill coach">Coaching framework</span>' if m.get("source") == "coach" else ""
        head = (f'<div class="mod-head"><div class="ph"><img src="{self.photo(m["photo"], 1100, 1.25, 66)}" alt=""></div>'
                f'<div class="tx"><div class="num"><span class="badge">{m["num"]}</span><span class="phase-tag">Phase {p["num"]} · {E(p["name"])}</span></div>'
                f'<h2>{E(m["title"])}</h2><p class="kick">{E(m["kicker"])}</p>'
                f'<div class="meta"><span class="pill">⏱ {E(m["time"])}</span><span class="pill">{len(m["actions"])} actions</span>{coach}</div>'
                f'<div class="mbar"><div class="bar"><i data-mod-bar="{mid}"></i></div><span data-mod-pct="{mid}">0%</span></div></div></div>')
        goal = f'<div class="goal"><b>The goal</b><span>{E(m["goal"])}</span></div>' if m.get("goal") else ""
        blocks = []
        for b in m["blocks"]:
            fn = getattr(self, "b_" + b["type"])
            blocks.append(fn(b, m))
        acts = "".join(f'<label class="check"><input type="checkbox" data-id="{a["id"]}"><span>{E(a["text"])}</span></label>' for a in m["actions"])
        nx = (f'<a class="btn dark sm next" href="#{nxt}">Next: {E(c.MODULES[nxt]["title"]) if nxt in c.MODULES else "My 3 Commitments"} {ARROW}</a>')
        self.score_panel = getattr(self, "score_panel", None)
        has_score = any(b["type"] == "audit" for b in m["blocks"])
        stat = " static" if has_score else ""
        aside = (f'<aside><div class="actions{stat}" data-actions="{mid}"><h4>Your actions</h4><p class="sub">Check each one off as you go. Progress saves on this device.</p>{acts}'
                 f'<div class="done-note">✓ Module complete. Nice work.</div>{nx}</div>{self.score_panel if has_score else ""}</aside>')
        return (f'<section class="module" id="{mid}"><div class="wrap">{head}<div class="mod-body"><div><p class="mod-intro">{E(m["intro"])}</p>{goal}{"".join(blocks)}</div>{aside}</div></div></section>')

    def commitments(self):
        c = self.c
        cm = c.COMMITMENTS
        rows = "".join(
            f'<div class="cm-row"><span class="cn">{i}.</span><div><small>Commitment</small><textarea class="tx" rows="2" data-field="cm_{i}" placeholder="One action, one number, one date"></textarea></div>'
            f'<div class="by"><small>By when</small><input class="tx" data-field="cm_{i}_by" placeholder="e.g. Dec 5"></div></div>' for i in (1, 2, 3))
        return (f'<section class="phase" id="commit" data-nav="commit" style="min-height:auto"><img class="bg" src="{self.photo("close", 1800, None, 64)}" alt="">'
                f'<div class="wrap" style="grid-template-columns:1fr;padding-bottom:180px"><div><span class="eyebrow">Close the session</span><span class="rule"></span><h2>Commit to the three moves that matter most.</h2>'
                f'<p>{E(cm["guide"])}</p></div></div></section>'
                f'<section style="margin-top:-140px;position:relative;z-index:3;padding-bottom:60px"><div class="wrap"><div class="commit">'
                f'<div class="ch"><span class="eyebrow">{E(c.BRAND["eyebrow"])}</span><span class="rule" style="margin:12px auto"></span><h2>{E(cm["title"])}</h2><p>{E(cm["question"])}</p></div>'
                f'<div class="names"><div><label class="l" for="cma">Agent Name:</label><input class="tx" id="cma" data-field="cm_agent"></div>'
                f'<div><label class="l" for="cmm">Manager Name:</label><input class="tx" id="cmm" data-field="cm_manager" data-default="{E(c.BRAND["manager_name"])}"></div></div>'
                f'<p class="muted" style="font-size:14px;margin-bottom:4px">Tap a suggestion to add it. Suggestions update from your {E(self.PRICE)} Audit gaps.</p><div class="sugg" id="cm-sugg"></div>{rows}'
                f'<div class="cf"><button class="btn red" type="button" id="cm-email">Email to my manager {ARROW}</button><button class="btn dark" type="button" id="cm-copy">{COPY} Copy summary</button><button class="btn line" type="button" id="cm-print">Print / Save PDF</button></div></div></div></section>')

    def library(self):
        c = self.c
        tiles = []
        for mid in common.module_order(c):
            for rid, r in c.RESOURCES.items():
                if r.get("module") == mid and r.get("url"):
                    tiles.append(f'<a href="{E(r["url"])}" target="_blank" rel="noopener"><span class="qr">{self.qr(rid)}</span><span><span class="m">Module {c.MODULES[mid]["num"]} · {E(r["label"])}</span>'
                                 f'<span class="t" style="display:block">{E(r["title"])}</span><span class="d" style="display:block">{E(r["desc"])}</span><span class="ac" style="display:block">{E(r["access"])}</span></span></a>')
        return (f'<section class="block" id="library" data-nav="library" style="padding-top:40px"><div class="wrap"><div class="sec-head"><span class="eyebrow">Resource library</span><span class="rule"></span>'
                f'<h2>Every QR code, one tap away.</h2><p>All {len(tiles)} links from the printed worksheets, decoded and verified. Tap a card on any device, or scan its code from a screen or a printout.</p></div>'
                f'<div class="lib">{"".join(tiles)}</div></div></section>')

    def footer(self):
        b = self.c.BRAND
        return (f'<footer><div class="wrap"><div>{self.lockup("lg")}<p style="margin-top:22px">{E(b["program"])} · {E(b["version"])}</p>'
                f'<p>Internal onboarding resource for {E(self.TIER)} agents. Program lead: {E(b["manager_name"])}, {E(b["manager_title"])}.</p>'
                f'<p>{E(self.c.PHOTO_CREDIT)} The case study example is fictional. Coaching add-ons are labelled; they are not official {E(self.ORG)} policy.</p></div>'
                f'<p class="fq">“{E(b["closing_line"])}”</p></div></footer>')

    def data_blob(self):
        c = self.c
        audit = []
        for s in c.AUDIT:
            for it in s["items"]:
                audit.append({"id": it["id"], "label": it["label"], "fix": it["fix"], "fixNum": c.MODULES[it["fix"]]["num"], "fixTitle": c.MODULES[it["fix"]]["title"]})
        mods = [{"id": mid, "phase": common.phase_of(c, mid)["id"], "actions": [a["id"] for a in c.MODULES[mid]["actions"]]} for mid in common.module_order(c)]
        return json.dumps({"storeKey": c.BRAND.get("store_key", "playbook-v1"), "audit": audit, "modules": mods, "bands": c.AUDIT_BANDS,
                           "commitExamples": c.COMMITMENTS["examples"], "programName": c.BRAND["program"], "tier": self.TIER, "priceTier": self.PRICE}).replace("</", "<\\/")

    def build(self):
        c = self.c
        css = open(os.path.join(WEB, "style.css"), encoding="utf-8").read()
        for k, v in c.THEME.items():
            css = css.replace(f"%{k}%", v)
        js = open(os.path.join(WEB, "app.js"), encoding="utf-8").read()
        order = common.module_order(c)
        body = [self.topbar(), self.hero(), self.start()]
        for p in c.PHASES:
            body.append(self.phase_banner(p))
            for mid in p["modules"]:
                i = order.index(mid)
                nxt = order[i + 1] if i + 1 < len(order) else "commit"
                body.append(self.module(mid, nxt))
        body += [self.commitments(), self.library(), self.footer()]
        fonts = ("https://fonts.googleapis.com/css2?family=Caveat:wght@500&family=Inter:wght@400;500;600;700"
                 "&family=Jost:wght@400;500;600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap")
        return (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
                f'<title>{E(c.BRAND["doc_title"])}</title><meta name="description" content="{E(c.BRAND["subtitle"])}">'
                f'<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
                f'<link rel="stylesheet" href="{fonts}"><style>{css}</style></head><body>'
                f'{self.qr_symbols()}{"".join(body)}<div class="toast" role="status" aria-live="polite"></div>'
                f'<script type="application/json" id="pb-data">{self.data_blob()}</script><script>{js}</script></body></html>')


def build(content, assets, out_path):
    h = Builder(content, assets).build()
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(h)
    return out_path
