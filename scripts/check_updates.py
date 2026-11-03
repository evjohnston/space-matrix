"""Poll official sources for every tracked item and record what changed.

Usage:  python scripts/check_updates.py

Only the machine-maintained `auto` block of each item is written. Curated
fields (status, analysis, alignment) are never touched; when an official
source moves, a changelog entry is added and the review report asks a human
to look at the curated text.
"""
import hashlib
import json
import os
import sys

from common import (CHANGELOG, ROOT, congress_api_key, http_json, load_items, now_iso,
                    read_json, save_item, write_json)
from import_matrix import tracker_key

RUN_ERRORS = os.path.join(ROOT, "build", "run_errors.json")
FR = "https://www.federalregister.gov/api/v1"
FR_FIELDS = ["document_number", "title", "type", "action", "publication_date",
             "comments_close_on", "effective_on", "html_url"]


def fetch_congress(t):
    url = "https://api.congress.gov/v3/bill/%s/%s/%s" % (t["congress"], t["bill_type"], t["number"])
    b = http_json(url, {"api_key": congress_api_key(), "format": "json"})["bill"]
    la = b.get("latestAction") or {}
    laws = b.get("laws") or []
    sponsors = b.get("sponsors") or []
    params = {"api_key": congress_api_key(), "format": "json", "limit": 250}
    acts = http_json(url + "/actions", params).get("actions") or []
    actions, lib_codes = [], set()
    for a in acts:
        src = (a.get("sourceSystem") or {}).get("name", "")
        if src == "Library of Congress":  # milestone codes; text duplicates chamber entries
            if a.get("actionCode"):
                lib_codes.add(str(a["actionCode"]))
            continue
        actions.append({"date": a.get("actionDate", ""), "type": a.get("type", ""), "chamber": src.replace(" floor actions", ""),
                        "text": (a.get("text") or "").strip()})
    try:
        committees = [c.get("name", "") for c in http_json(url + "/committees", params).get("committees") or []]
    except Exception:
        committees = []
    return {
        "label": "%s %s (%sth Congress)" % (b.get("type", t["bill_type"].upper()), b.get("number"), b.get("congress")),
        "title": b.get("title", ""),
        "introduced": b.get("introducedDate", ""),
        "latest_action_date": la.get("actionDate", ""),
        "latest_action_text": (la.get("text") or "").strip(),
        "cosponsors": (b.get("cosponsors") or {}).get("count", 0),
        "sponsor": sponsors[0].get("fullName", "") if sponsors else "",
        "law": ", ".join("%s %s" % (l.get("type", "Law"), l.get("number", "")) for l in laws),
        "policy_area": (b.get("policyArea") or {}).get("name", ""),
        "committees": committees,
        "milestones": sorted(lib_codes),
        "actions": actions,
        "url": b.get("legislationUrl") or "https://www.congress.gov/bill/%sth-congress/%s/%s" % (
            t["congress"], "senate-bill" if t["bill_type"] == "s" else "house-bill", t["number"]),
    }


def fetch_fr_document(t):
    d = http_json("%s/documents/%s.json" % (FR, t["document"]), {"fields[]": FR_FIELDS})
    return {
        "label": "Federal Register %s" % t["document"],
        "title": d.get("title", ""),
        "type": d.get("type", ""),
        "action": (d.get("action") or "").strip(),
        "published": d.get("publication_date") or "",
        "comments_close": d.get("comments_close_on") or "",
        "effective": d.get("effective_on") or "",
        "url": d.get("html_url", ""),
    }


def fetch_fr_docket(t):
    d = http_json("%s/documents.json" % FR, {
        "conditions[docket_id]": t["docket"], "order": "newest", "per_page": 50, "fields[]": FR_FIELDS})
    docs = d.get("results") or []
    latest = docs[0] if docs else {}
    return {
        "label": "Docket %s" % t["docket"],
        "documents": [x["document_number"] for x in docs],
        "latest_type": latest.get("type", ""),
        "latest_action": (latest.get("action") or "").strip(),
        "latest_date": latest.get("publication_date", ""),
        "latest_title": latest.get("title", ""),
        "url": latest.get("html_url") or "https://www.federalregister.gov/documents/search?conditions%%5Bdocket_id%%5D=%s" % t["docket"],
        "_docs": {x["document_number"]: x for x in docs},
    }


