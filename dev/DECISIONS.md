# Cocktail Finder — design decisions log

Every change we agree on goes here. Before each new round, check this list so nothing regresses.

## Keep (from the original working site — never drop these)
- All 3,669 real drinks, live search by name/ingredient
- Filters: family, spirit, flavor, ingredient accessibility, creator, classics vs riffs, "riffs on"
- Seasonal projects (Winter & Holiday, Fall, Spring, Summer, Dry January) with fit ratings
- "What can I make?" pantry matcher (can make now / 1–2 away)
- Syrups & preps tab
- Version pills on drinks that have multiple creators' versions; "Also featured in"; "See also"
- Random "great winter drinks" shuffle on the home view
- Review tools: "Needs a second look" tables with add/remove, 🤔 flags (saved to DB)

## Round 1 — 2026-11-03
- Added Preview / Design toggle (from the mockup). Remembers your last choice.
  - Preview hides: review/prospect tables, 🤔 flag buttons, "flagged only" filter, rating-engine explanation, "need a second look" count
  - Design shows all curation tools with a tinted background + banner
- Shorter intro line (from the mockup)
- Cards with no measurements show "Exact amounts not listed — pour is in the source ↗"

## Round 2 — 2026-11-03
- Main tab bar is exactly 3: **Drinks · What can I make? · Syrups & Preps** (Davis's call)
- Seasons/projects moved to an always-visible **Season** chip row under the search bar on Drinks
  (All · Winter & Holiday · Fall · Spring · Summer · Dry January). Picking one still shows that
  season's fit ratings, stat line, and (in Design mode) its review/prospect tables
- Season choice is kept when you hop to another tab and come back
- Season chips have no counts (every season showed ~3,590, which meant nothing)
- Syrups tab renamed "Syrups & Preps"; intro mentions tinctures, infusions, house liqueurs
- Phone: season chips scroll sideways in one line

## Round 3 — 2026-11-03 (Design mode workspace)
- In Design mode with a season picked, the drinks grid becomes **3 sections**:
  1. **In <season>** — cards that are live. Buttons: 🤔 Flag for review (moves to section 2, pinned on top) · ✕ Remove
     - Winter starts with the 247 hand-verified "Great"; Fall/Spring/Summer start empty; Dry January = its 79 drinks
  2. **Should work — needs a look** — full recipes with a real season cue (season word in the name, winter "needs a switch",
     holiday-coded, seasonal ingredient). Shows *why it's here*. Buttons: ✓ Yes (moves to 1) · ✗ No (removed)
  3. **Mentions the season — needs more thought** — titles without a usable recipe. ✓ Yes / ✗ No; decided ones fold into
     "Decided" with Undo + "Copy the track-down list". Season-titled ones sort first; "likely not a cocktail" last
- Every mark moves the card immediately, shows an Undo toast, and is saved to the database (owner-only writes)
- Removed drinks are kept in a "Removed from <season>" fold with Undo remove
- Preview respects your marks: Yes'd drinks show as Great, removed drinks disappear from that season
- Search box filters all three sections; batches of 24 cards / 30 rows with "Show more"

## Round 4 — 2026-11-03
- Design workspace sections are now **tabs**: In <season> · Needs a look · More thought (each shows its count;
  last tab you used is remembered). Rating stat row hidden in this view (tabs carry the counts)
- **One card per drink** checkbox next to the Season row (on by default, remembered). Same-name drinks collapse
  to the best version (your pick/rating first, then the one with real amounts); card lists "+N other versions"
  with links. Works in Preview and Design
  - In Design, Yes / No / Flag / Remove on a collapsed card applies to **all its versions** (toast says so; Undo covers all)
- **Filters work inside Design tabs** (family, spirit, flavor, ingredients, creator, classics/riffs, search) so you can
  take one family or spirit at a time. Season-rating chips hidden there (the tabs replace them)
- Cards in the In / Needs a look tabs are **grouped by family** with headings + counts (Sours, Hot Drinks, …)
- "Dry January" renamed **Mocktails** everywhere (chip, details label)

## Round 5 — 2026-11-04 (My Bar)
- "What can I make?" tab now has two sub-tabs: **What can I make?** and **My Bar** (main tab bar still 3)
- **My Bar** = the shelf, shared: anyone with the link can add/edit/86 (curation marks stay owner-only)
  - Enter a bottle name → tags auto-assigned from type words + ~300 brands (e.g. Smith & Cross → jamaican rum · aged rum · rum;
    "well tequila repo" → reposado tequila). Live preview before adding. Tags editable (× to remove, ＋ tag to add)
  - Grouped like a back bar: Spirits · Liqueurs & amari · Vermouth/fortified/wine · Bitters · Syrups & preps · Juice/fresh/dairy · Mixers
  - Quick-add staples chips (lemons, limes, simple, bitters, soda, eggs…)
  - **86 it** → crossed out; "Pouring instead:" type anything, or 💡 Suggest (closest bottles on the shelf; ⚠ marks a different spirit).
    "Back in stock" clears it. Delete has Undo
  - Syrups & Preps cards have "＋ On hand" to put a prep on the shelf
- **What can I make?** reads only from My Bar. Tabs: ✅ Make it now · 🔁 Easy swap · ⚠ Stretch · 🛒 1 away · 2 away
  - Easy swap = same kind (any rum for rum, rye for bourbon, any amaro for amaro, simple ↔ rich simple) — liberal, per Davis
  - Stretch = different spirit with a similar profile (bourbon for dark rum) → shown with ⚠ warning, still suggested
  - Each card lists what it's using: "↺ Espolon Blanco (in for 86'd Cimarron) for blanco tequila", "⚠ … — different spirit", "Missing: …"
  - 1 away shows **Best next pickup** (which single bottle/prep unlocks the most drinks)
  - Base-spirit filter chips; one card per drink; best-matching version picked automatically
