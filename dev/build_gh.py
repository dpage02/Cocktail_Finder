"""Build the GitHub Pages copy of the Cocktail Finder from the Workshop source.
Usage: python3 build_gh.py [SHEET_URL]
Reads /home/claude/ws/index.html, writes /home/claude/gh/site/index.html."""
import sys, re, pathlib, json

SRC = pathlib.Path("/home/claude/ws/index.html")
OUT = pathlib.Path("/home/claude/gh/site/index.html")
CFG = pathlib.Path("/home/claude/gh/config.json")

cfg = json.loads(CFG.read_text()) if CFG.exists() else {}
if len(sys.argv) > 1:
    cfg["sheet_url"] = sys.argv[1]; CFG.write_text(json.dumps(cfg, indent=1))
url = cfg.get("sheet_url", "__SHEET_URL__")

s = SRC.read_text(encoding="utf-8")
shim = pathlib.Path("/home/claude/gh/shim.js").read_text(encoding="utf-8").replace("__SHEET_URL__", url, 1) if url != "__SHEET_URL__" else pathlib.Path("/home/claude/gh/shim.js").read_text(encoding="utf-8")


def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (a[:70], s.count(a))
    s = s.replace(a, b)


# 1. page title + the bridge, before any site script
rep("<meta charset=utf8>", '<meta charset=utf8><title>The Cocktail Finder</title><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E%F0%9F%8D%B8%3C/text%3E%3C/svg%3E">')
rep("</style></head><body>", "</style></head><body><script>\n" + shim + "\n</script>")

# 2. Design mode asks for the crew passcode the first time
rep("function setMode(mode) {\n", 'function setMode(mode) {\n  if (mode === "design" && window.CF && !CF.unlocked()) { CF.unlock().then((ok) => { if (ok) setMode("design"); }); return; }\n')

# 3. wording that only made sense inside Claude
s = s.replace("Saved on this screen only — not connected to the database", "Saved on this screen only — not connected to the crew sheet")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(s, encoding="utf-8")
print("wrote", OUT, f"{len(s)/1e6:.2f} MB", "sheet:", "set" if url != "__SHEET_URL__" else "NOT SET")
