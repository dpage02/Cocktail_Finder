# Setting up The Cocktail Finder on GitHub Pages

Two one-time jobs, about 20 minutes total. After this, the crew uses one normal link,
signs in to Design mode with a crew passcode, and everything they save lands in your Google Sheet.

---

## Part 1: The crew Google Sheet (about 15 min)

1. Go to **sheets.new** (signed in to the Google account you want to own the data).
   Name the sheet **Cocktail Finder: Crew Data**.
2. In the sheet, click **Extensions → Apps Script**. A code editor opens in a new tab.
3. Delete everything in the editor. Open **apps-script/Code.gs** from this repo, copy all of it,
   and paste it in. Click the **Save** icon (💾).
4. In the toolbar's function dropdown, pick **setup**, then click **Run**.
   - Google asks for permission. Click **Review permissions**, choose your account.
   - You'll see "Google hasn't verified this app." That's expected: it's your own script.
     Click **Advanced → Go to (project name) (unsafe) → Allow**.
   - Back in the sheet you'll now have tabs: **Settings, Data, Added drinks, Log**.
5. In the **Settings** tab, change cell **B1** from `change-me` to the crew passcode.
6. Back in the Apps Script tab: **Deploy → New deployment**.
   - Click the gear next to "Select type" and pick **Web app**.
   - **Execute as:** Me. **Who has access:** Anyone.
   - Click **Deploy**, then copy the **Web app URL** (it ends in `/exec`).
7. **Send that URL to Claude.** It gets wired into the site, and saving starts working.

> "Anyone" only means the site can reach the sheet. Viewing is open (it's the same drinks the
> site shows), but **saving requires the crew passcode**. Nobody can open your actual sheet
> unless you share it with them.

---

## Part 2: Turn on GitHub Pages (about 2 min)

1. Open **github.com/dpage02/Cocktail_Finder → Settings → Pages**.
2. Under **Build and deployment**, Source: **Deploy from a branch**.
   Branch: **main**, folder **/ (root)**. Click **Save**.
3. Wait a minute, refresh. The link appears at the top:
   **https://dpage02.github.io/Cocktail_Finder/**

That's the link for the crew.

---

## Day to day

- **Browsing:** anyone with the link. No passcode, no account.
- **Design mode / saving:** the first time on a device, it asks for the **crew passcode** and a **name**.
  The device remembers both. The name is what shows as "last saved by" in the sheet.
- **Changing the passcode:** edit **Settings → B1**. Everyone re-enters the new one next time they save.
- **Seeing what changed:** the **Log** tab lists every save (when, who, what).
  **Added drinks** is a readable list of drinks the crew added.
- **Fixing something by hand:** edit the **Added drinks** tab for reference, but the site reads the
  **Data** tab. Easiest is to fix it on the site.
- **Design changes:** ask Claude. It pushes to this repo and the site updates within about a minute.

## If you ever change Code.gs

Use **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
That keeps the same URL. (A brand-new deployment makes a new URL, and the site would need updating.)

## Part 3: Turn on the weekly channel refresh (about 5 min, once)

This makes the sheet check every YouTube channel and recipe website on its own and pull new drinks in.

1. Open the crew sheet → **Extensions → Apps Script**.
2. Select everything in **Code.gs**, delete it, and paste in the new **apps-script/Code.gs** from this repo. Save (💾).
3. Check the left sidebar under **Services**: **YouTube Data API v3** should be listed (it was added for Pull from link).
   If it isn't: click **＋** next to Services, pick **YouTube Data API v3**, **Add**.
4. In the function dropdown pick **installSchedule** → **Run**. Allow the new permission if Google asks
   (it needs "run when you're not there" for the schedule).
   - The first run takes a few minutes. You'll get two new tabs: **Channels** and **Queue**.
5. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy** (same URL as before).

What happens after that:
- **Every Sunday around 6 AM** the sheet checks every channel: new YouTube uploads, new website posts.
  (Want Friday instead? In Code.gs change `REFRESH_DAY_ = "SUNDAY"` to `"FRIDAY"`, save, and run **installSchedule** again.)
- New YouTube videos come in straight away. Website posts go to the **Queue** tab and get read a batch at a time;
  if some are left, the sheet runs again every 10 minutes until they're done (a big site like Emily Laurae's takes
  a couple of hours the first time), then waits for next week.
- The first run happens right when you click Run on installSchedule, so you don't have to wait for Sunday.
- Only drinks that aren't already in the archive come in. Website posts that aren't drink recipes are skipped.
- On the site: drinks with a recipe show up on Drinks with a **NEW** tag (for 14 days) and in **What's new**.
  Videos with no recipe in the description go to **＋ Add a drink → New videos, no recipe**: Add specs, or Not a drink.
- **Channels** tab: one row per channel with when it was last checked and how many came in. To stop one,
  type **paused** in its **status** cell. New sources added on the site's **Sources** tab are picked up automatically
  (YouTube and websites; Instagram/TikTok stay add-by-hand).
- Something wrong? The **Log** tab has a line for every run that found something, and any errors.

## What doesn't work here (vs. the Claude version)

The ✨ buttons (Build the card, note rewrites, find drinks for an occasion) need Claude, so they're
hidden on this site. Add drinks with Pull from link, or let the weekly channel refresh bring them in.
