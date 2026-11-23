/**
 * The Cocktail Finder: crew sheet backend.
 * Paste this whole file into Extensions > Apps Script in the crew Google Sheet.
 * Then run setup() once, and Deploy > New deployment > Web app
 *   (Execute as: Me, Who has access: Anyone). See SETUP.md.
 *
 * Channel refresh: run installSchedule() once (see SETUP.md). After that the sheet checks every
 * YouTube channel and recipe website once a day and pulls new drinks in on its own.
 *
 * Tabs it uses:
 *   Settings     B1 = crew passcode (change it any time; everyone signs in again)
 *   Data         one row per saved item (the site reads this). Don't rearrange columns.
 *   Added drinks a readable copy of drinks the crew added
 *   Log          every change: when, who, what
 *   Channels     one row per channel the refresh watches (status, last checked, counts) — read-only
 *   Queue        website posts found and waiting to be read — read-only
 */

const DATA_HEADERS = ["collection", "id", "json", "updated", "by", "deleted"];
const ADDED_HEADERS = ["id", "drink", "creator", "link", "ingredients", "prep", "method / glass / garnish", "last saved by", "updated", "status"];

function setup() {
  const ss = SpreadsheetApp.getActive();
  const tab = (name, headers) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (headers && sh.getLastRow() === 0) { sh.appendRow(headers); sh.setFrozenRows(1); sh.getRange(1, 1, 1, headers.length).setFontWeight("bold"); }
    return sh;
  };
  const st = tab("Settings");
  if (!st.getRange("A1").getValue()) {
    st.getRange("A1:B1").setValues([["Crew passcode", "change-me"]]);
    st.getRange("A3").setValue("Change B1 to the passcode you'll give the crew. Changing it later signs everyone out.");
    st.getRange("A1").setFontWeight("bold");
  }
  tab("Data", DATA_HEADERS);
  tab("Added drinks", ADDED_HEADERS);
  tab("Log", ["when", "who", "action", "item"]);
  const first = ss.getSheetByName("Sheet1");
  if (first && first.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "all";
  if (action !== "all") return json_({ ok: false, error: "unknown_action" });
  const sh = SpreadsheetApp.getActive().getSheetByName("Data");
  const vals = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, DATA_HEADERS.length).getValues() : [];
  const rows = [];
  vals.forEach((r) => {
    if (!r[0] || !r[1]) return;
    if (r[5] === true || r[5] === "TRUE") { rows.push({ c: String(r[0]), id: String(r[1]), deleted: true }); return; }
    try { rows.push({ c: String(r[0]), id: String(r[1]), data: JSON.parse(r[2]) }); } catch (err) {}
  });
  return json_({ ok: true, rows: rows });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: "bad_request" }); }
  const ss = SpreadsheetApp.getActive();
  const code = String(ss.getSheetByName("Settings").getRange("B1").getValue()).trim();
  if (!code || String(body.passcode || "").trim() !== code) return json_({ ok: false, error: "bad_passcode" });
  if (body.action === "check") return json_({ ok: true });
  if (body.action === "fetch") {
    try { return json_(Object.assign({ ok: true }, fetchLink_(String(body.url || "")))); }
    catch (err) { return json_({ ok: false, error: "fetch_failed", detail: String(err).slice(0, 200) }); }
  }

  const path = String(body.path || "");
  const parts = path.split("/");
  if (parts.length !== 2 || !/^[A-Za-z_]+$/.test(parts[0]) || !parts[1]) return json_({ ok: false, error: "bad_path" });
  const c = parts[0], id = parts[1], who = String(body.who || "").slice(0, 60), now = new Date();
  if (body.action !== "set" && body.action !== "delete") return json_({ ok: false, error: "unknown_action" });
  const text = body.action === "set" ? JSON.stringify(body.data == null ? {} : body.data) : "";
  if (text.length > 45000) return json_({ ok: false, error: "too_large" });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = ss.getSheetByName("Data");
    const n = sh.getLastRow() - 1;
    const keys = n > 0 ? sh.getRange(2, 1, n, 2).getValues() : [];
    let row = -1;
    for (let i = 0; i < keys.length; i++) if (keys[i][0] === c && String(keys[i][1]) === id) { row = i + 2; break; }
    const values = [[c, id, text, now, who, body.action === "delete"]];
    if (row > 0) sh.getRange(row, 1, 1, DATA_HEADERS.length).setValues(values);
    else sh.appendRow(values[0]);

    if (c === "custom") mirrorDrink_(ss, id, body.action === "set" ? body.data : null, who, now);
    ss.getSheetByName("Log").appendRow([now, who, body.action, path + (body.data && body.data.title ? "  (" + body.data.title + ")" : body.data && body.data.name ? "  (" + body.data.name + ")" : "")]);
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true });
}

