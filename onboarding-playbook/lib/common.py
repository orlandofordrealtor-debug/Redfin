"""Shared helpers for the playbook builders: content loading, QR codes, photos."""
import base64
import importlib.util
import io
import os

import qrcode
from PIL import Image, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def load_content(path):
    """Import a content module (see content.example.py) from a file path."""
    spec = importlib.util.spec_from_file_location("playbook_content", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def qr_matrix(url, ec="M"):
    level = {"L": qrcode.constants.ERROR_CORRECT_L, "M": qrcode.constants.ERROR_CORRECT_M,
             "Q": qrcode.constants.ERROR_CORRECT_Q, "H": qrcode.constants.ERROR_CORRECT_H}[ec]
    q = qrcode.QRCode(error_correction=level, border=0)
    q.add_data(url)
    q.make(fit=True)
    return q.get_matrix()


def qr_svg_path(url):
    """Return (size, path_d) for a QR code drawn on a unit grid."""
    m = qr_matrix(url)
    n = len(m)
    parts = []
    for y, row in enumerate(m):
        x = 0
        while x < n:
            if row[x]:
                start = x
                while x < n and row[x]:
                    x += 1
                parts.append(f"M{start} {y}h{x - start}v1h-{x - start}z")
            else:
                x += 1
    return n, "".join(parts)


def qr_png(url, out_path, px=600, fg=(42, 37, 35), bg=(255, 255, 255), quiet=2):
    m = qr_matrix(url)
    n = len(m) + quiet * 2
    scale = max(1, px // n)
    img = Image.new("RGB", (n * scale, n * scale), bg)
    pix = img.load()
    for y, row in enumerate(m):
        for x, v in enumerate(row):
            if v:
                for dy in range(scale):
                    for dx in range(scale):
                        pix[(x + quiet) * scale + dx, (y + quiet) * scale + dy] = fg
    img.save(out_path)
    return out_path


def prepare_photo(src, width, quality=70, ratio=None, darken=None, warm=False):
    """Load, optionally crop to ratio (w/h), resize, and return JPEG bytes."""
    im = Image.open(src).convert("RGB")
    if ratio:
        w, h = im.size
        cur = w / h
        if cur > ratio:
            nw = int(h * ratio)
            x0 = (w - nw) // 2
            im = im.crop((x0, 0, x0 + nw, h))
        else:
            nh = int(w / ratio)
            y0 = int((h - nh) * 0.55)
            im = im.crop((0, y0, w, y0 + nh))
    if im.size[0] > width:
        im = im.resize((width, int(im.size[1] * width / im.size[0])), Image.LANCZOS)
    if warm:
        im = ImageEnhance.Color(im).enhance(0.88)
    if darken:
        im = ImageEnhance.Brightness(im).enhance(darken)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
    return buf.getvalue()


def data_uri_jpeg(data):
    return "data:image/jpeg;base64," + base64.b64encode(data).decode()


def resource(content, rid):
    r = dict(content.RESOURCES[rid])
    r["id"] = rid
    return r


def all_actions(content):
    out = []
    for phase in content.PHASES:
        for mid in phase["modules"]:
            for a in content.MODULES[mid]["actions"]:
                out.append((phase["id"], mid, a))
    return out


def module_order(content):
    return [mid for phase in content.PHASES for mid in phase["modules"]]


def phase_of(content, mid):
    for p in content.PHASES:
        if mid in p["modules"]:
            return p
    return None
