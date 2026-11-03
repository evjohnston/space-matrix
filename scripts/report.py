"""Write the human review report (used as the pull-request body and job summary).

Usage:  python scripts/report.py [--base origin/main] [--out build/REPORT.md]

"Pending" changes are changelog entries and candidates that are not yet on the
base branch, i.e. what merging this PR would publish.
"""
import datetime as dt
import json
import os
import re
import subprocess
import sys

from common import CANDIDATES, CHANGELOG, ROOT, load_config, load_items, read_json

RUN_ERRORS = os.path.join(ROOT, "build", "run_errors.json")
STOP = set("a an and the of for to in on act bill by with from or at as is be this that".split())


def at_base(ref, relpath):
    try:
        out = subprocess.run(["git", "show", "%s:%s" % (ref, relpath)], cwd=ROOT,
                             capture_output=True, text=True, check=True).stdout
        return json.loads(out)
    except Exception:
        return None


def words(s):
    return {w for w in re.findall(r"[a-z0-9]+", s.lower()) if w not in STOP and len(w) > 2}


def latest_official(item):
    best = ("", "")
    for snap in item.get("auto", {}).values():
        # FR document publication trails signing by days; only bill actions and new docket docs count.
        d = snap.get("latest_action_date") or snap.get("latest_date") or ""
        if d > best[0]:
            best = (d, snap.get("label", ""))
    return best


def flags_for(item, today):
    out = []
    status = item.get("status", "").lower()
    off_date, off_label = latest_official(item)
    if off_date and item.get("status_date") and off_date > item["status_date"]:
        out.append("Official record has activity on %s (%s) newer than the curated status date %s."
                   % (off_date, off_label, item["status_date"]))
    for key, snap in item.get("auto", {}).items():
        if key.startswith("congress:"):
            name_w = words(item["name"])
            title_w = words(snap.get("title", ""))
            if name_w and title_w and len(name_w & title_w) / float(min(len(name_w), len(title_w))) < 0.34:
                out.append("%s is titled “%s” — doesn’t look like “%s”. Wrong bill number or link?"
                           % (snap.get("label"), snap.get("title"), item["name"]))
            if snap.get("law") and "law" not in status:
                out.append("%s became law (%s) but the curated status doesn’t say so." % (snap.get("label"), snap["law"]))
        if snap.get("comments_close") and snap["comments_close"] < today and re.search(r"comment|review period|open", status):
            out.append("Comment period closed %s, but status still reads “%s”." % (snap["comments_close"], item["status"]))
        if key.startswith("fr_docket:") and snap.get("latest_type") == "Rule" and "final" not in status and "effective" not in status:
            out.append("Docket %s now has a final rule (%s) — status may need updating." % (key.split(":")[1], snap.get("latest_date")))
    return out


def main():
    base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "origin/main"
    out_path = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else os.path.join(ROOT, "build", "REPORT.md")
    cfg = load_config()
    today = dt.date.today().isoformat()
    stale_days = cfg.get("stale_after_days", 90)

    items = load_items()
    changelog = read_json(CHANGELOG, [])
    base_log = at_base(base, "data/changelog.json")
    base_ids = {e["id"] for e in base_log} if base_log is not None else set()
    pending = [e for e in changelog if e["id"] not in base_ids]

    cands = read_json(CANDIDATES, {"candidates": []})["candidates"]
    base_c = at_base(base, "data/candidates.json")
    base_ckeys = {c["key"] for c in base_c["candidates"]} if base_c else set()
    new_cands = [c for c in cands if c["key"] not in base_ckeys]

    errors = read_json(RUN_ERRORS, [])
    by_id = {i["id"]: i for i in items}
    L = []
    L.append("## Tracker review — %s\n" % today)
    L.append("**%d official update(s)** · **%d new candidate bill(s)** · %d source error(s)\n"
             % (len(pending), len(new_cands), len(errors)))
    L.append("> Merging this PR publishes the official updates below. Curated fields (status, analysis, alignment) are "
             "never changed by the bot — edit them on this branch if an update warrants it, then merge.\n")

    if pending:
        L.append("### Official updates\n")
        grouped = {}
        for e in pending:
            grouped.setdefault(e["item_id"], []).append(e)
        for iid, es in grouped.items():
            item = by_id.get(iid, {"name": es[0]["item_name"], "status": "", "status_date": ""})
            L.append("- [ ] **%s** (`data/items/%s.json`)" % (item["name"], iid))
            for e in es:
                d = (" — %s" % e["event_date"]) if e.get("event_date") else ""
                L.append("  - %s%s%s" % (e["summary"], d, (" · [source](%s)" % e["url"]) if e.get("url") else ""))
            L.append("  - Curated status: _%s_ (%s)" % (item.get("status") or "—", item.get("status_date") or "no date"))
        L.append("")

    flagged = [(i, flags_for(i, today)) for i in items]
    flagged = [(i, f) for i, f in flagged if f]
    if flagged:
        L.append("### Consistency checks\n")
        for i, fs in flagged:
            L.append("- **%s** (`%s`)" % (i["name"], i["id"]))
            for f in fs:
                L.append("  - %s" % f)
        L.append("")

    manual = [i for i in items if not i.get("tracking")]
    cutoff = (dt.date.today() - dt.timedelta(days=stale_days)).isoformat()
    stale = [i for i in manual if (i.get("review", {}).get("last_reviewed") or "") < cutoff]
    if stale:
        L.append("### Manual items due for review (no API source, not reviewed in %d days)\n" % stale_days)
        for i in stale:
            L.append("- [ ] **%s** — last reviewed %s · %s" % (
                i["name"], i.get("review", {}).get("last_reviewed") or "never", (i.get("links") or [""])[0]))
        L.append("\nAfter checking: `python scripts/triage.py reviewed <item-id>`\n")

    if new_cands:
        L.append("### New space-related bills to triage\n")
        for c in new_cands:
            L.append("- [ ] `%s` [%s](%s) — matched “%s” · latest: %s %s" % (
                c["key"], c["title"], c["url"], c["matched"], c["latest_action_date"], c["latest_action_text"]))
        L.append("\nAdd one: `python scripts/triage.py promote <key> --issue \"...\"` · "
                 "Ignore: `python scripts/triage.py dismiss <key>`\n")

    if errors:
        L.append("### Source errors (will retry next run)\n")
        for e in errors:
            L.append("- %s · `%s` · %s" % (e.get("item"), e.get("source"), e.get("error")))
        L.append("")

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(L))
    print("Report: %s (%d updates, %d flags, %d stale, %d candidates, %d errors)"
          % (out_path, len(pending), len(flagged), len(stale), len(new_cands), len(errors)))


if __name__ == "__main__":
    main()