function mirrorDrink_(ss, id, d, who, now) {
  const sh = ss.getSheetByName("Added drinks");
  const n = sh.getLastRow() - 1;
  const ids = n > 0 ? sh.getRange(2, 1, n, 1).getValues().map((r) => String(r[0])) : [];
  const at = ids.indexOf(id);
  let values;
  if (d) {
    values = [id, d.title || "", d.creator || "", d.url || "", (d.ing || []).join("\n"), (d.prep || []).join("\n"), d.note || "", who, now, "on the site"];
  } else {
    if (at < 0) return;
    values = sh.getRange(at + 2, 1, 1, ADDED_HEADERS.length).getValues()[0];
    values[8] = now; values[9] = "deleted";
  }
  if (at >= 0) sh.getRange(at + 2, 1, 1, ADDED_HEADERS.length).setValues([values]);
  else sh.appendRow(values);
}

// ---------- Link reader: pulls title, creator and caption/description from a post ----------
const UA_ = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", "Accept-Language": "en-US,en;q=0.9" };

function get_(url) {
  const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: UA_ });
  return { code: r.getResponseCode(), text: r.getContentText() };
}
function decodeEntities_(s) {
  return String(s || "").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}
function meta_(html, prop) {
  const m = html.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + prop + '["\'][^>]+content=["\']([^"\']*)', "i"))
    || html.match(new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']' + prop + '["\']', "i"));
  return m ? decodeEntities_(m[1]) : "";
}
function stripHtml_(h) {
  return decodeEntities_(String(h || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|li|div|h\d)>/gi, "\n").replace(/<[^>]+>/g, "")).replace(/\n{3,}/g, "\n\n").trim();
}
function jsonLdRecipe_(html) {
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const b of blocks) {
    let data;
    try { data = JSON.parse(b.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "")); } catch (e) { continue; }
    const stack = [data];
    while (stack.length) {
      const x = stack.pop();
      if (!x || typeof x !== "object") continue;
      if (Array.isArray(x)) { x.forEach((y) => stack.push(y)); continue; }
      const t = [].concat(x["@type"] || []);
      if (t.indexOf("Recipe") >= 0) {
        const steps = [];
        const walk = (s) => { if (!s) return; if (typeof s === "string") steps.push(stripHtml_(s)); else if (Array.isArray(s)) s.forEach(walk); else if (s.itemListElement) walk(s.itemListElement); else if (s.text) steps.push(stripHtml_(s.text)); };
        walk(x.recipeInstructions);
        const author = [].concat(x.author || [])[0];
        return { title: x.name || "", author: author ? (author.name || String(author)) : "", ingredients: [].concat(x.recipeIngredient || []).map(stripHtml_), instructions: steps, text: stripHtml_(x.description || ""),
          category: [].concat(x.recipeCategory || [], x.recipeCuisine || [], x.keywords || []).join(", "), image: [].concat(x.image || []).map((i) => (i && i.url) || i).filter((i) => typeof i === "string")[0] || "" };
      }
      if (x["@graph"]) stack.push(x["@graph"]);
    }
  }
  return null;
}

