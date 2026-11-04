(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var SM = window.SM;
  var esc = SM.esc, fmt = SM.fmt, rel = SM.rel, days = SM.days, ic = SM.ic;
  var W = { q: "", src: "", tier: "relevant", sort: "score", band: -1, signal: "", noMatrix: false, limit: 100 };
  var E = [], BYK = {}, loaded = null, bound = false, BASE = "";  // BASE = date of the initial backfill
  function isNew(e) { return e.first_seen > BASE && days(e.first_seen) <= 7; }
  var TIERS = ["High", "Medium", "Low", "Likely noise"];
  var TIER_CLASS = { High: "tier-High", Medium: "tier-Medium", Low: "tier-Low", "Likely noise": "tier-noise" };
  var FLOORS = { High: 70, Medium: 45, Low: 25, "Likely noise": 0 };

  function tierOf(score) { return score >= 70 ? "High" : score >= 45 ? "Medium" : score >= 25 ? "Low" : "Likely noise"; }
  // Collapse each reason into a reusable "signal" name for counting/filtering.
  function signal(r) {
    var t = r[1];
    if (/^Title mentions/.test(t)) return "Title: clear space term";
    if (/^Title says/.test(t)) return "Title: “space” (ambiguous)";
    if (/non-space context/.test(t)) return "Title: non-space context";
    if (/^Official subject/.test(t)) return "Official space subject";
    if (/^Related subject/.test(t)) return "Related subject";
    if (/^Referred to/.test(t)) return t.replace("Referred to ", "Committee: ").replace(/ (Subcommittee|Committee)$/, "");
    if (/^Summary repeatedly/.test(t)) return "Summary: many space mentions";
    if (/^Summary mentions/.test(t)) return "Summary: some space mentions";
    if (/^Summary uses/.test(t)) return "Summary: non-space sense";
    if (/confirmed/.test(t)) return "“Space” confirmed by context";
    if (/^Sustainability/.test(t)) return "Sustainability / safety terms";
    if (/^Policy area/.test(t)) return t;
    if (/^Issuing agency/.test(t)) return "Space-focused agency";
    if (/^Binding rulemaking/.test(t)) return "Binding rulemaking";
    return t;
  }

  function matches(e, except) {
    except = except || [];
    if (W.src && e.source !== W.src) return false;
    if (except.indexOf("tier") < 0) {
      if (W.tier === "relevant" && e.score < 25) return false;
      if (W.tier && W.tier !== "relevant" && e.tier !== W.tier) return false;
    }
    if (except.indexOf("band") < 0 && W.band >= 0 && Math.min(19, Math.floor(e.score / 5)) !== W.band) return false;
    if (except.indexOf("signal") < 0 && W.signal && !e._sigs[W.signal]) return false;
    if (W.noMatrix && e.in_matrix) return false;
    if (W.q) {
      var hay = e._hay || (e._hay = [e.title, e.label, e.key, e.sponsor, e.policy_area, (e.subjects || []).join(" "),
        (e.agencies || []).join(" "), (e.committees || []).join(" "), e.latest_text].join(" ").toLowerCase());
      if (!W.q.toLowerCase().split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; })) return false;
    }
    return true;
  }
  function filtered(except) { return E.filter(function (e) { return matches(e, except); }); }  // except: list of filter names to ignore

  // ------------------------------------------------------------ KPIs
  function renderKPIs() {
    var L = filtered(["tier"]), t = { High: 0, Medium: 0, Low: 0, "Likely noise": 0 }, fresh = 0;
    L.forEach(function (e) { t[e.tier]++; if (isNew(e)) fresh++; });
    var bills = L.filter(function (e) { return e.source === "congress"; }).length;
    var counts = { "": L.length, relevant: t.High + t.Medium + t.Low, High: t.High, Medium: t.Medium, Low: t.Low, "Likely noise": t["Likely noise"] };
    Array.prototype.forEach.call($("wtier").children, function (b) {
      var n = b.querySelector(".n") || b.appendChild(Object.assign(document.createElement("span"), { className: "n" }));
      n.textContent = counts[b.dataset.v];
    });
    $("wkpis").innerHTML = '<p class="wsum"><b>' + L.length.toLocaleString() + "</b> matches scanned · " + bills.toLocaleString() + " bills · " +
      (L.length - bills).toLocaleString() + " Federal Register documents · <b>" + (L.length ? Math.round(100 * t["Likely noise"] / L.length) : 0) +
      "%</b> likely noise" + (fresh ? " · " + fresh + " new this week" : "") + "</p>";
  }

  // ------------------------------------------------------------ histogram
  function renderHist() {
    var L = filtered(["band", "tier"]), bins = [];  // always show every tier, so the noise is visible
    for (var i = 0; i < 20; i++) bins.push({ i: i, n: 0, top: [] });
    L.forEach(function (e) { var b = bins[Math.min(19, Math.floor(e.score / 5))]; b.n++; if (b.top.length < 3) b.top.push(e.title); });
    $("whist-legend").innerHTML = TIERS.map(function (t) {
      return '<span><i class="' + TIER_CLASS[t] + '"></i>' + t + (t === "Likely noise" ? " (<25)" : " (" + FLOORS[t] + "+)") + "</span>";
    }).join("");
    var el = $("whist"), Wd = Math.max(280, el.clientWidth), H = Math.max(210, Math.min(320, el.clientHeight || 0));
    var ml = 34, mr = 4, mt = 18, mb = 26, pw = Wd - ml - mr, ph = H - mt - mb, band = pw / 20, bw = Math.max(4, band - 4);
    var peak = Math.max.apply(null, bins.map(function (b) { return b.n; })) || 1;
    var relPeak = Math.max.apply(null, bins.slice(5).map(function (b) { return b.n; })) || 1;
    var clip = peak > relPeak * 4;  // noise dwarfs the rest: cut its bars off and label them
    var top = clip ? relPeak * 2 : peak;
    var step = Math.max(1, SM.niceStep(top / 4)), nt = Math.ceil(top / step), max = nt * step;
    el.parentNode.querySelector(".hint").textContent = "Every match from the automated scan, in 5-point bands. Gray bars are probably noise" +
      (clip ? " and are cut off at the top, with their real counts labeled" : "") + ". Click a band to filter.";
    var y = function (v) { return mt + ph - (v / max) * ph; };
    var s = '<svg viewBox="0 0 ' + Wd + " " + H + '" height="' + H + '" style="position:absolute;inset:0" role="img" aria-label="Number of watchlist entries per 5-point relevance score band">';
    for (var g = 0; g <= nt; g++) {
      var gy = y(g * step);
      s += '<line class="' + (g ? "gridline" : "baseline") + '" x1="' + ml + '" x2="' + (Wd - mr) + '" y1="' + gy + '" y2="' + gy + '"/>' +
        '<text class="tick" x="' + (ml - 6) + '" y="' + (gy + 4) + '" text-anchor="end">' + g * step + "</text>";
    }
    [25, 45, 70].forEach(function (th) {
      var x = ml + (th / 5) * band;
      s += '<line x1="' + x + '" x2="' + x + '" y1="' + (mt - 10) + '" y2="' + (mt + ph) + '" style="stroke:var(--axis);stroke-width:1"/>' +
        '<text class="tick" x="' + (x + 4) + '" y="' + (mt - 2) + '">' + tierOf(th) + " " + th + "+</text>";
    });
    bins.forEach(function (b) {
      var x0 = ml + b.i * band, t = tierOf(b.i * 5), sel = W.band === b.i, dim = W.band >= 0 && !sel;
      s += '<g class="col' + (sel ? " sel" : "") + '" data-tip="' + b.i + '" data-band="' + b.i + '" tabindex="0" role="button" aria-label="Score ' +
        b.i * 5 + " to " + (b.i * 5 + 4) + ": " + b.n + ' entries"><rect class="hit" x="' + x0 + '" y="' + mt + '" width="' + band + '" height="' + ph + '" rx="4"/>';
      var v = Math.min(b.n, max), cut = b.n > max;
      if (b.n) s += '<path class="' + (dim ? "dim" : "") + '" style="fill:var(--' + TIER_CLASS[t] + ')" d="' + SM.topPath(x0 + 2, y(v), bw, Math.max(1, y(0) - y(v)), cut ? 0 : 4) + '"/>';
      if (cut) s += '<path d="M' + (x0 + 1) + "," + (y(v) + 9) + " l" + (bw / 2 + 1) + ",-5 l" + (bw / 2 + 1) + ',5" style="fill:none;stroke:var(--surface);stroke-width:3"/>' +
        '<text x="' + (x0 + 2 + bw / 2) + '" y="' + (y(v) + (bw < 22 && b.i % 2 ? 40 : 24)) + '" text-anchor="middle" style="font:700 ' + (bw < 22 ? 10 : 12) + 'px var(--c);fill:var(--ink)">' + b.n + "</text>";
      if (b.i % 2 === 0) s += '<text class="tick" x="' + x0 + '" y="' + (H - 8) + '" text-anchor="middle">' + b.i * 5 + "</text>";
      s += "</g>";
    });
    s += '<text class="tick" x="' + (ml + pw) + '" y="' + (H - 8) + '" text-anchor="end">100</text>';
    el.innerHTML = s + "</svg>";
    el._bins = bins;
  }
  function histTip(t) {
    var b = $("whist")._bins[+t.dataset.tip];
    return "<h4>Score " + b.i * 5 + "–" + (b.i === 19 ? 100 : b.i * 5 + 4) + '</h4><div class="tr"><span><i class="tdot ' + TIER_CLASS[tierOf(b.i * 5)] + '"></i>' +
      tierOf(b.i * 5) + "</span><b>" + b.n + " entr" + (b.n === 1 ? "y" : "ies") + "</b></div>" +
      (b.top.length ? '<div class="tnote">' + b.top.map(function (x) { return esc(x.length > 70 ? x.slice(0, 68) + "…" : x); }).join("<br>") + "</div>" : "") +
      '<div class="tnote">' + (W.band === b.i ? "Click to clear" : "Click to filter to this band") + "</div>";
  }

  // ------------------------------------------------------------ signals
  function renderSignals() {
    var L = filtered(["signal"]), c = {}, neg = {};
    L.forEach(function (e) { Object.keys(e._sigs).forEach(function (k) { c[k] = (c[k] || 0) + 1; if (e._sigs[k] < 0) neg[k] = 1; }); });
    var keys = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; }).slice(0, 14);
    var max = Math.max.apply(null, keys.map(function (k) { return c[k]; }).concat([1]));
    $("wsignals").innerHTML = keys.map(function (k) {
      return '<button class="hbar' + (W.signal === k ? " sel" : "") + '" data-signal="' + esc(k) + '" title="' + esc(k) + '"><span class="lbl">' +
        (neg[k] ? '<span class="pen-l">Penalty</span> ' : "") + esc(k) + '</span><span class="track"><span class="fill' + (neg[k] ? " pen" : "") + '" style="display:block;width:' +
        Math.max(2, 100 * c[k] / max) + '%"></span></span><span class="val">' + c[k] + "</span></button>";
    }).join("") || '<p class="empty">No entries in this view.</p>';
  }

  // ------------------------------------------------------------ table
  function scoreCell(e) {
    return '<div class="score"><b>' + e.score + '</b><span class="sbar"><i class="' + TIER_CLASS[e.tier] + '" style="width:' + e.score + '%"></i></span><small>' + esc(e.tier) + "</small></div>";
  }
  function renderTable() {
    var L = filtered();
    var key = { score: function (e) { return e.score * 1e9 + +(e.latest_date || "0").replace(/-/g, ""); },
                latest: function (e) { return +(e.latest_date || "0").replace(/-/g, ""); },
                found: function (e) { return +(e.first_seen || "0").replace(/-/g, "") * 1000 + e.score; } }[W.sort];
    L.sort(function (a, b) { return key(b) - key(a); });
    $("wcount").textContent = L.length + " of " + E.length + " entries" + (W.tier === "relevant" ? " · score 25+ (switch to All to include noise)" : "") + " · click a row for the score breakdown";
    $("wrows").innerHTML = L.slice(0, W.limit).map(function (e) {
      var meta = e.source === "congress"
        ? [e.label + " (" + e.congress + "th)", e.sponsor, e.policy_area].filter(Boolean).join(" · ")
        : [e.label, (e.agencies || []).slice(-1)[0], (e.dockets || [])[0]].filter(Boolean).join(" · ");
      var pos = e.reasons.filter(function (r) { return r[0] > 0; }).sort(function (a, b) { return b[0] - a[0]; }).slice(0, 2);
      var negs = e.reasons.filter(function (r) { return r[0] < 0; });
      return '<tr data-wopen="' + esc(e.key) + '" tabindex="0"><td class="c-score">' + scoreCell(e) + "</td>" +
        '<td class="c-item"><div class="it-name" style="display:block">' + esc(e.title) + (e.in_matrix ? '<span class="inm">In matrix</span>' : "") +
        (isNew(e) ? '<span class="inm" style="color:var(--good);border-color:var(--good)">New</span>' : "") + "</div>" +
        '<div class="it-meta" style="padding-left:0">' + SM.nw(meta) + "</div></td>" +
        '<td class="c-act"><div class="act">' + esc(e.latest_text || "—") + '</div><div class="act-date">' + (e.latest_date ? fmt(e.latest_date) + " · " + rel(e.latest_date) : "") +
        (e.comments_close && e.comments_close >= new Date().toISOString().slice(0, 10) ? ' · <span class="fresh">comments open</span>' : "") + "</div></td>" +
        '<td class="c-sig"><div class="sig">' + pos.map(function (r) { return "<span title=\"" + esc(r[1]) + "\">+" + r[0] + " " + esc(signal(r)) + "</span>"; }).join("") +
        negs.map(function (r) { return '<span class="neg" title="' + esc(r[1]) + '">' + r[0] + " " + esc(signal(r)) + "</span>"; }).join("") + "</div></td></tr>";
    }).join("") || '<tr><td colspan="4" class="empty">No entries match these filters.</td></tr>';
    $("wmore").hidden = L.length <= W.limit;
    $("wmore").textContent = "Show " + Math.min(100, L.length - W.limit) + " more (" + (L.length - W.limit) + " hidden)";
  }

  function renderChips() {
    var c = [];
    if (W.q) c.push(["q", "Search", "“" + W.q + "”"]);
    if (W.band >= 0) c.push(["band", "Score", W.band * 5 + "–" + (W.band * 5 + 4)]);
    if (W.signal) c.push(["signal", "Signal", W.signal]);
    $("wchips").hidden = !c.length;
    $("wchips").innerHTML = c.map(function (x) { return '<button class="chip" data-wclear="' + x[0] + '">' + x[1] + ": <b>" + esc(x[2]) + '</b><span aria-label="Remove">' + ic("x") + "</span></button>"; }).join("");
  }

  function renderAll() {
    renderChips(); renderKPIs(); renderSignals(); renderTable(); renderHist();
    Array.prototype.forEach.call($("wsrc").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === W.src)); });
    Array.prototype.forEach.call($("wtier").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === W.tier)); });
  }

  // ------------------------------------------------------------ drawer
  function open(key) {
    var go = function () {
      var e = BYK[key]; if (!e) return;
      var total = 0;
      var rows = e.reasons.slice().sort(function (a, b) { return b[0] - a[0]; }).map(function (r) {
        total += r[0];
        return '<tr><td>' + esc(r[1]) + '</td><td class="pts' + (r[0] < 0 ? " neg" : "") + '">' + (r[0] > 0 ? "+" : "") + r[0] + "</td></tr>";
      }).join("");
      var h = '<div class="dr-top"><h2 class="dr-title" id="dr-title">' + esc(e.title) + '</h2><button class="close" id="dr-close" aria-label="Close">' + ic("x") + "</button></div>" +
        '<div class="dr-id">' + (e.source === "congress" ? '<span class="cardtab t-legislation">Bill · ' + esc(e.label) + "</span><span>" + e.congress + "th Congress</span>"
          : '<span class="cardtab t-regulatory">Federal Register · ' + esc(e.label) + "</span>") +
        '<span class="tier-tag"><i class="tdot ' + TIER_CLASS[e.tier] + '"></i>' + esc(e.tier) + "</span>" +
        (e.in_matrix ? '<a class="link" href="#' + esc(e.in_matrix) + '" data-open="' + esc(e.in_matrix) + '">Open in matrix ' + ic("arrow") + "</a>" : "") +
        (e.status === "dismissed" ? '<span class="tag">Dismissed</span>' : "") + "</div>" +
        '<div class="ed-slot" id="ed-slot"></div>' +
        '<div class="bigscore"><b>' + e.score + '</b><div class="meter"><i class="' + TIER_CLASS[e.tier] + '" style="width:' + e.score + '%"></i><s style="left:25%"></s><s style="left:45%"></s><s style="left:70%"></s></div></div>' +
        '<p class="hint">Relevance score out of 100 (Low 25+, Medium 45+, High 70+).</p>' +
        '<section class="dr-sec"><h3>Why it scored ' + e.score + '</h3><table class="breakdown">' + rows +
        '<tr class="total"><td>Total' + (total !== e.score ? " (capped at 0–100)" : "") + '</td><td class="pts">' + e.score + "</td></tr></table></section>";
      h += '<dl class="facts">' +
        f("Latest action", e.latest_date ? fmt(e.latest_date) + ' <span class="hint">' + rel(e.latest_date) + "</span>" : "") +
        f("Action", esc(e.latest_text)) + f("Sponsor", SM.nw(e.sponsor || "")) +
        f("Cosponsors", e.source === "congress" ? e.cosponsors : "") + f("Introduced", e.introduced ? fmt(e.introduced) : "") +
        f("Policy area", esc(e.policy_area || "")) + f("Agencies", esc((e.agencies || []).join(", "))) +
        f("Comments close", e.comments_close ? fmt(e.comments_close) : "") + f("Docket", esc((e.dockets || []).join("; "))) +
        f("Law", esc(e.law || "")) + f("First seen", e.first_seen ? fmt(e.first_seen) : "") + "</dl>";
      if (e.summary) h += '<section class="dr-sec"><h3>' + (e.source === "congress" ? "CRS summary" : "Abstract") + "</h3><p>" + esc(e.summary) + (e.summary.length >= 700 ? "…" : "") + "</p></section>";
      if ((e.subjects || []).length) h += '<section class="dr-sec"><h3>Official subjects</h3><div class="tags">' + e.subjects.map(function (x) { return '<span class="tag">' + esc(x) + "</span>"; }).join("") + "</div></section>";
      if ((e.committees || []).length) h += '<section class="dr-sec"><h3>Committees</h3><p>' + esc(e.committees.join("; ")) + "</p></section>";
      h += '<section class="dr-sec"><h3>Source</h3><div class="links"><a href="' + esc(e.url) + '" target="_blank" rel="noopener">' + esc(e.url.replace(/^https?:\/\/(www\.)?/, "")) + "</a></div></section>";
      if (!e.in_matrix) h += '<section class="dr-sec"><h3>Add to the matrix</h3><p>Run this in the repo, fill in the analysis, and merge:</p><div class="cli">python3 scripts/triage.py promote ' + esc(e.key) + ' --issue "…"</div></section>';
      SM.showDrawer(h, "w/" + key);
      document.dispatchEvent(new CustomEvent("drawer:open", { detail: { type: "watch", entry: e } }));
    };
    (loaded || load()).then(go);
  }
  function f(k, v) { return v || v === 0 ? '<div class="fact"><dt>' + k + "</dt><dd>" + v + "</dd></div>" : ""; }

  // ------------------------------------------------------------ events & load
  function bind() {
    if (bound) return; bound = true;
    var qt;
    $("wq").addEventListener("input", function (e) { clearTimeout(qt); qt = setTimeout(function () { W.q = e.target.value.trim(); W.limit = 100; renderAll(); }, 120); });
    $("wsrc").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) { W.src = b.dataset.v; W.limit = 100; renderAll(); } });
    $("wtier").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) { W.tier = b.dataset.v; W.limit = 100; renderAll(); } });
    $("wsort").addEventListener("change", function (e) { W.sort = e.target.value; renderTable(); });
    $("wnomatrix").addEventListener("change", function (e) { W.noMatrix = e.target.checked; renderAll(); });
    $("wkpis").addEventListener("click", function (e) { var b = e.target.closest("[data-wtier]"); if (b) { W.tier = b.dataset.wtier || ""; renderAll(); } });
    $("whist").addEventListener("click", function (e) { var g = e.target.closest("[data-band]"); if (g) { SM.hideTip(); W.band = W.band === +g.dataset.band ? -1 : +g.dataset.band; W.limit = 100; renderAll(); } });
    $("whist").addEventListener("keydown", function (e) { var g = e.target.closest("[data-band]"); if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); W.band = W.band === +g.dataset.band ? -1 : +g.dataset.band; renderAll(); } });
    SM.bindTips($("whist"), histTip);
    $("wsignals").addEventListener("click", function (e) { var b = e.target.closest("[data-signal]"); if (b) { W.signal = W.signal === b.dataset.signal ? "" : b.dataset.signal; W.limit = 100; renderAll(); } });
    $("wchips").addEventListener("click", function (e) { var b = e.target.closest("[data-wclear]"); if (!b) return; var k = b.dataset.wclear; if (k === "band") W.band = -1; else { W[k] = ""; if (k === "q") $("wq").value = ""; } renderAll(); });
    $("wmore").addEventListener("click", function () { W.limit += 100; renderTable(); });
    document.querySelector("#wtbl thead").addEventListener("click", function (e) { var th = e.target.closest("[data-wsort]"); if (th) { W.sort = th.dataset.wsort; $("wsort").value = W.sort; renderTable(); } });
    $("wrows").addEventListener("click", function (e) { var r = e.target.closest("[data-wopen]"); if (r) open(r.dataset.wopen); });
    $("wrows").addEventListener("keydown", function (e) { var r = e.target.closest("[data-wopen]"); if (r && e.key === "Enter") open(r.dataset.wopen); });
    var rt; window.addEventListener("resize", function () { if (!$("view-watch").hidden) { clearTimeout(rt); rt = setTimeout(renderHist, 120); } });
  }
  function load() {
    loaded = fetch("watchlist.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (d) {
      E = d.entries || []; BYK = {};
      E.forEach(function (e) {
        BYK[e.key] = e; e._sigs = {}; e.reasons = e.reasons || [];
        e.reasons.forEach(function (r) { e._sigs[signal(r)] = r[0]; });
        if (!BASE || e.first_seen < BASE) BASE = e.first_seen;
      });
      $("tab-n-watch").textContent = E.filter(function (e) { return e.score >= 25; }).length;
    }).catch(function () {
      $("wrows").innerHTML = '<tr><td colspan="4" class="empty">No watchlist yet. Run <code>python3 scripts/discover.py --backfill</code> then <code>python3 scripts/build.py</code>.</td></tr>';
    });
    return loaded;
  }
  window.Watch = {
    show: function () { bind(); (loaded || load()).then(renderAll); },
    open: open
  };
  load();
})();
