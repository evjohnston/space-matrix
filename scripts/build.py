"""Compile data/items + changelog into site/data.json for the static site.

Derives, per item: pipeline stage, per-bill facts, a merged official timeline,
and comment deadlines. Usage:  python scripts/build.py
"""
import datetime as dt
import os
import re

from common import CHANGELOG, ROOT, load_config, load_items, now_iso, read_json, write_json

CURRENT_CONGRESS = 119
LEG_STEPS = ["Introduced", "In committee", "Reported", "Passed one chamber", "Passed both", "To President", "Law"]
REG_STEPS = ["Proposed", "Comments open", "Comments closed", "Final / in effect"]
EXEC_STEPS = ["Issued", "In effect"]


def bill_stage(s):
    codes = set(s.get("milestones") or [])
    acts = s.get("actions") or []
    text = " ".join(a["text"] for a in acts)
    types = {a["type"] for a in acts}
    house = "8000" in codes or re.search(r"Passed House|Received in the Senate", text)
    senate = "17000" in codes or re.search(r"Passed Senate|Received in the House", text)
    if s.get("law") or "36000" in codes or "BecameLaw" in types:
        return 6
    if "28000" in codes or "President" in types:
        return 5
    if house and senate:
        return 4
    if house or senate:
        return 3
    if codes & {"5000", "14000"} or "Calendars" in types or re.search(r"Reported|Ordered to be reported|Calendar", text):
        return 2
    if "Committee" in types or re.search(r"[Rr]eferred to", text):
        return 1
    return 0


def item_stage(item):
    auto = item.get("auto", {})
    status = item.get("status", "").lower()
    bills = [(k, s) for k, s in auto.items() if k.startswith("congress:")]
    if item.get("kind") == "legislation":
        if not bills:
            return {"track": "legislation", "step": 0, "steps": LEG_STEPS, "label": item.get("status") or "Unknown", "expired": False}
        step = max(bill_stage(s) for _, s in bills)
        congresses = [int(k.split(":")[1].split("-")[0]) for k, _ in bills]
        expired = step < 6 and max(congresses) < CURRENT_CONGRESS
        label = ("Died in %sth Congress" % max(congresses)) if expired else LEG_STEPS[step]
        return {"track": "legislation", "step": step, "steps": LEG_STEPS, "label": label, "expired": expired}
    if item.get("kind") == "regulatory":
        today = dt.date.today().isoformat()
        types = {s.get("type") for s in auto.values()} | {s.get("latest_type") for s in auto.values()}
        closes = [s["comments_close"] for s in auto.values() if s.get("comments_close")]
        if "withdraw" in status:
            return {"track": "regulatory", "step": 2, "steps": REG_STEPS, "label": "Withdrawn", "expired": True}
        if "Rule" in types or ("effective" in status and "proposed" not in status):
            return {"track": "regulatory", "step": 3, "steps": REG_STEPS, "label": "Final / in effect", "expired": False}
        if closes:
            open_ = max(closes) >= today
            return {"track": "regulatory", "step": 1 if open_ else 2, "steps": REG_STEPS,
                    "label": "Comments open" if open_ else "Comments closed", "expired": False}
        return {"track": "regulatory", "step": 0, "steps": REG_STEPS, "label": "Proposed", "expired": False}
    effective = "effective" in status
    return {"track": "executive", "step": 1 if effective else 0, "steps": EXEC_STEPS,
            "label": "In effect" if effective else ("Pending" if "pending" in status else "Issued"), "expired": False}


def timeline(item):
    ev = []
    for k, s in item.get("auto", {}).items():
        if k.startswith("congress:"):
            for a in s.get("actions") or []:
                ev.append({"date": a["date"], "text": a["text"], "source": s.get("label", k), "kind": a["type"], "chamber": a.get("chamber", ""), "url": s.get("url", "")})
        elif k.startswith("fr_document:"):
            if s.get("published"):
                ev.append({"date": s["published"], "text": "%s published%s" % (s.get("type", "Document"), (" — " + s["action"].rstrip(".")) if s.get("action") and "proposed rulemaking" not in s["action"].lower() else (" (NPRM)" if "proposed rulemaking" in (s.get("action") or "").lower() else "")),
                           "source": s.get("label", k), "kind": "FederalRegister", "url": s.get("url", "")})
            if s.get("comments_close"):
                ev.append({"date": s["comments_close"], "text": "Comment period closes", "source": s.get("label", k), "kind": "Deadline", "url": s.get("url", "")})
            if s.get("effective"):
                ev.append({"date": s["effective"], "text": "Takes effect", "source": s.get("label", k), "kind": "Effective", "url": s.get("url", "")})
    # de-dupe same-day identical text (chamber + LoC echoes)
    seen, out = set(), []
    for e in sorted(ev, key=lambda e: e["date"], reverse=True):
        key = (e["date"], e["text"][:60])
        if key not in seen:
            seen.add(key)
            out.append(e)
    return out