- Fixed old bug: "ice" matched inside "juice", so every juice was assumed on hand. Garnishes, ice, water, sugar, salt, spices still ignored

## Round 6 — 2026-11-04 (season tiers)
- One season-fit engine, a profile per season (signature cues, supporting cues, anchor styles, clashes, swap suggestions).
  Tiers for **every** season: **Great · Needs a switch · Year-round fit · Neutral · Off-season**
  - Great = signature reason (season in name, defining ingredient, or anchor style: winter Hot Drinks/Flips & Eggnog,
    summer Tiki) AND nothing clashing. Garnishes and bitters never count toward a tier
  - Needs a switch = clearly seasonal, exactly one clash; card says "Make the switch: watermelon → cranberry"
  - Drinks named for another season (Coquito/"Christmas…" in summer) are Off-season
  - Hand-verified winter Great/Needs-a-switch always win; Design-mode Yes/No always win
- Season view in Preview defaults to **Great only**; a **Show** chip row (with counts) sits right under Season —
  tap to add Needs a switch / Year-round fit / etc. Hidden when Season = All. Old stat line removed (chips carry counts)
- Design "Needs a look" tab = engine's Great + Needs-a-switch not yet decided, Great first; reason line shows the why/swap
- Current counts (Great / Switch): winter 399/28 · fall 249/10 · spring 236/4 · summer 611/28

## Round 7 — 2026-11-04 (card editor + notes)
- Design mode: ✏️ on every card opens an editor (owner-only saves, stored in db "edits"; Reset to original anytime)
  - Spec lines editable; each line is **In the glass · Prep · ✕ remove**; "Prep is for" name (e.g. Strawberry simple syrup)
  - Occasion chips (Valentine's, Christmas, Halloween, Thanksgiving, St. Patrick's, Derby, Cinco de Mayo, 4th of July, …)
  - Note field + **✨ Apply my note**: Claude reads the note + spec and proposes edits (prep moves, added syrup line,
    occasions, family fix); you review → "Use these changes" → Save. Nothing auto-saves
  - Family dropdown for misfiled drinks
- Saved edits drive everything: card shows edited spec, a Prep box, occasion tags and the note; "amounts not listed"
  re-checks; season tiers re-score; What can I make? uses the edited spec; search finds occasions + notes
- Flavour flags (served hot / cream / egg) re-checked against the edited spec; "Hot Drinks" family dropped when no hot line remains
- An occasion you tag makes the drink **Great** for that occasion's season (Valentine's/Christmas/New Year's → winter,
  Halloween/Thanksgiving → fall, St. Patrick's/Easter/Derby/Cinco → spring, 4th of July/Memorial/Labor Day → summer)

## Round 8 — 2026-11-04
- Design workspace gets a 4th tab, **Browse by tier**: every drink in the season, filtered by the **Show** tier chips
  (Great / Needs a switch / Year-round fit / Neutral / Off-season) + all Filters, grouped by family, with ✏️ and
  Yes/No (or Flag/Remove if already in). Show chips appear in Design only on this tab (other tabs have their own lists)
- Fixed: "Port Charlotte" (Islay scotch) was read as port wine → wrongly Off-season in spring/summer. Port Ellen/Askaig etc. too

