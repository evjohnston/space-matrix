/* In-site editing. Editors sign in with GitHub; saving commits the item file
 * straight to the repo (so it is live on the next deploy, and every edit is in
 * git history). Only repo collaborators with write access can save — GitHub
 * enforces that, which is what makes this invite-only. */
(function () {
  "use strict";
  var SM = window.SM, esc = SM.esc, ic = SM.ic;
  var $ = function (id) { return document.getElementById(id); };
  var CFG = {}, TOKEN = null, USER = null, CAN = false;
  var API = "https://api.github.com";
  var ITEM_DIR = "data/items/";

  // ------------------------------------------------------------------ storage (per-tab session)
  function store(k, v) { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  function load(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }

  // ------------------------------------------------------------------ GitHub API
  function gh(path, opts) {
    opts = opts || {};
    return fetch(API + path, {
      method: opts.method || "GET",
      headers: { Authorization: "Bearer " + TOKEN, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
                 "Content-Type": "application/json" },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = t ? JSON.parse(t) : {};
        if (!r.ok) { var err = new Error(j.message || ("HTTP " + r.status)); err.status = r.status; throw err; }
        return j;
      });
    });
  }
  function b64decode(s) { var bin = atob(s.replace(/\n/g, "")); var bytes = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); }
  function b64encode(str) { var bytes = new TextEncoder().encode(str), bin = ""; for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]); return btoa(bin); }
  // Same layout as scripts/common.py write_json (indent=2, UTF-8, trailing newline) so diffs stay minimal.
  function serialize(obj) { return JSON.stringify(obj, null, 2) + "\n"; }

  function getFile(path) {
    return gh("/repos/" + CFG.repo + "/contents/" + path + "?ref=" + encodeURIComponent(CFG.branch)).then(function (f) {
      return { sha: f.sha, json: JSON.parse(b64decode(f.content)) };
    });
  }
  function putFile(path, json, sha, message) {
    var body = { message: message, content: b64encode(serialize(json)), branch: CFG.branch };
    if (sha) body.sha = sha;
    return gh("/repos/" + CFG.repo + "/contents/" + path, { method: "PUT", body: body });
  }

  // ------------------------------------------------------------------ auth
  function signIn() {
    if (CFG.oauth_proxy) {
      location.href = CFG.oauth_proxy.replace(/\/$/, "") + "/login?return=" + encodeURIComponent(location.href.split("#")[0]);
      return;
    }
    modal('<h2 class="dr-title">Sign in to edit</h2>' +
      '<p class="hint">Editing is open to collaborators on <b>' + esc(CFG.repo) + '</b>. Paste a GitHub token with access to this repository ' +
      '(a fine-grained token with <b>Contents: Read and write</b>, or a classic token with <code>public_repo</code>). ' +
      'It is kept only in this browser tab and sent only to api.github.com.</p>' +
      '<p><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Create a fine-grained token</a></p>' +
      '<label class="field"><span>GitHub token</span><input id="ed-token" type="password" autocomplete="off" spellcheck="false"></label>' +
      '<div class="ed-actions"><button class="btn primary" id="ed-token-go">Sign in</button><button class="btn" data-ed-close>Cancel</button></div><p class="ed-msg" id="ed-msg"></p>');
    $("ed-token").focus();
    $("ed-token-go").addEventListener("click", function () {
      var t = $("ed-token").value.trim(); if (!t) return;
      $("ed-msg").textContent = "Checking…";
      useToken(t).then(function () { closeModal(); }).catch(function (e) { $("ed-msg").textContent = e.message; });
    });
  }
  function useToken(t) {
    TOKEN = t;
    return gh("/user").then(function (u) {
      USER = u;
      return gh("/repos/" + CFG.repo).then(function (r) {
        CAN = !!(r.permissions && (r.permissions.push || r.permissions.admin || r.permissions.maintain));
        store("gh_token", t);
        renderAccount();
        if (!CAN) toast("Signed in as @" + u.login + ", but you don't have write access to " + CFG.repo + ". Ask the owner to add you as a collaborator.", true);
        else toast("Signed in as @" + u.login + ". Edit buttons are now on every item.");
        refreshDrawer();
      });
    }).catch(function (e) {
      TOKEN = null; USER = null; CAN = false; store("gh_token", null); renderAccount();
      throw new Error(e.status === 401 ? "That token was rejected by GitHub." : "Sign-in failed: " + e.message);
    });
  }
  function signOut() { TOKEN = null; USER = null; CAN = false; store("gh_token", null); renderAccount(); refreshDrawer(); toast("Signed out."); }

  function renderAccount() {
    var el = $("account"); if (!el) return;
    if (!CFG.repo) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = USER
      ? '<img src="' + esc(USER.avatar_url) + '&s=48" alt=""><span>@' + esc(USER.login) + (CAN ? "" : " (view only)") + '</span><button class="link" id="ed-out">Sign out</button>'
      : '<button class="btn small" id="ed-in">Sign in to edit</button>';
  }

  // ------------------------------------------------------------------ modal + toast
  function modal(html) {
    var m = $("ed-modal");
    m.querySelector(".ed-box").innerHTML = html;
    m.hidden = false;
    m._prev = document.activeElement;
  }
  var back = null;  // what Cancel returns to
  function panel(title, html, ret) {
    back = ret;
    SM.showDrawer('<div class="dr-top"><h2 class="dr-title" id="dr-title">' + esc(title) + '</h2><button class="close" data-ed-close aria-label="Cancel">' + ic("x") + "</button></div>" + html);
    var f = document.querySelector("#drawer-body input, #drawer-body textarea"); if (f) f.focus();
  }
  function closePanel() { var r = back; back = null; if (r) r(); }
  function closeModal() { var m = $("ed-modal"); m.hidden = true; if (m._prev && m._prev.focus) m._prev.focus(); }
  function toast(msg, warn) {
    var t = $("ed-toast"); t.textContent = msg; t.className = "toast" + (warn ? " warn" : ""); t.hidden = false;
    clearTimeout(t._h); t._h = setTimeout(function () { t.hidden = true; }, warn ? 9000 : 5000);
  }

  // ------------------------------------------------------------------ edit an item's analysis
  var ALIGNS = [["Yes", "Aligns"], ["No", "Doesn’t align"], ["N/A", "N/A"], ["Unassessed", "Unassessed"]];
  function field(id, label, value, opts) {
    opts = opts || {};
    var input = opts.select
      ? '<select id="' + id + '">' + opts.select.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === value ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>"
      : opts.area
        ? '<textarea id="' + id + '" rows="' + (opts.rows || 5) + '">' + esc(value || "") + "</textarea>"
        : '<input id="' + id + '" type="' + (opts.type || "text") + '" value="' + esc(value || "") + '">';
    return '<label class="field"><span>' + label + (opts.hint ? ' <em>' + opts.hint + "</em>" : "") + "</span>" + input + "</label>";
  }
  function editItem(id) {
    var it = SM.getItem(id); if (!it) return;
    panel("Edit analysis", '<p class="hint">' + esc(it.name) + "</p>" +
      '<div class="ed-grid">' +
      field("f-status", "Status", it.status, { hint: "plain-language current status" }) +
      field("f-status_date", "Status as of", it.status_date, { type: "date" }) +
      field("f-aligns", "Aligns with recommendations?", it.aligns, { select: ALIGNS }) +
      field("f-issues", "Issues", it.issues.join("; "), { hint: "separate with ;" }) + "</div>" +
      field("f-effect", "Substantive effect", it.effect, { area: true, rows: 6 }) +
      field("f-alignment_notes", "How it does / doesn’t align", it.alignment_notes, { area: true }) +
      field("f-gridlock", "Sources of legislative gridlock", it.gridlock, { area: true, rows: 3 }) +
      field("f-sponsors", "Sponsors / points of contact", it.sponsors, { area: true, rows: 2 }) +
      field("f-note", "Note for the change history", "", { hint: "optional, goes in the commit message" }) +
      '<div class="ed-actions"><button class="btn primary" id="ed-save">Save &amp; publish</button><button class="btn" data-ed-close>Cancel</button></div>' +
      '<p class="ed-msg" id="ed-msg">Saving commits to <b>' + esc(CFG.repo) + "</b> as @" + esc(USER.login) + ". The public site updates in about a minute.</p>",
      function () { SM.openItem(it.id); });
    $("ed-save").addEventListener("click", function () { save(it, this); });
  }
  function save(it, btn) {
    var v = function (k) { return $("f-" + k).value; };
    var fields = {
      status: v("status").trim(), status_date: v("status_date"), aligns: v("aligns"),
      issues: v("issues").split(";").map(function (s) { return s.trim(); }).filter(Boolean),
      effect: v("effect").trim(), alignment_notes: v("alignment_notes").trim(), gridlock: v("gridlock").trim(), sponsors: v("sponsors").trim()
    };
    var note = v("note").trim();
    btn.disabled = true; $("ed-msg").textContent = "Saving…";
    var path = ITEM_DIR + it.id + ".json";
    var attempt = function (n) {
      return getFile(path).then(function (f) {
        var j = f.json;
        Object.keys(fields).forEach(function (k) { j[k] = fields[k]; });
        j.review = j.review || {};
        j.review.last_reviewed = new Date().toISOString().slice(0, 10);
        j.review.last_editor = USER.login;
        return putFile(path, j, f.sha, "Analysis: " + it.name + (note ? " — " + note : "") + "\n\nEdited on the site by @" + USER.login + ".");
      }).catch(function (e) {
        if (e.status === 409 && n < 2) return attempt(n + 1); // file changed underneath us: refetch and reapply
        throw e;
      });
    };
    attempt(0).then(function (res) {
      back = null;
      SM.updateItem(it.id, fields, { last_reviewed: new Date().toISOString().slice(0, 10) });
      toast("Saved. Live for everyone in about a minute (commit " + res.commit.sha.slice(0, 7) + ").");
    }).catch(function (e) {
      btn.disabled = false;
      $("ed-msg").textContent = e.status === 403 || e.status === 404 ? "GitHub refused the save — your account needs write access to " + CFG.repo + "." : "Save failed: " + e.message;
    });
  }

  // ------------------------------------------------------------------ promote a watchlist entry
  function slugify(t) { var s = t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); if (s.length > 60) s = s.slice(0, 61).replace(/-[^-]*$/, ""); return s || "item"; }
  function promote(e) {
    panel("Add to the matrix", '<p class="hint">' + esc(e.title) + "</p>" +
      field("p-name", "Name", e.title) + field("p-issues", "Issues", "", { hint: "separate with ;" }) +
      field("p-aligns", "Aligns with recommendations?", "Unassessed", { select: ALIGNS }) +
      field("p-effect", "Substantive effect", e.summary || "", { area: true, rows: 6, hint: "pre-filled from the official summary — edit freely" }) +
      field("p-alignment_notes", "How it does / doesn’t align", "", { area: true }) +
      '<div class="ed-actions"><button class="btn primary" id="p-save">Add &amp; publish</button><button class="btn" data-ed-close>Cancel</button></div><p class="ed-msg" id="ed-msg"></p>',
      function () { window.Watch.open(e.key); });
    $("p-save").addEventListener("click", function () {
      var btn = this; btn.disabled = true; $("ed-msg").textContent = "Saving…";
      var name = $("p-name").value.trim() || e.title, id = slugify(name), today = new Date().toISOString().slice(0, 10);
      var bill = e.source === "congress";
      var m = e.key.match(/^(\d+)-([a-z]+)-(\d+)$/);
      var item = {
        id: id, name: name, number: bill ? e.label : (e.dockets || []).join("; "),
        kind: bill ? "legislation" : "regulatory", entity: bill ? "Congress" : (e.agencies || []).slice(0, 2).join(", "),
        issues: $("p-issues").value.split(";").map(function (s) { return s.trim(); }).filter(Boolean),
        status: e.latest_text || "", status_date: e.latest_date || "", aligns: $("p-aligns").value,
        effect: $("p-effect").value.trim(), alignment_notes: $("p-alignment_notes").value.trim(), gridlock: "", sponsors: e.sponsor || "",
        links: [e.url],
        tracking: bill && m ? [{ type: "congress", congress: +m[1], bill_type: m[2], number: m[3] }] : [{ type: "fr_document", document: e.key.replace(/^fr-/, "") }],
        auto: {}, review: { last_reviewed: today, notes: "Added from the watchlist on the site (score " + e.score + ").", last_editor: USER.login }
      };
      var path = ITEM_DIR + id + ".json";
      gh("/repos/" + CFG.repo + "/contents/" + path + "?ref=" + encodeURIComponent(CFG.branch)).then(function () {
        throw new Error("An item called “" + id + "” already exists. Change the name.");
      }, function (err) {
        if (err.status !== 404) throw err;
        return putFile(path, item, null, "Add to matrix: " + name + "\n\nPromoted from the watchlist (" + e.key + ", score " + e.score + ") by @" + USER.login + ".");
      }).then(function () {
        back = null; window.Watch.open(e.key);
        toast("Added. It appears in the matrix with official tracking after the next deploy (about a minute).");
      }).catch(function (err) { btn.disabled = false; $("ed-msg").textContent = err.message; });
    });
  }

  // ------------------------------------------------------------------ drawer hooks
  var current = null;
  function refreshDrawer() { if (current) inject(current); }
  function inject(ctx) {
    current = ctx;
    var slot = document.getElementById("ed-slot"); if (!slot) return;
    if (!CFG.repo) { slot.innerHTML = ""; return; }
    if (!USER) { slot.innerHTML = '<button class="btn small ghosty" data-ed-signin>Sign in to edit</button>'; return; }
    if (!CAN) { slot.innerHTML = '<span class="hint">View only: you need write access to ' + esc(CFG.repo) + " to edit.</span>"; return; }
    if (ctx.type === "item") {
      var it = SM.getItem(ctx.id);
      slot.innerHTML = '<button class="btn small primary" data-ed-edit="' + esc(ctx.id) + '">' + ic("pencil") + "Edit analysis</button>" +
        (it && it.last_editor ? '<span class="hint">Last edited by @' + esc(it.last_editor) + "</span>" : "");
    } else if (ctx.type === "watch" && !ctx.entry.in_matrix) {
      slot.innerHTML = '<button class="btn small primary" data-ed-promote>' + ic("plus") + "Add to matrix</button>";
    } else slot.innerHTML = "";
  }
  document.addEventListener("drawer:open", function (e) { inject(e.detail); });
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t.closest("[data-ed-close]")) { if (back) closePanel(); else closeModal(); return; }
    if (t.id === "ed-modal") { closeModal(); return; }
    if (t.closest("#ed-in") || t.closest("[data-ed-signin]")) { signIn(); return; }
    if (t.closest("#ed-out")) { signOut(); return; }
    var ed = t.closest("[data-ed-edit]"); if (ed) { editItem(ed.dataset.edEdit); return; }
    if (t.closest("[data-ed-promote]") && current && current.type === "watch") promote(current.entry);
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("ed-modal").hidden) { e.stopImmediatePropagation(); closeModal(); } }, true);

  // ------------------------------------------------------------------ init
  window.Edit = {
    init: function (cfg) {
      CFG = cfg || {};
      if (!CFG.repo) return;
      CFG.branch = CFG.branch || "main";
      // OAuth proxy hands the token back in the URL fragment: #gh_token=…
      var m = location.hash.match(/gh_token=([^&]+)/);
      if (m) { history.replaceState(null, "", location.pathname + location.search); store("gh_token", decodeURIComponent(m[1])); }
      var t = load("gh_token");
      renderAccount();
      if (t) useToken(t).catch(function () {});
    }
  };
})();