function fetchLink_(url) {
  if (!/^https?:\/\//i.test(url)) throw new Error("not a link");
  const host = url.toLowerCase();

  if (/youtube\.com|youtu\.be/.test(host)) {
    const id = (url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/) || [])[1];
    if (!id) throw new Error("no video id");
    let text = "", title = "", author = "", how = [];
    // Best source: YouTube Data API (Services > YouTube Data API v3 in the script editor). Free, reads full descriptions.
    try {
      if (typeof YouTube !== "undefined") {
        const v = YouTube.Videos.list("snippet", { id: id }).items || [];
        if (v.length) { text = v[0].snippet.description || ""; title = v[0].snippet.title || ""; author = v[0].snippet.channelTitle || ""; how.push("API"); }
      }
    } catch (e) { how.push("API-err"); }
    for (const client of [{ clientName: "WEB", clientVersion: "2.20241101.00.00" }, { clientName: "ANDROID", clientVersion: "19.09.37", androidSdkVersion: 30 }, { clientName: "IOS", clientVersion: "19.09.3" }]) {
      if (text || how.indexOf("API") >= 0) break;
      const r = UrlFetchApp.fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
        method: "post", contentType: "application/json", muteHttpExceptions: true, headers: UA_,
        payload: JSON.stringify({ videoId: id, context: { client: Object.assign({ hl: "en", gl: "US" }, client) } }),
      });
      how.push(client.clientName + ":" + r.getResponseCode());
      if (r.getResponseCode() !== 200) continue;
      try {
        const v = (JSON.parse(r.getContentText()).videoDetails) || {};
        text = v.shortDescription || ""; title = title || v.title || ""; author = author || v.author || "";
      } catch (e) {}
    }
    const page = text || how.indexOf("API") >= 0 ? { text: "" } : get_("https://www.youtube.com/watch?v=" + id + "&hl=en");
    const d = page.text.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
    if (!text && d) { try { text = JSON.parse('"' + d[1] + '"'); } catch (e) {} }
    if (!text) text = meta_(page.text, "og:description") || meta_(page.text, "description");
    const t = !title && page.text.match(/"videoDetails":\{[^}]*?"title":"((?:[^"\\]|\\.)*)"/);
    if (t && !title) { try { title = JSON.parse('"' + t[1] + '"'); } catch (e) {} }
    const a = !author && page.text.match(/"ownerChannelName":"((?:[^"\\]|\\.)*)"/) || page.text.match(/"author":"((?:[^"\\]|\\.)*)"/);
    if (a && !author) { try { author = JSON.parse('"' + a[1] + '"'); } catch (e) {} }
    if (!title || !author) {
      const o = get_("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + id));
      if (o.code === 200) { const j = JSON.parse(o.text); title = title || j.title; author = author || j.author_name; }
    }
    return { platform: "YouTube", title: title, author: author, text: text, how: how.join(" ") };
  }

  if (/tiktok\.com/.test(host)) {
    const o = get_("https://www.tiktok.com/oembed?url=" + encodeURIComponent(url));
    if (o.code !== 200) return { platform: "TikTok", title: "", author: "", text: "" };
    const j = JSON.parse(o.text);
    return { platform: "TikTok", title: "", author: j.author_unique_id ? "@" + j.author_unique_id : j.author_name || "", text: j.title || "" };
  }

  if (/instagram\.com/.test(host)) {
    const code = (url.match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]+)/) || [])[1];
    let text = "", author = "";
    if (code) {
      const e = get_("https://www.instagram.com/p/" + code + "/embed/captioned/");
      if (e.code === 200) {
        const cap = e.text.match(/<div class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments"/i) || e.text.match(/class="Caption"[^>]*>([\s\S]*?)<\/div>/i);
        if (cap) {
          let c = cap[1].replace(/<a[^>]+class="CaptionUsername"[^>]*>([\s\S]*?)<\/a>/i, (m, u) => { author = "@" + stripHtml_(u); return ""; });
          text = stripHtml_(c);
        }
        if (!author) { const u = e.text.match(/class="UsernameText"[^>]*>([^<]+)</i); if (u) author = "@" + u[1].trim(); }
      }
    }
    return { platform: "Instagram", title: "", author: author, text: text };
  }

  const page = get_(url);
  if (page.code >= 400) throw new Error("page returned " + page.code);
  const recipe = jsonLdRecipe_(page.text);
  const site = host.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  if (recipe) return Object.assign({ platform: site }, recipe);
  const body = (page.text.match(/<article[\s\S]*?<\/article>/i) || page.text.match(/<main[\s\S]*?<\/main>/i) || [""])[0];
  return {
    platform: site,
    title: meta_(page.text, "og:title") || stripHtml_((page.text.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || ""),
    author: meta_(page.text, "author") || meta_(page.text, "og:site_name"),
    text: (stripHtml_(body.replace(/<(script|style|nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi, "")) || meta_(page.text, "og:description")).slice(0, 6000),
  };
}

// =====================================================================================
// ---------- Channel refresh: pulls new drinks from every channel, on a schedule ----------
// =====================================================================================
// installSchedule() — run once from the editor. Sets an hourly trigger for refreshChannels().
// Each run: checks channels not checked in the last 20 hours (new YouTube uploads, new website
// posts), then reads queued website posts until the time budget runs out. New drinks are saved
// to Data as collection "imports"; the site turns each into a card (recipe found) or puts it on
// the "New videos, no recipe" review list. Links already in the archive are skipped
// (known_urls.json on the site), so nothing is imported twice.

const SITE_ = "https://dpage02.github.io/Cocktail_Finder/";
const RUN_BUDGET_MS_ = 4.5 * 60 * 1000;   // Apps Script stops runs at 6 minutes
const CHANNEL_HEADERS_ = ["channel", "kind", "where", "creator name on cards", "status", "last checked", "found (total)", "imported (total)", "skipped (total)", "waiting", "note", "uploads"];
const QUEUE_HEADERS_ = ["url", "channel", "found", "status", "detail"];

// Channels already in the archive. YouTube: any one video from the channel (the script finds the channel from it).
// backlog: how many older posts to look back through the first time (0 = only posts newer than the newest one we have).
const BUILTIN_CHANNELS_ = [
  { name: "Common Man Cocktails", kind: "youtube", where: "https://www.youtube.com/watch?v=Xr0iaNXgJ0E" },
  { name: "How to Drink", kind: "youtube", where: "https://www.youtube.com/watch?v=q1n9NMs53jg" },
  { name: "The Educated Barfly", kind: "youtube", where: "https://www.youtube.com/watch?v=mROfjvo0siM" },
  { name: "Small Screen", kind: "youtube", where: "https://www.youtube.com/watch?v=AhZDPrMp1HU" },
  { name: "Behind the Bar", kind: "youtube", where: "https://www.youtube.com/watch?v=tQHa3mW90eY" },
  { name: "Steve the Bartender", kind: "youtube", where: "https://www.youtube.com/watch?v=Bomhp-MXPmw" },
  { name: "Rob's Home Bar", kind: "youtube", where: "https://www.youtube.com/watch?v=n672OrDcmFk" },
  { name: "Anders Erickson", kind: "youtube", where: "https://www.youtube.com/watch?v=9OxlSOioD_k" },
  { name: "Make and Drink", kind: "youtube", where: "https://www.youtube.com/watch?v=jUHZoRY6prc" },
  { name: "Bad Birdy", kind: "youtube", where: "https://www.youtube.com/watch?v=fZX121OqhhM" },
  { name: "Lui Fernandes", kind: "youtube", where: "https://www.youtube.com/watch?v=qqSsi1rBJHk" },
  { name: "The Mindful Mocktail", kind: "youtube", where: "https://www.youtube.com/watch?v=IYU-e53y1Ec" },
  { name: "The Educated Barfly (website)", creator: "The Educated Barfly", kind: "site", where: "https://theeducatedbarfly.com", backlog: 60 },
  { name: "A Bar Above", kind: "site", where: "https://abarabove.com", backlog: 60 },
  { name: "Good Old Fashioned Lovers", kind: "site", where: "https://goodoldfashionedlovers.substack.com", backlog: 30 },
];

function installSchedule() {
  setup();
  const ss = SpreadsheetApp.getActive();
  [["Channels", CHANNEL_HEADERS_], ["Queue", QUEUE_HEADERS_]].forEach(([n, h]) => {
    let sh = ss.getSheetByName(n);
    if (!sh) sh = ss.insertSheet(n);
    if (sh.getLastRow() === 0) { sh.appendRow(h); sh.setFrozenRows(1); sh.getRange(1, 1, 1, h.length).setFontWeight("bold"); }
  });
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === "refreshChannels").forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("refreshChannels").timeBased().everyHours(1).create();
  refreshChannels();
}

