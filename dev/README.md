# Dev notes (for future Claude sessions)

- The live site is `index.html` in the repo root. Edit it directly and push; GitHub Pages updates in about a minute.
- `shim.js` is the bridge already inlined at the top of `index.html` (crew Google Sheet storage, passcode sign-in, link pulling).
- `parse.js` is the caption reader already inlined in `index.html` (search for "Spec reader").
- `build_gh.py` was how the GitHub copy was built from the old Claude Workshop source; not needed for direct edits.
- `DECISIONS.md` is the full decision log (rounds 1–21+). Read it before redesigning anything.
- Sheet script: `apps-script/Code.gs`. After changing it, paste into the sheet's Apps Script editor and Deploy → Manage deployments → Edit → New version (keeps the same URL).
