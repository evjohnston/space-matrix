(function () {
  "use strict";

  // ---------------------------------------------------------------- state
  var S = { q: "", kind: "", issue: "", aligns: "", stage: "", month: "", flag: false, sort: "activity", dir: -1, actTable: false };
  var SEL = "";  // id of the item open in the procedure card
  var D = null, ITEMS = [], BY = {};
  var TODAY = new Date(); TODAY.setHours(12, 0, 0, 0);
  var TODAY_ISO = iso(TODAY);
  var KINDS = ["legislation", "regulatory", "executive"];
  var KIND_LABEL = { legislation: "Legislation", executive: "Executive", regulatory: "Regulatory" };
  var AL = { Yes: ["a-yes", "Aligns"], "N/A": ["a-na", "N/A"], Unassessed: ["a-un", "Unassessed"], No: ["a-no", "Doesn’t align"] };
  var AL_ORDER = ["Yes", "N/A", "Unassessed", "No"];
  var $ = function (id) { return document.getElementById(id); };
  function ic(name, cls) { return '<svg class="ic' + (cls ? " " + cls : "") + '" aria-hidden="true" focusable="false"><use href="#i-' + name + '"/></svg>'; }

  // ---------------------------------------------------------------- utils
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function parse(s) { return new Date(s.length === 10 ? s + "T12:00:00" : s); }
  function fmt(s, opt) {
    if (!s) return "";
    var d = parse(s); if (isNaN(d)) return s;
    return d.toLocaleDateString("en-US", opt || { year: "numeric", month: "short", day: "numeric" });
  }
  function days(s) { return s ? Math.round((TODAY - parse(s)) / 864e5) : Infinity; }
  function rel(s) {
    var n = days(s);
    if (!isFinite(n)) return "";
    if (n < 0) return "in " + (-n) + (n === -1 ? " day" : " days");
    if (n === 0) return "today";
    if (n === 1) return "yesterday";
    if (n < 45) return n + " days ago";
    if (n < 540) return Math.round(n / 30.4) + " months ago";
    return (n / 365).toFixed(1).replace(".0", "") + " years ago";
  }
  function monthKey(s) { return s.slice(0, 7); }
  function monthLabel(k, long) {
    var d = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1);
    return d.toLocaleDateString("en-US", long ? { month: "long", year: "numeric" } : { month: "short" }) + (long ? "" : " ’" + k.slice(2, 4));
  }
  function norm(s) { return s.replace(/\s+/g, " ").trim(); }
  function stageKey(it) {
    var st = it.stage;
    if (st.track === "legislation") return st.expired ? "leg:died" : "leg:" + st.step;
    return (st.track === "regulatory" ? "reg:" : "exec:") + st.label;
  }
  function stageKeyLabel(k) {
    if (k === "leg:died") return "Died in a past Congress";
    if (k.indexOf("leg:") === 0) {
      var leg = ITEMS.filter(function (i) { return i.stage.track === "legislation"; })[0];
      return leg ? leg.stage.steps[+k.slice(4)] : k;
    }
    return k.split(":")[1];
  }
  function statusBehind(it) {
    return it.latest && it.status_date && days(it.status_date) - days(it.latest.date) > 2;
  }
  function flags(it) {
    var out = [];
    if (statusBehind(it)) out.push("Official record shows activity on <b>" + fmt(it.latest.date) + "</b>, after the curated status date (" + fmt(it.status_date) + ").");
    if (it.comments_close && it.comments_close < TODAY_ISO && /comment|review period|open/i.test(it.status))
      out.push("The comment period closed <b>" + fmt(it.comments_close) + "</b>, but the curated status still reads “" + esc(it.status) + "”.");
    it.bills.forEach(function (b) {
      var a = words(it.name), t = words(b.title), hit = 0;
      a.forEach(function (w) { if (t.indexOf(w) >= 0) hit++; });
      if (a.length && t.length && hit / Math.min(a.length, t.length) < 0.34)
        out.push("<b>" + esc(b.label) + "</b> is officially titled “" + esc(b.title) + "”, which doesn’t match this item. Check the bill number.");
    });
    return out;
  }
  var STOP = "a an and the of for to in on act bill by with from or at as is be this that".split(" ");
  function words(s) { return (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter(function (w) { return w.length > 2 && STOP.indexOf(w) < 0; }); }

  // ---------------------------------------------------------------- filtering
  function matches(it, except) {
    if (S.kind && except !== "kind" && it.kind !== S.kind) return false;
    if (S.issue && except !== "issue" && it.issues.map(norm).indexOf(S.issue) < 0) return false;
    if (S.aligns && except !== "aligns" && it.aligns !== S.aligns) return false;
    if (S.stage && except !== "stage" && stageKey(it) !== S.stage) return false;
    if (S.flag && except !== "flag" && !flags(it).length) return false;
    if (S.month && except !== "month" && !it.timeline.some(function (e) { return e.date.slice(0, 7) === S.month; })) return false;
    if (S.q) {
      var hay = it._hay || (it._hay = [it.name, it.number, it.entity, it.status, it.sponsors, it.issues.join(" "), it.effect,
        it.bills.map(function (b) { return b.label + " " + b.title + " " + b.sponsor + " " + b.committees.join(" "); }).join(" "),
        it.timeline.slice(0, 8).map(function (e) { return e.text; }).join(" ")].join(" ").toLowerCase());
      return S.q.toLowerCase().split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
    }
    return true;
  }
  function filtered(except) { return ITEMS.filter(function (it) { return matches(it, except); }); }

  // ---------------------------------------------------------------- tooltip
  var tip = $("tip");
  function showTip(html, ev, el) {
    tip.innerHTML = html; tip.hidden = false;
    var r = el && !ev.clientX ? el.getBoundingClientRect() : null;
    var x = r ? r.left + r.width / 2 : ev.clientX, y = r ? r.top : ev.clientY;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = Math.min(Math.max(8, x + 14), window.innerWidth - w - 8);
    if (x + 14 + w > window.innerWidth - 8) left = Math.max(8, x - w - 14);
    var top = y - h - 12; if (top < 8) top = y + 18;
    tip.style.left = left + "px"; tip.style.top = top + "px";
  }
  function hideTip() { tip.hidden = true; }
  function bindTips(root, fn) {
    root.addEventListener("mousemove", function (e) { var t = e.target.closest("[data-tip]"); if (t) showTip(fn(t), e); else hideTip(); });
    root.addEventListener("mouseleave", hideTip);
    root.addEventListener("focusin", function (e) { var t = e.target.closest("[data-tip]"); if (t) showTip(fn(t), {}, t); });
    root.addEventListener("focusout", hideTip);
  }

  // ---------------------------------------------------------------- cue strip
  function renderKPIs() {
    var L = filtered();
    var byKind = {}; KINDS.forEach(function (k) { byKind[k] = 0; });
    L.forEach(function (i) { byKind[i.kind]++; });
    var active = L.filter(function (i) { return i.latest && days(i.latest.date) <= 30; });
    var acts30 = 0; L.forEach(function (i) { i.timeline.forEach(function (e) { if (days(e.date) <= 30) acts30++; }); });
    var open = L.filter(function (i) { return i.comments_close && i.comments_close >= TODAY_ISO; })
      .sort(function (a, b) { return a.comments_close < b.comments_close ? -1 : 1; });
    var review = filtered("flag").filter(function (i) { return flags(i).length; });
    var bills = L.filter(function (i) { return i.stage.track === "legislation" && !i.stage.expired; });
    var passed = bills.filter(function (i) { return i.stage.step >= 3; });
    var next = open.length ? -days(open[0].comments_close) : null;
    var when = next === null ? "" : next === 0 ? "today" : next === 1 ? "tomorrow" : "in " + next + " days";
    var sameDay = open.filter(function (i) { return i.comments_close === (open[0] || {}).comments_close; }).length;
    var cues = [
      { act: "deadlines", n: open.length, crit: next !== null && next <= 7,
        t: open.length ? (sameDay === open.length ? (open.length === 1 ? "comment period closes " : "comment periods close ") + when
                                                  : "open comment periods · next closes " + when) : "open comment periods",
        d: open.length ? fmt(open[0].comments_close, { weekday: "short", month: "short", day: "numeric" }) + " · " + esc(open[0].name.slice(0, 44)) + (open[0].name.length > 44 ? "…" : "") : "Nothing closing" },
      { act: "review", n: review.length, on: S.flag, t: (review.length === 1 ? "item needs" : "items need") + " review",
        d: "Official record ahead of the curated status" },
      { act: "active", n: active.length, t: (active.length === 1 ? "item" : "items") + " moved in 30 days", d: acts30 + " official action" + (acts30 === 1 ? "" : "s") + " logged" },
      { act: "passed", n: passed.length, t: "of " + bills.length + " active bills through a chamber", d: bills.filter(function (i) { return i.stage.step === 2; }).length + " more reported or on a calendar" }
    ];
    $("kpis").innerHTML = '<div class="cue-h">Cue<span>now</span></div>' + cues.map(function (c) {
      return '<button class="cue' + (c.crit ? " crit" : "") + (c.on ? " on" : "") + '" data-act="' + c.act + '"' + (c.act === "review" ? ' aria-pressed="' + !!c.on + '"' : "") + ">" +
        '<span class="cue-t">' + (c.crit ? ic("alert") : "") + "<b>" + c.n + "</b> " + c.t + '</span><span class="cue-d">' + c.d + "</span></button>";
    }).join("") + '<div class="cue-sum">' + L.length + (L.length !== ITEMS.length ? " of " + ITEMS.length : "") + " items · " +
      KINDS.map(function (k) { return '<span><i class="tdot t-' + k + '"></i>' + byKind[k] + " " + KIND_LABEL[k].toLowerCase() + "</span>"; }).join("") + "</div>";
  }

  // ---------------------------------------------------------------- activity chart
  function months(n) {
    var out = [], d = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
    for (var i = n - 1; i >= 0; i--) { var m = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(m.getFullYear() + "-" + pad(m.getMonth() + 1)); }
    return out;
  }
  function activityData() {
    var ms = months(24), idx = {}, rows = ms.map(function (m, i) { idx[m] = i; return { m: m, legislation: 0, regulatory: 0, executive: 0, total: 0, items: {} }; });
    filtered("month").forEach(function (it) {
      it.timeline.forEach(function (e) {
        if (e.kind === "Deadline" || e.kind === "Effective") return;
        var i = idx[monthKey(e.date)]; if (i === undefined) return;
        rows[i][it.kind]++; rows[i].total++; rows[i].items[it.id] = (rows[i].items[it.id] || 0) + 1;
      });
    });
    return rows;
  }
  function niceStep(v) { var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
  function topPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    return "M" + x + "," + (y + h) + "V" + (y + r) + "Q" + x + "," + y + " " + (x + r) + "," + y + "H" + (x + w - r) +
      "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) + "V" + (y + h) + "Z";
  }
  function renderActivity() {
    var rows = activityData(), el = $("activity");
    $("act-legend").innerHTML = KINDS.map(function (k) { return '<span><i class="t-' + k + '"></i>' + KIND_LABEL[k] + "</span>"; }).join("");
    if (S.actTable) {
      el.innerHTML = '<div class="act-table"><table class="datatable"><thead><tr><th>Month</th>' + KINDS.map(function (k) { return "<th>" + KIND_LABEL[k] + "</th>"; }).join("") +
        "<th>Total</th></tr></thead><tbody>" + rows.slice().reverse().map(function (r) {
          return "<tr><td>" + monthLabel(r.m, true) + "</td>" + KINDS.map(function (k) { return "<td>" + r[k] + "</td>"; }).join("") + "<td><b>" + r.total + "</b></td></tr>";
        }).join("") + "</tbody></table></div>";
      return;
    }
    var W = Math.max(280, el.clientWidth), H = Math.max(210, Math.min(400, el.clientHeight || 0)), ml = 30, mr = 4, mt = 8, mb = 24;
    var pw = W - ml - mr, ph = H - mt - mb, band = pw / rows.length, bw = Math.min(22, Math.max(4, band * 0.62));
    var peak = Math.max.apply(null, rows.map(function (r) { return r.total; })) || 1;
    var tstep = Math.max(1, niceStep(peak / 4)), nt = Math.ceil(peak / tstep), max = nt * tstep;
    var y = function (v) { return mt + ph - (v / max) * ph; };
    var step = W < 520 ? 6 : 3;
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" height="' + H + '" style="position:absolute;inset:0" role="img" aria-label="Official actions per month, stacked by item type">';
    for (var g = 0; g <= nt; g++) {
      var gv = g * tstep, gy = y(gv);
      s += '<line class="' + (g ? "gridline" : "baseline") + '" x1="' + ml + '" x2="' + (W - mr) + '" y1="' + gy + '" y2="' + gy + '"/>';
      s += '<text class="tick" x="' + (ml - 6) + '" y="' + (gy + 4) + '" text-anchor="end">' + Math.round(gv) + "</text>";
    }
    rows.forEach(function (r, i) {
      var x0 = ml + i * band, bx = x0 + (band - bw) / 2, sel = S.month === r.m, dim = S.month && !sel;
      s += '<g class="col' + (sel ? " sel" : "") + '" data-tip="' + i + '" data-month="' + r.m + '" tabindex="0" role="button" aria-label="' +
        monthLabel(r.m, true) + ": " + r.total + ' actions">';
      s += '<rect class="hit" x="' + x0 + '" y="' + mt + '" width="' + band + '" height="' + ph + '" rx="4"/>';
      var base = 0, segs = KINDS.filter(function (k) { return r[k]; });
      segs.forEach(function (k, j) {
        var yTop = y(base + r[k]), yBot = y(base) - (j ? 2 : 0), h = Math.max(1, yBot - yTop);
        var top = j === segs.length - 1;
        s += top ? '<path class="' + (dim ? "dim" : "") + '" style="fill:var(--t-' + k + ')" d="' + topPath(bx, yTop, bw, h, 4) + '"/>'
          : '<rect class="' + (dim ? "dim" : "") + '" style="fill:var(--t-' + k + ')" x="' + bx + '" y="' + yTop + '" width="' + bw + '" height="' + h + '"/>';
        base += r[k];
      });
      if ((rows.length - 1 - i) % step === 0)
        s += '<text class="tick" x="' + (x0 + band / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + monthLabel(r.m) + "</text>";
      s += "</g>";
    });
    el.innerHTML = s + "</svg>";
    el._rows = rows;
  }
  function activityTip(t) {
    var r = $("activity")._rows[+t.dataset.tip];
    var top = Object.keys(r.items).sort(function (a, b) { return r.items[b] - r.items[a]; }).slice(0, 3);
    return "<h4>" + monthLabel(r.m, true) + "</h4>" + KINDS.map(function (k) {
      return '<div class="tr"><span><i class="tdot t-' + k + '"></i>' + KIND_LABEL[k] + "</span><b>" + r[k] + "</b></div>";
    }).join("") + '<div class="tr"><span>Total</span><b>' + r.total + "</b></div>" +
      (top.length ? '<div class="tnote">Most active: ' + top.map(function (id) { return esc(BY[id].name); }).join("; ") + "</div>" : "") +
      '<div class="tnote">' + (S.month === r.m ? "Click to clear the filter" : "Click to filter to this month") + "</div>";
  }

  // ---------------------------------------------------------------- pipeline & status bars
  function hbar(key, label, n, max, cls, title) {
    var sel = S.stage === key;
    return '<button class="hbar' + (n ? "" : " zero") + (sel ? " sel" : "") + '" data-stage="' + esc(key) + '" title="' + esc(title || label) + '">' +
      '<span class="lbl">' + esc(label) + '</span><span class="track"><span class="fill ' + (cls || "") + '" style="display:block;width:' +
      (n ? Math.max(2, 100 * n / max) : 0) + '%"></span></span><span class="val">' + n + "</span></button>";
  }
  function renderPipeline() {
    var L = filtered("stage").filter(function (i) { return i.stage.track === "legislation"; });
    var steps = (L[0] || ITEMS.filter(function (i) { return i.stage.track === "legislation"; })[0] || { stage: { steps: [] } }).stage.steps;
    var counts = steps.map(function () { return 0; }), died = 0;
    L.forEach(function (i) { if (i.stage.expired) died++; else counts[i.stage.step]++; });
    var max = Math.max.apply(null, counts.concat([died, 1]));
    $("pipeline").innerHTML = steps.map(function (st, i) { return hbar("leg:" + i, st, counts[i], max); }).join("") +
      hbar("leg:died", "Died (past Congress)", died, max, "muted");
  }
  function renderRegStatus() {
    var L = filtered("stage");
    var reg = ["Proposed", "Comments open", "Comments closed", "Final / in effect", "Withdrawn"], ex = {}, rc = {};
    L.forEach(function (i) {
      if (i.stage.track === "regulatory") rc[i.stage.label] = (rc[i.stage.label] || 0) + 1;
      if (i.stage.track === "executive") ex[i.stage.label] = (ex[i.stage.label] || 0) + 1;
    });
    var exKeys = Object.keys(ex).sort(function (a, b) { return ex[b] - ex[a]; });
    var max = Math.max.apply(null, reg.map(function (k) { return rc[k] || 0; }).concat(exKeys.map(function (k) { return ex[k]; }), [1]));
    $("regstatus").innerHTML = '<div class="hgroup"><i class="tdot t-regulatory"></i>Rulemaking &amp; agency</div>' +
      reg.map(function (k) { return hbar("reg:" + k, k, rc[k] || 0, max, k === "Withdrawn" ? "muted" : "t-regulatory"); }).join("") +
      '<div class="hgroup"><i class="tdot t-executive"></i>Executive actions</div>' +
      (exKeys.length ? exKeys.map(function (k) { return hbar("exec:" + k, k, ex[k], max, "t-executive"); }).join("") : '<p class="empty">None in this view</p>');
  }

  // ---------------------------------------------------------------- alignment by issue
  function renderAlignment() {
    var L = filtered("issue"), by = {};
    L.forEach(function (it) {
      (it.issues.length ? it.issues : ["Unspecified"]).forEach(function (raw) {
        var k = norm(raw); by[k] = by[k] || { Yes: 0, "N/A": 0, Unassessed: 0, No: 0, n: 0 };
        by[k][it.aligns]++; by[k].n++;
      });
    });
    var keys = Object.keys(by).sort(function (a, b) { return by[b].n - by[a].n || a.localeCompare(b); });
    var top = keys.slice(0, 8), rest = keys.slice(8);
    if (rest.length) {
      var o = { Yes: 0, "N/A": 0, Unassessed: 0, No: 0, n: 0, other: rest.length };
      rest.forEach(function (k) { AL_ORDER.forEach(function (a) { o[a] += by[k][a]; }); o.n += by[k].n; });
      by["Other issues"] = o; top.push("Other issues");
    }
    var max = Math.max.apply(null, top.map(function (k) { return by[k].n; }).concat([1]));
    $("al-legend").innerHTML = AL_ORDER.map(function (a) { return '<span><i class="' + AL[a][0] + '"></i>' + AL[a][1] + "</span>"; }).join("");
    $("alignment").innerHTML = top.length ? top.map(function (k) {
      var r = by[k], sel = S.issue === k;
      return '<button class="srow' + (sel ? " sel" : "") + '" data-issue="' + esc(r.other ? "" : k) + '"' + (r.other ? " disabled" : "") + ">" +
        '<span class="lbl" title="' + esc(k) + '">' + esc(k) + (r.other ? " (" + r.other + ")" : "") + '</span><span class="stk" style="width:' + (100 * r.n / max) + '%">' +
        AL_ORDER.filter(function (a) { return r[a]; }).map(function (a) {
          return '<i class="' + AL[a][0] + '" style="flex:' + r[a] + '" data-tip="' + esc(k) + "|" + a + "|" + r[a] + "|" + r.n + '"></i>';
        }).join("") + '</span><span class="val">' + r.n + "</span></button>";
    }).join("") : '<p class="empty">No items in this view</p>';
  }
  function alignTip(t) {
    var p = t.dataset.tip.split("|");
    return "<h4>" + esc(p[0]) + '</h4><div class="tr"><span><i class="tdot ' + AL[p[1]][0] + '"></i>' + AL[p[1]][1] + "</span><b>" + p[2] + " of " + p[3] + "</b></div>";
  }

  // ---------------------------------------------------------------- deadlines
  function renderDeadlines() {
    var L = filtered();
    var open = L.filter(function (i) { return i.comments_close && i.comments_close >= TODAY_ISO; })
      .sort(function (a, b) { return a.comments_close < b.comments_close ? -1 : 1; });
    var closed = L.filter(function (i) { return i.comments_close && i.comments_close < TODAY_ISO && days(i.comments_close) <= 90; })
      .sort(function (a, b) { return a.comments_close < b.comments_close ? 1 : -1; });
    var html = open.map(function (i) {
      var left = -days(i.comments_close), pub = (i.documents.filter(function (d) { return d.comments_close; })[0] || {}).published;
      var total = pub ? Math.max(1, days(pub) + left) : 0, pct = total ? Math.min(100, 100 * (total - left) / total) : 0;
      return '<li><button class="dl' + (left <= 2 ? " closing" : left <= 7 ? " urgent" : "") + '" data-open="' + esc(i.id) + '"><span class="days"><b>' + left + "</b><small>" +
        (left === 1 ? "day" : "days") + '</small></span><span><span class="dl-name">' + esc(i.name) + '</span><span class="dl-meta">' + esc(i.number.split(";")[0]) +
        " · closes " + fmt(i.comments_close) + "</span>" + (total ? '<span class="prog" title="' + Math.round(pct) + '% of the comment period elapsed"><i style="width:' + pct + '%"></i></span>' : "") +
        "</span></button></li>";
    }).join("");
    if (!open.length) html = '<li class="empty">No comment periods are open in this view.</li>';
    if (closed.length) html += '<li class="dl-closed">Recently closed: ' + closed.map(function (i) {
      return '<a href="#' + esc(i.id) + '">' + esc(i.name.length > 48 ? i.name.slice(0, 46) + "…" : i.name) + "</a> (" + fmt(i.comments_close, { month: "short", day: "numeric" }) + ")";
    }).join(", ") + "</li>";
    $("deadlines").innerHTML = html;
  }

  // ---------------------------------------------------------------- table
  var SORTS = {
    name: function (i) { return i.name.toLowerCase(); },
    stage: function (i) { return (i.stage.track === "legislation" ? 0 : i.stage.track === "regulatory" ? 1 : 2) * 10 + (i.stage.expired ? -1 : i.stage.step); },
    activity: function (i) { return (i.latest && i.latest.date) || i.activity_date || ""; },
    cosponsors: function (i) { return i.cosponsors; },
    aligns: function (i) { return AL_ORDER.indexOf(i.aligns); }
  };
  function stepState(st, i) {
    if (i < st.step) return "done";
    if (i === st.step) return st.expired || i === st.steps.length - 1 ? "done" : "cur";
    if (st.expired && i === st.step + 1) return "x";  // where it stopped: withdrawn / died
    return "";
  }
  function stepper(it) {
    var st = it.stage;
    return '<div class="steps' + (st.expired ? " dead" : "") + '" role="img" aria-label="' + esc(st.label) + ", step " + (st.step + 1) + " of " + st.steps.length + '">' +
      st.steps.map(function (n, i) {
        var cls = stepState(st, i);
        return '<i class="' + cls + '" title="' + esc(n) + (cls === "x" ? " (not reached)" : "") + '">' + (cls === "done" ? ic("check") : cls === "x" ? ic("x") : i + 1) + "</i>";
      }).join("") + "</div>";
  }
  function nw(t) { return esc(t).replace(/\[([^\]]+)\]/g, '<span class="nw">[$1]</span>'); }
  function pill(a) { return '<span class="pill al-' + AL[a][0] + '"><i class="' + AL[a][0] + '"></i>' + AL[a][1] + "</span>"; }
  function renderTable() {
    var L = filtered(), f = SORTS[S.sort];
    L.sort(function (a, b) { var x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * S.dir || a.name.localeCompare(b.name); });
    $("count").textContent = L.length + " of " + ITEMS.length + " items · click a row for full detail";
    Array.prototype.forEach.call(document.querySelectorAll("#tbl th"), function (th) {
      if (th.dataset.sort === S.sort) th.setAttribute("aria-sort", S.dir > 0 ? "ascending" : "descending"); else th.removeAttribute("aria-sort");
    });
    $("rows").innerHTML = L.map(function (it) {
      var lt = it.latest, fl = flags(it).length;
      var act = lt ? '<div class="act">' + esc(lt.text) + '</div><div class="act-date">' + (days(lt.date) <= 14 ? '<span class="fresh">New</span> ' : "") +
        fmt(lt.date) + " · " + rel(lt.date) + " · " + esc(lt.source) + "</div>"
        : '<div class="act">' + esc(it.status || "—") + '</div><div class="act-date">Curated status' + (it.status_date ? " · " + fmt(it.status_date) : "") + " · no API source</div>";
      return '<tr data-open="' + esc(it.id) + '" tabindex="0"' + (it.id === SEL ? ' class="sel" aria-current="true"' : "") + ">" +
        '<td class="c-item"><div class="it-name"><i class="tdot t-' + it.kind + '" title="' + KIND_LABEL[it.kind] + '"></i><span>' + esc(it.name) + "</span></div>" +
        '<div class="it-meta">' + esc([it.number.split(";")[0], it.entity].filter(Boolean).join(" · ")) + (fl ? ' <span class="flag">' + ic("alert") + fl + " to review</span>" : "") + "</div></td>" +
        '<td class="c-stage">' + stepper(it) + '<div class="stage-lbl">' + esc(it.stage.label) + "</div></td>" +
        '<td class="c-act">' + act + "</td>" +
        '<td class="c-cos num">' + (it.bills.length ? it.cosponsors : "—") + "</td>" +
        '<td class="c-al">' + pill(it.aligns) + "</td></tr>";
    }).join("") || '<tr><td colspan="5" class="empty">No items match these filters. <button class="link" data-clear="all">Clear filters</button></td></tr>';
    $("tbl").classList.toggle("has-sel", !!SEL && L.some(function (i) { return i.id === SEL; }));
  }

  // ---------------------------------------------------------------- feed
  function renderFeed() {
    var L = filtered(), ev = [];
    var changed = {}; (D.changes || []).forEach(function (c) { changed[c.item_id + "|" + (c.event_date || "")] = 1; });
    L.forEach(function (it) { it.timeline.forEach(function (e) { ev.push({ it: it, e: e }); }); });
    ev.sort(function (a, b) { return a.e.date < b.e.date ? 1 : a.e.date > b.e.date ? -1 : 0; });
    ev = ev.slice(0, 60);
    var last = "", html = "";
    ev.forEach(function (x) {
      if (x.e.date !== last) { last = x.e.date; html += '<li class="day">' + fmt(x.e.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) + "</li>"; }
      html += '<li><button class="fe" data-open="' + esc(x.it.id) + '"><i class="tdot t-' + x.it.kind + '"></i><span><b>' + esc(x.it.name) +
        (changed[x.it.id + "|" + x.e.date] ? '<span class="new">New</span>' : "") + "</b><p>" + esc(x.e.text) + '</p><span class="src">' + esc(x.e.source) + "</span></span></button></li>";
    });
    $("feed").innerHTML = html || '<li class="empty">No official actions in this view.</li>';
  }

  // ---------------------------------------------------------------- chips
  function renderChips() {
    var c = [];
    if (S.q) c.push(["q", "Search", "“" + S.q + "”"]);
    if (S.kind) c.push(["kind", "Type", KIND_LABEL[S.kind]]);
    if (S.issue) c.push(["issue", "Issue", S.issue]);
    if (S.aligns) c.push(["aligns", "Alignment", AL[S.aligns][1]]);
    if (S.stage) c.push(["stage", "Stage", stageKeyLabel(S.stage)]);
    if (S.flag) c.push(["flag", "Showing", "Needs review"]);
    if (S.month) c.push(["month", "Activity in", monthLabel(S.month, true)]);
    $("chips").hidden = !c.length;
    $("chips").innerHTML = c.map(function (x) {
      return '<button class="chip" data-clear="' + x[0] + '">' + x[1] + ": <b>" + esc(x[2]) + '</b><span aria-label="Remove">' + ic("x") + "</span></button>";
    }).join("") + (c.length > 1 ? '<button class="chip clear" data-clear="all">Clear all</button>' : "");
  }

  function renderAll() {
    renderChips(); renderKPIs(); renderDeadlines(); renderPipeline(); renderRegStatus(); renderAlignment(); renderTable(); renderFeed(); renderActivity();
    $("q").value = S.q; $("issue").value = S.issue; $("aligns").value = S.aligns;
    Array.prototype.forEach.call($("kind").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === S.kind)); });
  }

  // ---------------------------------------------------------------- drawer
  var lastFocus = null;
  function fact(k, v) { return v || v === 0 ? '<div class="fact"><dt>' + k + "</dt><dd>" + v + "</dd></div>" : ""; }
  function openDrawer(id) {
    var it = BY[id]; if (!it) return;
    var b0 = it.bills.slice().sort(function (a, b) { return b.stage - a.stage; })[0];
    var committees = []; it.bills.forEach(function (b) { b.committees.forEach(function (c) { if (committees.indexOf(c) < 0) committees.push(c); }); });
    var fl = flags(it), st = it.stage;
    var h = '<div class="dr-top"><h2 class="dr-title" id="dr-title">' + esc(it.name) + '</h2><button class="close" id="dr-close" aria-label="Close">' + ic("x") + "</button></div>" +
      '<div class="dr-id"><span class="cardtab t-' + it.kind + '">' + KIND_LABEL[it.kind] + (it.number ? " · " + esc(it.number.split(";")[0]) : "") + "</span>" +
      "<span>" + esc(it.entity) + "</span>" + pill(it.aligns) + "</div>" +
      (it.issues.length ? '<div class="tags">' + it.issues.map(function (x) { return '<span class="tag">' + esc(x) + "</span>"; }).join("") + "</div>" : "");
    h += '<div class="ed-slot" id="ed-slot"></div>';
    var cur = it.latest ? fmt(it.latest.date) : "";
    h += '<ol class="proc' + (st.expired ? " dead" : "") + '" aria-label="Stage">' + st.steps.map(function (n, i) {
      var cls = stepState(st, i), here = cls === "cur";
      return '<li class="' + cls + '"' + (here ? ' aria-current="step"' : "") + '><span class="pn">' + (i < 9 ? "0" : "") + (i + 1) +
        '</span><span class="pb">' + (cls === "done" ? ic("check") : here ? ic("play") : cls === "x" ? ic("x") : "") + "</span><span>" + esc(n) +
        (cls === "x" ? ' <em class="stop">' + esc(st.label) + "</em>" : "") + "</span>" +
        '<span class="pd">' + (i === st.step ? cur : "") + "</span></li>";
    }).join("") + "</ol>";
    if (st.expired || st.label !== st.steps[st.step]) h += '<p class="hint">Now: <b>' + esc(st.label) + "</b></p>";
    if (it.comments_close && it.comments_close >= TODAY_ISO) {
      var left = -days(it.comments_close);
      h += '<div class="caution' + (left <= 7 ? " warn" : "") + '"><div class="cz"></div><p><b class="cl">' + (left <= 7 ? "Warning" : "Note") + "</b> Comment period closes " +
        fmt(it.comments_close, { weekday: "long", month: "long", day: "numeric" }) + " (" + rel(it.comments_close) + ").</p></div>";
    }
    if (fl.length) h += '<div class="caution"><div class="cz"></div><p><b class="cl">Caution</b> ' + fl.join("</p><p>") + "</p></div>";

    h += '<dl class="facts">' +
      fact("Curated status", esc(it.status || "—") + (it.status_date ? ' <span class="hint">(' + fmt(it.status_date) + ")</span>" : "")) +
      fact("Latest official action", it.latest ? fmt(it.latest.date) + ' <span class="hint">' + rel(it.latest.date) + "</span>" : "") +
      fact("Sponsor", b0 ? nw(b0.sponsor) : "") +
      fact("Cosponsors", it.bills.length ? it.cosponsors : "") +
      fact("Committees", committees.map(function (c) { return esc(c.replace(/ Committee$/, "")); }).join("; ")) +
      fact("Policy area", b0 ? esc(b0.policy_area) : "") +
      fact("Introduced", b0 && b0.introduced ? fmt(b0.introduced) : "") +
      fact("Comment deadline", it.comments_close ? fmt(it.comments_close) + ' <span class="hint">' + rel(it.comments_close) + "</span>" : "") +
      fact("Official actions logged", it.timeline.length || "") +
      fact("Last reviewed", it.last_reviewed ? fmt(it.last_reviewed) : "") + "</dl>";

    if (it.bills.length) h += '<section class="dr-sec"><h3>Bill versions</h3><div class="versions">' + it.bills.map(function (b) {
      return '<div class="ver"><div class="ver-top"><a href="' + esc(b.url) + '" target="_blank" rel="noopener">' + esc(b.label) + "</a><span class=\"muted\">" +
        esc(st.steps[b.stage] || "") + (b.law ? " · " + esc(b.law) : "") + "</span></div><div>" + esc(b.title) + '</div><div class="muted">' +
        esc(b.sponsor) + " · " + b.cosponsors + " cosponsor" + (b.cosponsors === 1 ? "" : "s") + " · " + b.actions + " actions</div>" +
        '<div class="muted">Latest (' + fmt(b.latest_date) + "): " + esc(b.latest_text) + "</div></div>";
    }).join("") + "</div></section>";
    if (it.documents.length) h += '<section class="dr-sec"><h3>Federal Register</h3><div class="versions">' + it.documents.map(function (d) {
      return '<div class="ver"><div class="ver-top"><a href="' + esc(d.url) + '" target="_blank" rel="noopener">' + esc(d.label) + '</a><span class="muted">' + esc(d.type) + "</span></div>" +
        (d.title ? "<div>" + esc(d.title) + "</div>" : "") + '<div class="muted">' + esc(d.action) + (d.published ? " · " + fmt(d.published) : "") +
        (d.comments_close ? " · comments close " + fmt(d.comments_close) : "") + (d.effective ? " · effective " + fmt(d.effective) : "") + "</div></div>";
    }).join("") + "</div></section>";

    [["Substantive effect", it.effect], ["Alignment with recommendations", it.alignment_notes], ["Sources of gridlock", it.gridlock], ["Sponsors / points of contact", it.sponsors]]
      .forEach(function (s) { if (s[1]) h += '<section class="dr-sec"><h3>' + s[0] + "</h3><p>" + esc(s[1]) + "</p></section>"; });

    var tl = it.upcoming.map(function (e) { return { e: e, future: true }; }).concat(it.timeline.map(function (e) { return { e: e }; }));
    if (tl.length) {
      var bil = tl.some(function (x) { return x.e.chamber === "House" || x.e.chamber === "Senate"; });
      h += '<section class="dr-sec"><h3>Official timeline</h3>' + (bil ? '<div class="tl-heads"><span>House</span><span></span><span>Senate</span></div>' : "") +
        '<ol class="tl' + (bil ? " bil" : "") + '" id="dr-tl">' + tl.map(function (x, i) {
          var side = x.e.chamber === "House" ? "l" : x.e.chamber === "Senate" ? "r" : "c";
          var major = /Passed|Became|Reported|Placed on|Presented|Signed|Received in the|published/i.test(x.e.text);
          return '<li class="s-' + side + (x.future ? " future" : major ? " major" : "") + '"' + (i >= 14 ? " hidden" : "") + '><time>' + fmt(x.e.date, { month: "short", day: "numeric", year: "2-digit" }) +
            '</time><div class="ev"><p>' + esc(x.e.text) + '</p><span class="src">' + (x.future ? "Upcoming · " : "") + esc(x.e.source.replace(/ \(\d+th Congress\)/, "")) + "</span></div></li>";
        }).join("") + "</ol>" + (tl.length > 14 ? '<button class="more" id="dr-more">Show all ' + tl.length + " entries</button>" : "") + "</section>";
    }
    if (it.links.length) h += '<section class="dr-sec"><h3>Primary sources</h3><div class="links">' + it.links.map(function (l) {
      return '<a href="' + esc(l) + '" target="_blank" rel="noopener">' + esc(l.replace(/^https?:\/\/(www\.)?/, "")) + "</a>";
    }).join("") + "</div></section>";

    SEL = id; renderTable();
    showDrawer(h, id);
    var row = document.querySelector("#rows tr.sel");
    if (row && document.body.classList.contains("docked")) {
      var r = row.getBoundingClientRect();
      if (r.top < 120 || r.bottom > innerHeight) row.scrollIntoView({ block: "center" });
    }
    document.dispatchEvent(new CustomEvent("drawer:open", { detail: { type: "item", id: id } }));
  }
  function showDrawer(h, hash) {
    if ($("drawer").hidden) lastFocus = document.activeElement;
    $("drawer-body").innerHTML = h;
    var dock = matchMedia("(min-width: 1280px)").matches, was = document.body.classList.contains("docked");
    document.body.classList.toggle("docked", dock);
    if (dock !== was) window.dispatchEvent(new Event("resize"));  // charts re-measure for the narrower column
    $("drawer").hidden = false; $("scrim").hidden = dock; $("drawer").scrollTop = 0;
    document.body.style.overflow = dock ? "" : "hidden";
    var c = $("dr-close"); if (c) c.focus();
    if (hash && location.hash !== "#" + hash) history.replaceState(null, "", "#" + hash);
  }
  function closeDrawer() {
    if ($("drawer").hidden) return;
    $("drawer").hidden = true; $("scrim").hidden = true; document.body.style.overflow = "";
    if (document.body.classList.contains("docked")) { document.body.classList.remove("docked"); window.dispatchEvent(new Event("resize")); }
    if (SEL) { SEL = ""; if (D) renderTable(); }
    history.replaceState(null, "", VIEW === "watch" ? "#watchlist" : location.pathname + location.search);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // ---------------------------------------------------------------- views
  var VIEW = "matrix";
  function setView(v) {
    VIEW = v;
    $("view-matrix").hidden = v !== "matrix"; $("view-watch").hidden = v !== "watch";
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) {
      if (t.dataset.view === v) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current");
    });
    if (v === "watch" && window.Watch) window.Watch.show();
    if (v === "matrix" && D) renderActivity();
  }
  function route() {
    var h = decodeURIComponent(location.hash.slice(1));
    if (h === "watchlist" || h.indexOf("w/") === 0) {
      setView("watch");
      if (h.indexOf("w/") === 0 && window.Watch) window.Watch.open(h.slice(2)); else if ($("drawer").hidden === false) closeDrawer();
    } else {
      setView("matrix");
      if (BY[h]) openDrawer(h); else if (!$("drawer").hidden) closeDrawer();
    }
  }

  // ---------------------------------------------------------------- events
  function toggle(key, val) { S[key] = S[key] === val ? "" : val; renderAll(); }
  function bind() {
    var qt;
    $("q").addEventListener("input", function (e) { clearTimeout(qt); qt = setTimeout(function () { S.q = e.target.value.trim(); renderAll(); }, 120); });
    $("issue").addEventListener("change", function (e) { S.issue = e.target.value; renderAll(); });
    $("aligns").addEventListener("change", function (e) { S.aligns = e.target.value; renderAll(); });
    $("kind").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) { S.kind = b.dataset.v; renderAll(); } });
    $("chips").addEventListener("click", function (e) {
      var b = e.target.closest("[data-clear]"); if (!b) return;
      if (b.dataset.clear === "all") { S.q = S.kind = S.issue = S.aligns = S.stage = S.month = ""; S.flag = false; } else S[b.dataset.clear] = b.dataset.clear === "flag" ? false : "";
      renderAll();
    });
    $("kpis").addEventListener("click", function (e) {
      var b = e.target.closest(".kpi"); if (!b) return;
      var a = b.dataset.act;
      if (a === "review") { S.flag = !S.flag; renderAll(); }
      else if (a === "active") { S.sort = "activity"; S.dir = -1; renderAll(); $("tbl").scrollIntoView({ behavior: "smooth" }); }
      else if (a === "deadlines") $("deadlines").scrollIntoView({ behavior: "smooth", block: "center" });
      else if (a === "passed") { S.kind = "legislation"; S.sort = "stage"; S.dir = -1; renderAll(); $("tbl").scrollIntoView({ behavior: "smooth" }); }
      else if (a === "aligns") toggle("aligns", "Yes");
    });
    $("activity").addEventListener("click", function (e) { var g = e.target.closest("[data-month]"); if (g) { hideTip(); toggle("month", g.dataset.month); } });
    $("activity").addEventListener("keydown", function (e) { var g = e.target.closest("[data-month]"); if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle("month", g.dataset.month); } });
    bindTips($("activity"), activityTip);
    bindTips($("alignment"), alignTip);
    $("act-toggle").addEventListener("click", function () { S.actTable = !S.actTable; this.setAttribute("aria-pressed", String(S.actTable)); this.textContent = S.actTable ? "Chart" : "Table"; renderActivity(); });
    [$("pipeline"), $("regstatus")].forEach(function (el) {
      el.addEventListener("click", function (e) { var b = e.target.closest("[data-stage]"); if (b) toggle("stage", b.dataset.stage); });
    });
    $("alignment").addEventListener("click", function (e) { var b = e.target.closest("[data-issue]"); if (b && b.dataset.issue) toggle("issue", b.dataset.issue); });
    document.querySelector("#tbl thead").addEventListener("click", function (e) {
      var th = e.target.closest("th"); if (!th) return;
      if (S.sort === th.dataset.sort) S.dir = -S.dir; else { S.sort = th.dataset.sort; S.dir = th.dataset.sort === "name" ? 1 : -1; }
      renderTable();
    });
    document.addEventListener("click", function (e) {
      var o = e.target.closest("[data-open]"); if (o) { e.preventDefault(); openDrawer(o.dataset.open); return; }
      if (e.target.id === "dr-more") { Array.prototype.forEach.call(document.querySelectorAll("#dr-tl li[hidden]"), function (li) { li.hidden = false; }); e.target.remove(); }
      if (e.target.id === "dr-close" || e.target.id === "scrim") closeDrawer();
    });
    $("rows").addEventListener("keydown", function (e) { var r = e.target.closest("[data-open]"); if (r && e.key === "Enter") openDrawer(r.dataset.open); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDrawer();
      if (e.key === "/" && document.activeElement.tagName !== "INPUT" && $("drawer").hidden) { e.preventDefault(); $(VIEW === "watch" ? "wq" : "q").focus(); }
    });
    window.addEventListener("hashchange", route);
    var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(renderActivity, 120); });
    $("theme").addEventListener("click", function () {
      var dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.dataset.theme = dark ? "light" : "dark";
      try { localStorage.setItem("theme", document.documentElement.dataset.theme); } catch (err) { /* storage unavailable */ }
    });
  }

  // ---------------------------------------------------------------- data
  function setLive() {
    if (!D) return;
    $("live-text").textContent = "Official data updated " + relTime(D.generated_at);
    $("generated").textContent = "Last published " + new Date(D.generated_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) + ". This page checks for new data every 5 minutes.";
  }
  function relTime(s) {
    var m = Math.round((Date.now() - new Date(s).getTime()) / 6e4);
    if (m < 1) return "just now"; if (m < 60) return m + " min ago";
    var h = Math.round(m / 60); if (h < 24) return h + " hr ago";
    return rel(s.slice(0, 10));
  }
  function load(first) {
    return fetch("data.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (d) {
      if (!first && D && d.generated_at === D.generated_at) { setLive(); return; }
      D = d; ITEMS = d.items; BY = {}; ITEMS.forEach(function (i) { BY[i.id] = i; });
      if (d.title) document.title = d.title;
      var issues = {}; ITEMS.forEach(function (i) { i.issues.forEach(function (x) { issues[norm(x)] = 1; }); });
      $("issue").innerHTML = '<option value="">All issues</option>' + Object.keys(issues).sort().map(function (x) {
        return '<option value="' + esc(x) + '">' + esc(x) + "</option>";
      }).join("");
      renderAll(); setLive();
      $("tab-n-matrix").textContent = ITEMS.length;
      if (first) {
        bind(); route(); if (window.Edit) window.Edit.init(d.editing);
        if (!location.hash && matchMedia("(min-width: 1280px)").matches) {
          var top = document.querySelector("#rows tr[data-open]");
          if (top) { openDrawer(top.dataset.open); history.replaceState(null, "", location.pathname + location.search); var c = $("dr-close"); if (c) c.blur(); }
        }
      }
    });
  }
  window.SM = { esc: esc, fmt: fmt, rel: rel, days: days, showTip: showTip, hideTip: hideTip, bindTips: bindTips,
    showDrawer: showDrawer, closeDrawer: closeDrawer, ic: ic, nw: function (t) { return nw(t); },
    getItem: function (id) { return BY[id]; }, openItem: function (id) { openDrawer(id); },
    updateItem: function (id, fields, review) {
      var it = BY[id]; if (!it) return;
      Object.keys(fields).forEach(function (k) { it[k] = fields[k]; });
      if (review && review.last_reviewed) it.last_reviewed = review.last_reviewed;
      it._hay = null; renderAll(); openDrawer(id);
    }, niceStep: niceStep, topPath: topPath, monthLabel: monthLabel,
    inMatrix: function (id) { return BY[id]; } };
  try { var th = localStorage.getItem("theme"); if (th) document.documentElement.dataset.theme = th; } catch (err) { /* storage unavailable */ }
  load(true).catch(function () {
    $("rows").innerHTML = '<tr><td class="empty">Couldn’t load data.json. Run <code>python3 scripts/build.py &amp;&amp; python3 -m http.server -d site</code>.</td></tr>';
  });
  setInterval(function () { load(false).catch(function () {}); }, 5 * 60 * 1000);
  setInterval(setLive, 60 * 1000);
})();