function key_(u) {
  u = String(u || "").trim();
  if (!u) return "";
  const m = u.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/);
  if (m && /youtube\.com|youtu\.be/i.test(u)) return "yt:" + m[1];
  return u.replace(/^https?:\/\//i, "").toLowerCase().replace(/^www\./, "").split(/[?#]/)[0].replace(/\/+$/, "");
}
function importId_(k) {
  return "i_" + Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, k).map((b) => ((b + 256) % 256).toString(16).padStart(2, "0")).join("").slice(0, 14);
}
function readTab_(name, width) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  const n = sh.getLastRow() - 1;
  return { sh: sh, rows: n > 0 ? sh.getRange(2, 1, n, width).getValues() : [] };
}

// Every channel to watch: built-ins + sources added on the site (seed.json and the Data tab).
function channelList_(dataRows) {
  const out = BUILTIN_CHANNELS_.map((c) => Object.assign({ backlog: 0 }, c));
  const have = new Set(out.map((c) => c.name));
  const sources = [];
  try { const seed = JSON.parse(get_(SITE_ + "seed.json?t=" + Date.now()).text); Object.values(seed.sources || {}).forEach((s) => sources.push(s)); } catch (e) {}
  dataRows.forEach((r) => { if (r[0] === "sources" && !(r[5] === true || r[5] === "TRUE")) { try { sources.push(JSON.parse(r[2])); } catch (e) {} } });
  sources.forEach((s) => {
    if (!s || !s.url || !s.name) return;
    const u = s.url.toLowerCase();
    const isYt = /youtube\.com|youtu\.be/.test(u);
    let name = s.name;
    if (have.has(name)) {   // same creator, different place (e.g. their YouTube is built in, this is their website)
      const twin = out.find((c) => c.name === name);
      if (!twin || twin.kind === (isYt ? "youtube" : "site")) return;
      name = name + (isYt ? " (YouTube)" : " (website)");
      if (have.has(name)) return;
    }
    have.add(name);
    if (/instagram\.com|tiktok\.com|linktr\.ee|facebook\.com/.test(u)) { out.push({ name: name, creator: s.name, kind: "manual", where: s.url, note: "Instagram/TikTok/Linktree can't be read automatically — add their drinks by hand" }); return; }
    out.push({ name: name, creator: s.name, kind: isYt ? "youtube" : "site", where: s.url, backlog: 100000 });   // new source: import everything
  });
  return out;
}