FETCHERS = {"congress": fetch_congress, "fr_document": fetch_fr_document, "fr_docket": fetch_fr_docket}

# field -> human label; only these fields generate changelog entries
WATCHED = {
    "congress": {"latest_action_text": "Latest action", "cosponsors": "Cosponsors", "law": "Became law", "title": "Title"},
    "fr_document": {"comments_close": "Comment deadline", "effective": "Effective date", "title": "Title"},
    "fr_docket": {},  # handled specially: new documents in the docket
}


def entry(item, key, summary, field, old, new, url, date):
    raw = json.dumps([item["id"], key, field, old, new], sort_keys=True)
    return {"id": hashlib.sha1(raw.encode()).hexdigest()[:12], "item_id": item["id"], "item_name": item["name"],
            "source": key, "field": field, "old": old, "new": new, "summary": summary,
            "event_date": date, "detected": now_iso(), "url": url}


def diff(item, t, key, old, new):
    out = []
    label = new.get("label", key)
    if t["type"] == "fr_docket":
        prev = set(old.get("documents", []))
        for num in new["documents"]:
            if num not in prev:
                d = new["_docs"][num]
                out.append(entry(item, key, "%s: new %s published — %s" % (label, d.get("type", "document").lower(), d.get("title", "")),
                                 "documents", "", num, d.get("html_url", ""), d.get("publication_date", "")))
        return out
    for field, human in WATCHED[t["type"]].items():
        if old.get(field) != new.get(field) and (old.get(field) or new.get(field)):
            if field == "latest_action_text":
                summary = "%s: %s" % (label, new[field])
                date = new.get("latest_action_date", "")
            else:
                summary = "%s: %s changed from “%s” to “%s”" % (label, human.lower(), old.get(field) or "—", new.get(field) or "—")
                date = ""
            out.append(entry(item, key, summary, field, old.get(field), new.get(field), new.get("url", ""), date))
    return out


def main():
    items = load_items()
    changelog = read_json(CHANGELOG, [])
    known = {e["id"] for e in changelog}
    new_entries, errors, checked = [], [], 0
    rate_limited = set()  # source types that returned 429 after retries; skip the rest this run

    for item in items:
        changed = False
        for t in item.get("tracking", []):
            key = tracker_key(t)
            fetch = FETCHERS.get(t["type"])
            if not fetch:
                continue
            if t["type"] in rate_limited:
                errors.append({"item": item["name"], "source": key, "error": "skipped: API rate limit reached this run"})
                continue
            try:
                snap = fetch(t)
            except Exception as e:  # keep going; report the failure
                if getattr(e, "code", None) == 429:
                    rate_limited.add(t["type"])
                errors.append({"item": item["name"], "source": key, "error": "%s: %s" % (type(e).__name__, e)})
                print("  ! %s %s: %s" % (item["id"], key, e), file=sys.stderr)
                continue
            checked += 1
            old = item["auto"].get(key)
            if old is not None:  # first sighting is the baseline, not a change
                for e in diff(item, t, key, old, snap):
                    if e["id"] not in known:
                        known.add(e["id"])
                        new_entries.append(e)
            snap.pop("_docs", None)
            if old != snap:
                item["auto"][key] = snap
                changed = True
        if changed:
            save_item(item)

    changelog = new_entries + changelog
    write_json(CHANGELOG, changelog)
    os.makedirs(os.path.dirname(RUN_ERRORS), exist_ok=True)
    prior = read_json(RUN_ERRORS, [])
    write_json(RUN_ERRORS, [e for e in prior if e.get("stage") != "check"] + [dict(e, stage="check") for e in errors])
    print("Checked %d sources: %d changes, %d errors." % (checked, len(new_entries), len(errors)))


if __name__ == "__main__":
    main()
