// ---- GitHub Pages bridge: replaces Claude's database with the crew Google Sheet ----
// SHEET_URL is the Apps Script web-app URL (see SETUP.md). Empty = read-only (seed data only).
const SHEET_URL = "__SHEET_URL__";
(function () {
  const CACHE = "cf_cache_v1";
  let STORE = null, loading = null;
  const get = (k) => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  const put = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} };
  const who = () => get("cf_who");
  const pass = () => get("cf_pass");

  function toast(msg) {
    let t = document.getElementById("cf-toast");
    if (!t) {
      t = document.createElement("div"); t.id = "cf-toast";
      t.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#2b1d14;color:#fff;padding:10px 16px;border-radius:8px;font:14px/1.4 Inter,system-ui,sans-serif;z-index:9999;max-width:90vw;box-shadow:0 4px 16px rgba(0,0,0,.25)";
      document.body.appendChild(t);
    }
    t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, 4500);
  }

  async function call(body) {
    const r = await fetch(SHEET_URL, { method: "POST", body: JSON.stringify(body) }); // text/plain: no preflight
    const j = await r.json();
    if (!j.ok) { const e = new Error(j.error || "failed"); e.code = j.error; throw e; }
    return j;
  }

  async function load() {
    if (STORE) return STORE;
    if (loading) return loading;
    loading = (async () => {
      let seed = {};
      try { seed = await (await fetch("./seed.json", { cache: "no-cache" })).json(); } catch (e) {}
      let cached = {};
      try { cached = JSON.parse(get(CACHE) || "{}"); } catch (e) {}
      STORE = JSON.parse(JSON.stringify(seed));
      const merge = (rows) => rows.forEach((r) => {
        STORE[r.c] = STORE[r.c] || {};
        if (r.deleted) delete STORE[r.c][r.id]; else STORE[r.c][r.id] = r.data;
      });
      if (SHEET_URL && !SHEET_URL.startsWith("__")) {
        try {
          const j = await (await fetch(SHEET_URL + "?action=all", { cache: "no-cache" })).json();
          merge(j.rows || []); put(CACHE, JSON.stringify(j.rows || []));
        } catch (e) {
          if (Array.isArray(cached)) merge(cached);
          toast("Showing the last saved copy: couldn't reach the crew sheet.");
        }
      }
      return STORE;
    })();
    return loading;
  }

  // ---- passcode + name ----
  function ask() {
    return new Promise((resolve) => {
      const o = document.createElement("div");
      o.style.cssText = "position:fixed;inset:0;background:rgba(20,14,10,.55);display:flex;align-items:center;justify-content:center;z-index:10000;padding:16px";
      o.innerHTML = `<form style="background:var(--bg,#fbf8f3);color:var(--text,#2b1d14);border-radius:12px;padding:22px;max-width:360px;width:100%;font:15px/1.45 Inter,system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.3)">
        <div style="font-weight:700;font-size:18px;margin-bottom:4px">Crew sign-in</div>
        <div style="font-size:13px;opacity:.75;margin-bottom:14px">Design mode and saving are for the crew. Your device will remember you.</div>
        <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px" for="cf-pass">Crew passcode</label>
        <input id="cf-pass" type="password" autocomplete="current-password" required style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccc;border-radius:6px;font-size:16px;margin-bottom:12px">
        <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px" for="cf-who">Your name</label>
        <input id="cf-who" type="text" autocomplete="name" required placeholder="e.g. Meg" value="${(who() || "").replace(/"/g, "&quot;")}" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccc;border-radius:6px;font-size:16px">
        <div id="cf-err" style="color:#b3261e;font-size:13px;min-height:18px;margin:8px 0 4px"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" id="cf-cancel" style="padding:10px 14px;border:1px solid #ccc;background:transparent;border-radius:6px;font-size:15px;min-height:44px">Cancel</button>
          <button type="submit" style="padding:10px 16px;border:0;background:#8a2432;color:#fff;border-radius:6px;font-size:15px;font-weight:600;min-height:44px">Sign in</button>
        </div></form>`;
      document.body.appendChild(o);
      const f = o.querySelector("form"), err = o.querySelector("#cf-err");
      o.querySelector("#cf-pass").focus();
      o.querySelector("#cf-cancel").onclick = () => { o.remove(); resolve(false); };
      f.onsubmit = async (e) => {
        e.preventDefault();
        const p = o.querySelector("#cf-pass").value.trim(), n = o.querySelector("#cf-who").value.trim();
        if (!SHEET_URL || SHEET_URL.startsWith("__")) { err.textContent = "The crew sheet isn't connected yet."; return; }
        err.textContent = "Checking…";
        try { await call({ action: "check", passcode: p }); put("cf_pass", p); put("cf_who", n); o.remove(); toast("Signed in as " + n); resolve(true); }
        catch (x) { err.textContent = x.code === "bad_passcode" ? "That passcode didn't work." : "Couldn't reach the crew sheet. Check your connection."; }
      };
    });
  }

  async function write(op, path, data) {
    if (!pass()) { const ok = await ask(); if (!ok) throw new Error("not signed in"); }
    try { await call({ action: op, path, data, passcode: pass(), who: who() }); }
    catch (e) {
      if (e.code === "bad_passcode") { put("cf_pass", ""); toast("The crew passcode changed. Sign in again to save."); }
      else toast("Couldn't save to the crew sheet. Check your connection.");
      throw e;
    }
  }

  const API = {
    collection(name) {
      return {
        async get() {
          const s = await load(); const c = s[name] || {};
          return { docs: Object.keys(c).map((id) => ({ id, data: () => c[id] })) };
        },
      };
    },
    doc(path) {
      const [c, id] = path.split("/");
      return {
        async set(data) { const s = await load(); (s[c] = s[c] || {})[id] = data; await write("set", path, data); },
        async delete() { const s = await load(); if (s[c]) delete s[c][id]; await write("delete", path); },
      };
    },
  };

  async function fetchLink(url) {
    if (!pass()) { const ok = await ask(); if (!ok) throw new Error("not signed in"); }
    try { return await call({ action: "fetch", url, passcode: pass() }); }
    catch (e) { if (e.code === "bad_passcode") { put("cf_pass", ""); toast("The crew passcode changed. Sign in again."); } throw e; }
  }
  window.CF = { unlocked: () => !!pass(), unlock: ask, who, fetchLink, signOut: () => { put("cf_pass", ""); } };
  window.claude = {
    use: async (cap) => {
      if (cap === "db") { await load(); return API; }
      const e = new Error("not available on this site"); e.code = "not_granted"; throw e;
    },
  };
})();