function refreshChannels() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;    // a run is already going
  lock.releaseLock();                  // don't hold the crew's save lock for the whole run
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("refreshRunning") && Date.now() - Number(props.getProperty("refreshRunning")) < 6 * 60 * 1000) return;
  props.setProperty("refreshRunning", String(Date.now()));
  const start = Date.now();
  const timeLeft = () => RUN_BUDGET_MS_ - (Date.now() - start);
  const ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName("Channels") || !ss.getSheetByName("Queue")) { props.deleteProperty("refreshRunning"); installSchedule(); return; }
  const summary = { imported: 0, noRecipe: 0, skipped: 0, found: 0 };
  try {
    const data = readTab_("Data", DATA_HEADERS.length).rows;
    const known = new Set();
    try { JSON.parse(get_(SITE_ + "known_urls.json?t=" + Date.now()).text).forEach((k) => known.add(k)); } catch (e) {}
    if (!known.size) throw new Error("couldn't load known_urls.json from the site — skipped this run so nothing gets imported twice");
    data.forEach((r) => {
      if (r[0] === "custom") { try { const k = key_(JSON.parse(r[2]).url); if (k) known.add(k); } catch (e) {} }
      if (r[0] === "imports") { try { known.add(key_(JSON.parse(r[2]).url)); } catch (e) {} }
    });
    const Q = readTab_("Queue", QUEUE_HEADERS_.length);
    Q.rows.forEach((r) => known.add(key_(r[0])));
    const C = readTab_("Channels", CHANNEL_HEADERS_.length);
    const state = {};
    C.rows.forEach((r, i) => { state[r[0]] = { row: i + 2, vals: r }; });

    const channels = channelList_(data);
    const newRows = [];   // Data rows to append
    const queueAdd = [];
    const tally = {};     // channel -> {found, imported, skipped}
    const t = (n) => (tally[n] = tally[n] || { found: 0, imported: 0, skipped: 0, note: null, uploads: null, checked: false });

    // 1) Discover new posts on channels not checked in the last 20 hours
    for (const ch of channels) {
      if (timeLeft() < 90 * 1000) break;
      const st = state[ch.name];
      if (st && String(st.vals[4]).toLowerCase() === "paused") continue;
      const last = st && st.vals[5] ? new Date(st.vals[5]).getTime() : 0;
      if (Date.now() - last < 20 * 3600 * 1000) continue;
      const tl = t(ch.name);
      tl.checked = true;
      const creator = ch.creator || ch.name;
      const firstTime = !st || !Number(st.vals[6]);
      try {
        if (ch.kind === "manual") { tl.note = ch.note; continue; }
        if (ch.kind === "youtube") {
          if (typeof YouTube === "undefined") { tl.note = "Turn on Services > YouTube Data API v3 in the script editor"; continue; }
          let uploads = st && st.vals[11] ? String(st.vals[11]) : "";
          if (!uploads) uploads = uploadsPlaylist_(ch.where);
          tl.uploads = uploads;
          const items = YouTube.PlaylistItems.list("snippet", { playlistId: uploads, maxResults: 50 }).items || [];
          const lookback = firstTime ? (ch.backlog || 0) : 0;
          let older = 0;
          for (const it of items) {      // newest first
            const sn = it.snippet || {};
            const vid = sn.resourceId && sn.resourceId.videoId;
            if (!vid || /^(Private|Deleted) video$/.test(sn.title || "")) continue;
            const url = "https://www.youtube.com/watch?v=" + vid, k = key_(url);
            if (known.has(k)) { older++; if (older > lookback) break; else continue; }   // reached what we already have
            if (older > 0 && older > lookback) break;
            known.add(k);
            tl.found++;
            newRows.push(["imports", importId_(k), JSON.stringify({ title: sn.title || "", creator: creator, url: url, platform: "YouTube", text: String(sn.description || "").slice(0, 5000), published: sn.publishedAt || "", ts: Date.now() }), new Date(), "auto refresh", false]);
            tl.imported++;
          }
        } else {
          const posts = sitemapPosts_(ch.where, timeLeft);
          const fresh = posts.filter((p) => !known.has(key_(p.url)));
          const cap = firstTime ? (ch.backlog || 0) : 0;
          // first time: take the newest `cap`; afterwards only posts that are new since the last check
          const take = firstTime ? fresh.slice(0, cap) : fresh;
          take.forEach((p) => { known.add(key_(p.url)); queueAdd.push([p.url, ch.name, new Date(), "waiting", ""]); });
          // older posts past the first-run cutoff are logged as seen so they're never queued later
          if (firstTime) fresh.slice(cap).forEach((p) => { known.add(key_(p.url)); queueAdd.push([p.url, ch.name, new Date(), "older", "before the first-run cutoff"]); });
          tl.found += take.length;
          if (!posts.length) tl.note = "Couldn't find a sitemap for this site";
        }
      } catch (e) { tl.note = "Error: " + String(e).slice(0, 150); }
    }
    if (queueAdd.length) Q.sh.getRange(Q.sh.getLastRow() + 1, 1, queueAdd.length, QUEUE_HEADERS_.length).setValues(queueAdd);

    // 2) Read waiting website posts until time runs out
    const queue = readTab_("Queue", QUEUE_HEADERS_.length);
    const creatorOf = {};
    channels.forEach((c) => { creatorOf[c.name] = c.creator || c.name; });
    for (let i = 0; i < queue.rows.length && timeLeft() > 20 * 1000; i++) {
      const r = queue.rows[i];
      if (r[3] !== "waiting") continue;
      const tl = t(r[1]);
      let status = "skipped", detail = "";
      try {
        const res = fetchLink_(String(r[0]));
        if (res.ingredients && res.ingredients.length && looksLikeDrink_(res)) {
          const k = key_(r[0]);
          newRows.push(["imports", importId_(k), JSON.stringify({ title: res.title || "", creator: creatorOf[r[1]] || r[1], url: String(r[0]), platform: res.platform || "", text: String(res.text || "").slice(0, 3000), ingredients: res.ingredients.slice(0, 40), instructions: (res.instructions || []).slice(0, 15), category: res.category || "", ts: Date.now() }), new Date(), "auto refresh", false]);
          status = "imported"; tl.imported++;
        } else { detail = res.ingredients && res.ingredients.length ? "recipe, but not a drink" : "no recipe card on the page"; tl.skipped++; }
      } catch (e) { status = "error"; detail = String(e).slice(0, 120); tl.skipped++; }
      queue.sh.getRange(i + 2, 4, 1, 2).setValues([[status, detail]]);
    }

    // 3) Save new drinks to Data (the site reads them on next load)
    if (newRows.length) {
      const l = LockService.getScriptLock(); l.waitLock(20000);
      try { const sh = ss.getSheetByName("Data"); sh.getRange(sh.getLastRow() + 1, 1, newRows.length, DATA_HEADERS.length).setValues(newRows); }
      finally { l.releaseLock(); }
    }

    // 4) Update the Channels tab
    const waiting = {};
    readTab_("Queue", QUEUE_HEADERS_.length).rows.forEach((r) => { if (r[3] === "waiting") waiting[r[1]] = (waiting[r[1]] || 0) + 1; });
    const chRows = readTab_("Channels", CHANNEL_HEADERS_.length);
    const now = new Date();
    for (const ch of channels) {
      const tl = tally[ch.name], st = state[ch.name];
      const prev = st ? st.vals : [ch.name, ch.kind, ch.where, ch.creator || ch.name, "on", "", 0, 0, 0, 0, "", ""];
      if (!tl && st) { st.vals[9] = waiting[ch.name] || 0; chRows.sh.getRange(st.row, 10).setValue(st.vals[9]); continue; }
      if (!tl) continue;
      const vals = [ch.name, ch.kind, ch.where, ch.creator || ch.name, prev[4] || "on", tl.checked ? now : prev[5],
        Number(prev[6] || 0) + tl.found, Number(prev[7] || 0) + tl.imported, Number(prev[8] || 0) + tl.skipped, waiting[ch.name] || 0,
        tl.note != null ? tl.note : (tl.checked ? "" : prev[10]), tl.uploads || prev[11] || ""];
      if (st) chRows.sh.getRange(st.row, 1, 1, CHANNEL_HEADERS_.length).setValues([vals]);
      else chRows.sh.appendRow(vals);
      summary.found += tl.found; summary.imported += tl.imported; summary.skipped += tl.skipped;
    }
    // channel status for the site's Sources tab
    const status = {};
    readTab_("Channels", CHANNEL_HEADERS_.length).rows.forEach((r) => { status[r[0]] = { kind: r[1], creator: r[3], checked: r[5] ? new Date(r[5]).getTime() : 0, imported: Number(r[7] || 0), skipped: Number(r[8] || 0), waiting: Number(r[9] || 0), note: String(r[10] || "") }; });
    writeData_("meta", "channels", Object.assign({ ts: Date.now() }, { list: status }));
    if (summary.imported || summary.found) ss.getSheetByName("Log").appendRow([now, "auto refresh", "refresh", `found ${summary.found}, imported ${summary.imported}, skipped ${summary.skipped}`]);
  } catch (e) {
    ss.getSheetByName("Log").appendRow([new Date(), "auto refresh", "error", String(e).slice(0, 300)]);
  } finally {
    props.deleteProperty("refreshRunning");
  }
}