## Round 9 — 2026-11-04
- **Occasion filter** in Preview + Design: Filters panel "Occasion" chips (only occasions you've tagged, with counts);
  occasion tags on cards are tappable → shows every drink with that occasion; active "Occasion: X ✕" pill sits in the
  Season row. Picking an occasion switches Season to All (occasions cut across seasons)

## Round 10 — 2026-11-04 (＋ Add)
- New **＋ Add** main tab, **Design mode only** (Preview still shows exactly 3 tabs)
- **Add a cocktail**: link + creator + pasted caption/description/spec → ✨ Build the card (Claude) or Fill in by hand →
  review name, spec lines (In the glass / Prep / ✕), prep name, method/glass/garnish (→ card note), family, spirit,
  classic/riff + riff-on, occasions → Save. Saved to db "custom" (owner-only); behaves like every other drink
  (season tiers, My Bar matching, search, ✏️ edits). Prep also appears on Syrups & Preps. Link cleaned of tracking
  params; card source line reads "Watch on Instagram/YouTube ↗". Warns when the name already exists (becomes a version).
  "Cocktails you've added" list with Find it / Edit / Delete (Undo)
- **Sources**: everything in the archive with counts + **Add a source**. YouTube/websites → "Waiting to import" with
  📋 Copy import request (paste to terminal Claude, which runs the original pipeline) + Mark imported.
  Instagram/TikTok → "Add by hand" (no scraping). New creators from added cocktails are remembered automatically
- **Instagram rule**: no scraping or automated reading (Instagram's terms forbid it; their API only covers accounts you
  manage; Claude's fetch is blocked by Instagram). Capture = paste caption (or screenshot to Claude in chat) + link
- Primary buttons (Build the card / Save / Add) now styled

## Round 11 — 2026-11-04
- My Bar: **📋 Paste a whole list** — paste many bottles at once (new lines, commas, semicolons, tabs); strips bullets,
  numbering, "x2" and "(3 bottles)" counts; live preview of every bottle with its auto-tags; duplicates (already on the
  shelf or repeated in the list) skipped; unrecognised names still added and flagged to tag; **Add all N** with Undo

## Round 12 — 2026-11-04
- Flavoured-syrup matching: a shelf "Cinnamon syrup" covers cinnamon simple / rich / demerara / infused / bark / spiced
  cinnamon syrup (✅ exact); "cinnamon maple" or "cinnamon honey" syrup = 🔁 easy swap. Hyphens read as spaces.
  Plain "cinnamon" (ground, sticks) is a pantry spice/garnish and never blocks a drink. Same logic for every flavour

## Round 13 — 2026-11-05 (preps + What's new)
- **What's new** button under the header stats (count badge = last 14 days), everyone sees it: dated list of
  cocktails added, sources added/imported, prep recipes added, cards updated (prep split, occasions, note, family),
  each with "See it". Built from saved timestamps — nothing extra to maintain
- **House-made prep detection**: flavoured syrups, infusions/fat-washes, homemade liqueurs, cordials, shrubs,
  tinctures, oleo, clarified juices, "(recipe below)" — but not plain sweeteners (simple/demerara/honey/maple/agave…),
  store-bought brands, grenadine/orgeat/falernum. ~250 distinct preps across the archive; ~40 had recipes on file
- Cards: house-made ingredient gets **🧪 recipe** (jumps to that prep on Syrups & Preps, highlighted) or, in Design,
  **🧪 no recipe yet**. Prep cards show "Used in …" links back to the drinks
- Syrups & Preps (Design only): **Missing prep recipes**, grouped by creator (Rob's Home Bar etc.), each with the
  drinks + source videos, **＋ Add recipe** by hand (db "preps", owner-only) and **📋 Copy request for terminal Claude**
  to pull the recipes from the video descriptions (Claude here can't reach YouTube)
- **Auto-add preps**: a prep split out in a card edit or an added cocktail is checked against Syrups & Preps by flavour
  words (so "Strawberry Simple Syrup (A Bar Above)" = existing "Strawberry Simple Syrup"); added only if it's not there

## Round 14 — 2026-11-05 (syrups grouped)
- Syrups & Preps grouped by flavour (Cinnamon Syrup, Cranberry Syrup, Raspberry Syrup, Pumpkin Spice, Gardenia…),
  variations side by side under one heading with a version count; single recipes under "One of a kind"
- **Exact duplicates merged**: same ingredients ignoring amounts/prep words (muddled, sliced, granulated…) → one card
  with "Same recipe also from: <creator links>"; 🧪 links and "Used in" follow the merged card
- Infused spirits, liqueurs, shrubs, bitters never group with syrups (Strawberry Vodka ≠ Strawberry Syrup);
  generic words (spice, milk, cream, tea…) never act as a flavour home
- Data fix: Rob's "Pumpkin Spice Syrup (2025 Edition)" was split into 3 cards — stitched back into one
- Parked: junk/mis-split prep entries to clean up (e.g. "Half Vanilla Bean", "Peel of One Lemon", "Filtered with
  Pecan Butter", "Cream", "ICE CREAM" — pieces of other recipes)

## Round 15 — 2026-11-05 (seasons & occasions on preps)
- Syrups & Preps get the same season engine (lighter "Great" bar for preps) and occasion tags
  - Cards show green season tags for every season they're Great in (hover = why) + occasion tags
  - Tab has **Season** chips (default Great + Needs a switch; "Include year-round preps" checkbox) and **Occasion** chips
  - Occasions auto-read from the name ("Christmas Syrup" → Christmas); ✏️ on prep cards (Design) toggles occasions,
    saved to db "prepedits" and listed in What's new as "Prep updated"
  - Prep method lines (hot/boiling water, vinegar, simmer/steep/strain) never count toward a season
- Engine fixes that also help cocktails: "fresh or frozen berries" ≠ a frozen drink; "Bay Leaf" ≠ fall leaves
- Counts (Great): winter 20 · fall 9 · spring 14 · summer 8 preps

## Round 16 — 2026-11-05 (prep review + custom occasions)
- Syrups & Preps in Design has tabs: **All preps · Needs a second look · Missing recipes** (Preview: just the list)
  - Needs a second look auto-flags: names to clean ("For…", "To Make…", "Recipe for…", how-to titles), fragments of
    other recipes ("Half Vanilla Bean", "Peel of One Lemon"), one-line recipes, drinks filed as preps (punch, granita,
    ice cream), and anything you 🤔 flag. Actions: ✓ Looks good · ✏️ Fix (rename + edit lines) · ✕ Remove (Removed fold
    with Restore). Saved in db "prepedits"; removed preps vanish from Preview, 🧪 links and matching
  - Names auto-tidied everywhere: hashtags and video timestamps stripped, ALL CAPS → Title Case
- **Custom occasions** (＋ Add → Occasions): name + optional season + "what fits it"; work everywhere built-ins do
  (card editor chips, Occasion filter, prep tags, season tier if a season is set)
  - **✨ Find drinks for this** (custom or built-in): Claude turns the occasion into keywords/ingredients → the site
    shortlists ~70 drinks + 20 preps from the whole archive → Claude picks the real fits with a short reason → you
    untick misses → **Tag selected**. Bulk tags stored in db "occtags" (separate from card edits; removing the occasion
    in the card editor removes the tag). What's new shows one line per occasion per day

## Round 17 — 2026-11-05 (prep editor)
- ✏️ on a prep card (Design) opens: **Seasons** chips (on/off — your choice overrides the automatic rating for both the
  green tags and the Season filter), **Occasions** chips (on/off, including ones auto-read from the name), and a free
  **Note** (shown on the card) with **✨ Apply my note** → Claude proposes season/occasion changes → review → Save
- Saved in db "prepedits" (seasonsOn/seasonsOff/occasions/removed/note); What's new shows the changes
- 8 sources added from Instagram finds (7 websites queued for terminal Claude import incl. "import the rest" for
  Emily Laurae + The Mindful Mocktail; @uglygarnish = add by hand)

## Ideas parked (not yet decided)
- Default the Season row to the current season automatically?
- Clean drink names (strip YouTube video titles)
- Collapse more duplicates into one card per drink
- Slimmer cards with expand-for-details
- Hide incomplete recipes by default
- Mobile: tabs/search placeholder/filters panel

## Round 18 (Nov 9): crew can add drinks
- Add tab renamed "＋ Add a drink". Form is two numbered steps: 1 Where it's from (optional, ✨ fills the card), 2 The drink (always open, Save always visible, errors shown next to Save).
- "Fill in by hand" renamed "Copy caption into the spec".
- Database writes opened to everyone who can open the Workshop (was owner-only except My Bar). Keep the Workshop shared by name, not public, or strangers can edit.

## Round 19 (Nov 11): link-only adds + "Needs specs"
- Adding a drink can be just a link. Nightly job tries the caption (TikTok/YouTube/web; Instagram can't be read unless the caption was pasted).
- Recipe in caption -> full card. No recipe -> keep it, flag "Needs specs": Design list with ▶ Watch + Add specs, count on tab.
- Build now on Claude or with the GitHub Pages move: undecided.

## Parked: GitHub Pages move (free version)
- Site on GitHub Pages; shared data in a Google Sheet via Apps Script (instant saves, "New" tag); crew passcode for Design.
- Nightly: Apps Script pushes new rows to the repo; scheduled Claude task enriches (cards, tags, preps, dupes) and commits. Review tab for unsure items.

## Round 20 (Nov 11): moved to GitHub Pages
- Repo: github.com/dpage02/Cocktail_Finder (public). Site: https://dpage02.github.io/Cocktail_Finder/
- Source of truth stays ws/index.html; gh/build_gh.py makes the GitHub copy (adds the crew-sheet bridge + passcode gate), then copy to the repo and push.
- Crew data in a Google Sheet via apps-script/Code.gs (Settings B1 = passcode; Data, Added drinks, Log tabs). ✨ features hidden off Claude.
- Nov 11: sheet "Cocktail Finder: Crew Data" created + Apps Script "Cocktail Finder Crew Backend" deployed (Version 1). Site wired to it; read + passcode check verified live.

## Round 21 (Nov 11): add a drink from a link
- Step 1 "Paste the link" + Pull from link (sheet script reads: YouTube via YouTube Data API service, TikTok oEmbed, recipe sites' JSON-LD, Instagram embed when allowed).
- Caption reader (parse.js, no AI): ingredients vs prep (syrup sections, cups/grams), method, glass, garnish; skips promo/tools/timestamps; multi-recipe posts fill the first and list the rest.
- Step 2 "Check the card": Still needed / Nice to have; family + spirit guessed and labeled.
- Save link for later -> Needs specs list (▶ Watch, Add specs). Script deployment now Version 4, same URL.
- Parked (Nov 11): nicer address. Options: free GitHub org (e.g. rallycocktails.github.io) or a custom domain. Keeping dpage02.github.io/Cocktail_Finder for the proof of concept.

## Round 22 (Nov 22): channels refresh themselves + spring browsing + flow fixes
- **Daily channel refresh in the crew sheet** (Apps Script, hourly trigger; each channel checked once a day). Claude can't
  reach YouTube, so the sheet does it with the YouTube Data API it already had for Pull from link.
  - YouTube: new uploads since the newest video already in the archive (latest 50). Websites: sitemap → Queue tab → read in batches;
    only pages with a recipe card that looks like a drink. Existing sites look back 60 posts the first time; new sources import everything.
  - Built in: 12 YouTube channels + Educated Barfly site, A Bar Above, Good Old Fashioned Lovers. Plus every source on the site's
    Sources tab (the 7 queued sites). Instagram/TikTok/Linktree = add by hand (Gimlets & Gardens, Ugly Garnish).
  - Never re-imports: skips links in `known_urls.json` (built by dev/build_known.py), crew-added drinks, and anything already queued.
  - Site reads collection `imports`, runs the caption reader: recipe → card with **NEW** tag (14 days), sorted first; no recipe →
    "New videos, no recipe in the description" (Design, ＋ Add a drink) with Watch / Add specs / Not a drink. Remove/Not a drink is
    remembered (custom/<id> = removed). ✏️ edits work like any card. What's new groups them: "New from <creator>: N new drinks".
  - Sources tab: Auto-refresh list (last checked, pulled in, still to read); queued sources show their auto-import status.
  - Needs a one-time `installSchedule()` run in the sheet (SETUP.md Part 3).
- **Spring (light touch, not a project):** pick a season → **Try** row of flavour chips (spring: strawberry, rhubarb, elderflower,
  lychee, yuzu, cucumber, lavender, basil, hibiscus, grapefruit; also summer/fall/winter sets). Tap = search that season for it.
  Within each family, NEW drinks then full recipes (with amounts) sort first.
- **Flow fixes:** phone search box no longer pushes Filters off screen (shorter placeholder on phones); source link no longer repeats the
  drink name ("Watch on YouTube ↗" instead); header drink/source counts update when new drinks arrive; intro line says "pick a season".
- Nov 22 (later): refresh changed from daily to **weekly, Sunday ~6 AM** (Davis: "every Friday or Sunday"). `REFRESH_DAY_` in Code.gs
  switches the day. Leftover website posts get 10-minute follow-up runs (`refreshFollowUp`) until the queue is empty.
