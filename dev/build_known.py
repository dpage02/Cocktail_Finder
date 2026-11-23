"""Writes known_urls.json: every link already in the archive, so the sheet's
channel refresh never re-imports a drink we already have.

Run after changing DRINKS_DATA in index.html:  python3 dev/build_known.py
Key format must match linkKey() in index.html and key_() in apps-script/Code.gs.
"""
import json, re, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
html = (root / "index.html").read_text(encoding="utf-8")


def data_array(name):
    line = next(l for l in html.splitlines() if l.startswith(f"const {name} = "))
    return json.loads(line[line.index("["):].rstrip().rstrip(";"))


def key(u):
    u = (u or "").strip()
    if not u:
        return ""
    m = re.search(r"(?:v=|youtu\.be/|shorts/|embed/|live/)([\w-]{11})", u)
    if m and re.search(r"youtube\.com|youtu\.be", u, re.I):
        return "yt:" + m.group(1)
    u = re.sub(r"^https?://", "", u, flags=re.I).lower()
    u = re.sub(r"^www\.", "", u)
    u = re.split(r"[?#]", u)[0].rstrip("/")
    return u


keys = set()
for name in ["DRINKS_DATA", "CHECKS_DATA", "FALL_DATA", "SPRING_DATA", "SUMMER_DATA"]:
    for d in data_array(name):
        for u in [d.get("u")] + [a.get("u") for a in d.get("ai") or []] + [v.get("u") for v in d.get("versions") or []]:
            k = key(u)
            if k:
                keys.add(k)

seed = json.loads((root / "seed.json").read_text(encoding="utf-8"))
for c in (seed.get("custom") or {}).values():
    if key(c.get("url")):
        keys.add(key(c.get("url")))

out = root / "known_urls.json"
out.write_text(json.dumps(sorted(keys), separators=(",", ":")), encoding="utf-8")
print(f"{len(keys)} known links -> {out.name}")