function writeData_(c, id, obj) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName("Data");
    const n = sh.getLastRow() - 1;
    const keys = n > 0 ? sh.getRange(2, 1, n, 2).getValues() : [];
    let row = -1;
    for (let i = 0; i < keys.length; i++) if (keys[i][0] === c && String(keys[i][1]) === id) { row = i + 2; break; }
    const values = [[c, id, JSON.stringify(obj), new Date(), "auto refresh", false]];
    if (row > 0) sh.getRange(row, 1, 1, DATA_HEADERS.length).setValues(values); else sh.appendRow(values[0]);
  } finally { lock.releaseLock(); }
}

function uploadsPlaylist_(where) {
  let channelId = "";
  const w = String(where || "");
  const vid = (w.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/) || [])[1];
  if (/\/channel\/(UC[\w-]{22})/.test(w)) channelId = w.match(/\/channel\/(UC[\w-]{22})/)[1];
  else if (vid) { const v = YouTube.Videos.list("snippet", { id: vid }).items || []; if (v.length) channelId = v[0].snippet.channelId; }
  else { const h = (w.match(/@([\w.-]+)/) || [])[1]; if (h) { const c = YouTube.Channels.list("id", { forHandle: "@" + h }).items || []; if (c.length) channelId = c[0].id; } }
  if (!channelId) throw new Error("couldn't find the YouTube channel");
  const c = YouTube.Channels.list("contentDetails", { id: channelId }).items || [];
  if (!c.length) throw new Error("channel not found");
  return c[0].contentDetails.relatedPlaylists.uploads;
}

