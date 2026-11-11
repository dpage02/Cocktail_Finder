/**
 * The Cocktail Finder: crew sheet backend.
 * Paste this whole file into Extensions > Apps Script in the crew Google Sheet.
 * Then run setup() once, and Deploy > New deployment > Web app
 *   (Execute as: Me, Who has access: Anyone). See SETUP.md.
 *
 * Tabs it uses:
 *   Settings     B1 = crew passcode (change it any time; everyone signs in again)
 *   Data         one row per saved item (the site reads this). Don't rearrange columns.
 *   Added drinks a readable copy of drinks the crew added
 *   Log          every change: when, who, what
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
        return { title: x.name || "", author: author ? (author.name || String(author)) : "", ingredients: [].concat(x.recipeIngredient || []).map(stripHtml_), instructions: steps, text: stripHtml_(x.description || "") };
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
