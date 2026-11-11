"""Post-process an .xlsx after a LibreOffice recalculation.

LibreOffice rewrites in-workbook hyperlinks (location="'Tab'!A1") as external links to the
file's own name, which break as soon as the file is renamed. This restores them to pure
internal links: drops the r:id, decodes the location, and removes the orphaned relationships.
"""
import re
import shutil
import sys
import tempfile
import urllib.parse
import zipfile


def fix_internal_links(path):
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx").name
    fixed = 0
    with zipfile.ZipFile(path) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        drop = {}  # rels path -> set of rIds to remove
        sheets = {}
        for name in zin.namelist():
            if re.match(r"xl/worksheets/sheet\d+\.xml$", name):
                xml = zin.read(name).decode("utf-8")
                ids = set()

                def repl(m):
                    nonlocal fixed
                    tag = m.group(0)
                    if "location=" not in tag:
                        return tag
                    rid = re.search(r'r:id="([^"]+)"', tag)
                    if rid:
                        ids.add(rid.group(1))
                        tag = tag.replace(rid.group(0), "")
                    tag = re.sub(r'location="([^"]+)"', lambda l: 'location="%s"' % urllib.parse.unquote(l.group(1)), tag)
                    fixed += 1
                    return re.sub(r"\s+", " ", tag)
                xml = re.sub(r"<hyperlink\b[^>]*/>", repl, xml)
                sheets[name] = xml
                rels = name.replace("worksheets/", "worksheets/_rels/") + ".rels"
                drop[rels] = ids
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename in sheets:
                data = sheets[item.filename].encode("utf-8")
            elif item.filename in drop and drop[item.filename]:
                xml = data.decode("utf-8")
                for rid in drop[item.filename]:
                    xml = re.sub(r'<Relationship[^>]*Id="%s"[^>]*/>' % re.escape(rid), "", xml)
                data = xml.encode("utf-8")
            zout.writestr(item, data)
    shutil.move(tmp, path)
    return fixed


if __name__ == "__main__":
    print("internal links fixed:", fix_internal_links(sys.argv[1]))