// All post URLs on a site, newest first (by sitemap lastmod when present).
function sitemapPosts_(where, timeLeft) {
  const origin = (String(where).match(/^https?:\/\/[^/]+/i) || [""])[0];
  if (!origin) return [];
  const locs = (xml) => { const out = []; const re = /<(?:url|sitemap)>([\s\S]*?)<\/(?:url|sitemap)>/gi; let m; while ((m = re.exec(xml))) { const loc = (m[1].match(/<loc>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/loc>/i) || [])[1]; const lm = (m[1].match(/<lastmod>([^<]+)<\/lastmod>/i) || [])[1]; if (loc) out.push({ url: decodeEntities_(loc.trim()), lastmod: lm || "" }); } return out; };
  let root = null;
  for (const p of ["/sitemap_index.xml", "/wp-sitemap.xml", "/sitemap.xml"]) {
    const r = get_(origin + p);
    if (r.code === 200 && /<loc>/i.test(r.text)) { root = r.text; break; }
  }
  if (!root) return [];
  let posts = [];
  if (/<sitemapindex/i.test(root)) {
    const kids = locs(root).map((x) => x.url).filter((u) => { const f = u.split("/").pop().toLowerCase(); return /post|recipe|blog|cocktail|drink/.test(f) || !/page|categor|tag|author|attachment|taxonom|user|product|stor|video|image|media/.test(f); });
    for (const k of kids.slice(0, 12)) {
      if (timeLeft && timeLeft() < 60 * 1000) break;
      const r = get_(k);
      if (r.code === 200) posts = posts.concat(locs(r.text));
    }
  } else posts = locs(root);
  const skip = /\/(category|tag|author|page|about|contact|shop|privacy|terms|cart|account|search)(\/|$)|\.(xml|jpg|png|pdf)$/i;
  posts = posts.filter((p) => !skip.test(p.url) && p.url.replace(/\/+$/, "") !== origin);
  posts.sort((a, b) => (b.lastmod || "").localeCompare(a.lastmod || ""));
  return posts;
}