def bill_facts(item):
    out = []
    for k, s in item.get("auto", {}).items():
        if k.startswith("congress:"):
            out.append({"key": k, "label": s.get("label", ""), "title": s.get("title", ""), "sponsor": s.get("sponsor", ""),
                        "cosponsors": s.get("cosponsors", 0), "committees": s.get("committees", []),
                        "policy_area": s.get("policy_area", ""), "introduced": s.get("introduced", ""),
                        "latest_date": s.get("latest_action_date", ""), "latest_text": s.get("latest_action_text", ""),
                        "law": s.get("law", ""), "url": s.get("url", ""), "stage": bill_stage(s), "actions": len(s.get("actions") or [])})
    return out


def documents(item):
    out = []
    for k, s in item.get("auto", {}).items():
        if k.startswith("fr_document:"):
            out.append({"key": k, "label": s.get("label", ""), "title": s.get("title", ""), "type": s.get("type", ""),
                        "action": s.get("action", ""), "published": s.get("published", ""),
                        "comments_close": s.get("comments_close", ""), "effective": s.get("effective", ""), "url": s.get("url", "")})
        elif k.startswith("fr_docket:"):
            out.append({"key": k, "label": s.get("label", ""), "title": s.get("latest_title", ""), "type": "Docket",
                        "action": "%d document(s); latest: %s" % (len(s.get("documents", [])), s.get("latest_type", "")),
                        "published": s.get("latest_date", ""), "comments_close": "", "effective": "", "url": s.get("url", "")})
    return out


def main():
    cfg = load_config()
    changelog = read_json(CHANGELOG, [])
    today = dt.date.today().isoformat()
    out_items = []
    for it in load_items():
        tl = [e for e in timeline(it) if e["date"] <= today]
        upcoming = [e for e in timeline(it) if e["date"] > today]
        latest = tl[0] if tl else None
        closes = [s["comments_close"] for s in it.get("auto", {}).values() if s.get("comments_close")]
        bills = bill_facts(it)
        out_items.append({
            "id": it["id"], "name": it["name"], "number": it.get("number", ""), "kind": it.get("kind", ""),
            "entity": it.get("entity", ""), "issues": it.get("issues", []), "status": it.get("status", ""),
            "status_date": it.get("status_date", ""), "aligns": it.get("aligns") or "Unassessed",
            "effect": it.get("effect", ""), "alignment_notes": it.get("alignment_notes", ""),
            "gridlock": it.get("gridlock", ""), "sponsors": it.get("sponsors", ""), "links": it.get("links", []),
            "tracked": bool(it.get("tracking")), "stage": item_stage(it), "bills": bills, "documents": documents(it),
            "cosponsors": max([b["cosponsors"] for b in bills] or [0]),
            "latest": latest, "timeline": tl, "upcoming": upcoming,
            "comments_close": max(closes) if closes else "",
            "activity_date": max(filter(None, [it.get("status_date", ""), (latest or {}).get("date", "")]), default=""),
            "last_reviewed": it.get("review", {}).get("last_reviewed", ""),
            "last_editor": it.get("review", {}).get("last_editor", ""),
        })
    out_items.sort(key=lambda i: i["activity_date"], reverse=True)
    os.makedirs(os.path.join(ROOT, "site"), exist_ok=True)
    write_json(os.path.join(ROOT, "site", "data.json"), {
        "title": cfg.get("site_title", "Legislation Tracker"),
        "generated_at": now_iso(),
        "current_congress": CURRENT_CONGRESS,
        "editing": cfg.get("editing", {}),
        "items": out_items,
        "changes": changelog[:150],
    })
    wl = read_json(os.path.join(ROOT, "data", "watchlist.json"), {"entries": {}})["entries"]
    keep = ("key", "source", "label", "title", "introduced", "latest_date", "latest_text", "sponsor", "party", "cosponsors",
            "policy_area", "subjects", "committees", "agencies", "comments_close", "dockets", "law", "url", "score",
            "tier", "reasons", "first_seen", "status", "in_matrix", "congress")
    entries = []
    for e in wl.values():
        out = {k: e[k] for k in keep if k in e and (e[k] not in (None, "", [], 0) or k in ("score", "cosponsors", "reasons"))}
        out["summary"] = (e.get("summary") or "")[:700]
        entries.append(out)
    entries.sort(key=lambda e: (-e["score"], e.get("latest_date", "")), reverse=False)
    write_json(os.path.join(ROOT, "site", "watchlist.json"), {"generated_at": now_iso(), "entries": entries})
    print("Built site/watchlist.json with %d entries." % len(entries))
    print("Built site/data.json with %d items, %d timeline events, %d changes." % (
        len(out_items), sum(len(i["timeline"]) for i in out_items), min(len(changelog), 150)))


if __name__ == "__main__":
    main()
