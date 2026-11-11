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