function looksLikeDrink_(r) {
  const meta = [r.title, r.category].join(" ").toLowerCase();
  if (/cocktail|mocktail|drink|beverage|spritz|margarita|martini|negroni|punch|sour|highball|old fashioned|mule|daiquiri|sangria|toddy|julep|smash|fizz|collins|shot|shooter|liqueur|syrup|bitters|eggnog|nog\b/.test(meta)) return true;
  const ing = (r.ingredients || []).join(" | ").toLowerCase();
  const pours = (ing.match(/\b\d*\s*(\d\/\d|½|¼|¾)?\s*(oz|ounces?|ml|dash(es)?|barspoon)\b/g) || []).length;
  return pours >= 2 && /gin\b|vodka|rum\b|tequila|mezcal|whisk|bourbon|\brye\b|brandy|cognac|liqueur|vermouth|amaro|aperol|campari|bitters|tonic|soda water|club soda|ginger beer|prosecco|champagne/.test(ing);
}

// Run by hand to see what the refresh would find for one site, without saving anything.
function testSite() {
  const url = "https://emilylaurae.com";
  const posts = sitemapPosts_(url);
  Logger.log(posts.length + " posts. Newest: " + posts.slice(0, 5).map((p) => p.url).join("  "));
  if (posts.length) { const r = fetchLink_(posts[0].url); Logger.log(JSON.stringify({ title: r.title, ingredients: r.ingredients, drink: r.ingredients ? looksLikeDrink_(r) : false }).slice(0, 1500)); }
}
