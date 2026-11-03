"""Find newly active space-related bills on Congress.gov that aren't in the matrix yet.

Usage:  python scripts/discover.py [--days N]

Scans bills updated in the last N days (config `discovery.lookback_days`),
keeps those whose titles match the keyword patterns in data/config.json, and
adds unseen ones to data/candidates.json for a human to promote or dismiss
(see scripts/triage.py). Nothing here is published to the site.
"""
import csv
import datetime as dt
import os
import re
import sys

from common import (CANDIDATES, DATA, ROOT, congress_api_key, http_json, load_config, load_items,
                    now_iso, read_json, write_json)
from import_matrix import tracker_key

RUN_ERRORS = os.path.join(ROOT, "build", "run_errors.json")


def bill_key(congress, btype, number):
    return "%s-%s-%s" % (congress, btype.lower(), number)


def seed_seen():
    """Bills already in the historical scrape count as seen, so only new activity surfaces."""
    seen = set()
    path = os.path.join(DATA, "source", "space_bills.csv")
    if os.path.exists(path):
        with open(path, encoding="utf-8-sig", newline="") as f:
            for r in csv.DictReader(f):
                if r.get("congress") and r.get("1q") and r.get("bill_number"):
                    seen.add(bill_key(r["congress"], r["1q"], r["bill_number"]))
    return seen


def main():
    cfg = load_config().get("discovery", {})
    days = int(sys.argv[sys.argv.index("--days") + 1]) if "--days" in sys.argv else cfg.get("lookback_days", 3)
    include = re.compile(cfg.get("include_pattern", r"\bspace\b"), re.I)
    exclude = re.compile(cfg["exclude_pattern"], re.I) if cfg.get("exclude_pattern") else None
    max_pages = cfg.get("max_pages", 40)

    state = read_json(CANDIDATES, None)
    if state is None:
        state = {"seen": sorted(seed_seen()), "candidates": []}
    seen = set(state["seen"])
    tracked = {tracker_key(t).split(":", 1)[1] for i in load_items() for t in i.get("tracking", [])
               if t["type"] == "congress"}

    since = (dt.datetime.utcnow() - dt.timedelta(days=days)).strftime("%Y-%m-%dT00:00:00Z")
    found, errors, offset, pages = [], [], 0, 0
    while pages < max_pages:
        try:
            data = http_json("https://api.congress.gov/v3/bill", {
                "api_key": congress_api_key(), "format": "json", "fromDateTime": since,
                "sort": "updateDate desc", "limit": 250, "offset": offset})
        except Exception as e:
            errors.append({"stage": "discover", "item": "(discovery)", "source": "congress.gov bill list",
                           "error": "%s: %s" % (type(e).__name__, e)})
            break
        bills = data.get("bills") or []
        for b in bills:
            title = b.get("title") or ""
            m = include.search(title)
            if not m or (exclude and exclude.search(title) and not re.search(r"outer space|spacecraft|satellite|NASA|orbit", title, re.I)):
                continue
            key = bill_key(b["congress"], b["type"], b["number"])
            if key in seen or key in tracked:
                continue
            seen.add(key)
            la = b.get("latestAction") or {}
            found.append({
                "key": key, "congress": b["congress"], "bill_type": b["type"].lower(), "number": b["number"],
                "title": title, "matched": m.group(0), "introduced": b.get("introducedDate", ""),
                "latest_action_date": la.get("actionDate", ""), "latest_action_text": la.get("text", ""),
                "url": "https://www.congress.gov/bill/%sth-congress/%s/%s" % (
                    b["congress"], {"hr": "house-bill", "s": "senate-bill"}.get(b["type"].lower(), b["type"].lower()), b["number"]),
                "found": now_iso(),
            })
        pages += 1
        if len(bills) < 250:
            break
        offset += 250

    state["candidates"] = found + state["candidates"]
    state["seen"] = sorted(seen)
    write_json(CANDIDATES, state)

    os.makedirs(os.path.dirname(RUN_ERRORS), exist_ok=True)
    prior = read_json(RUN_ERRORS, [])
    write_json(RUN_ERRORS, [e for e in prior if e.get("stage") != "discover"] + errors)
    print("Scanned %d page(s) since %s: %d new candidate(s), %d awaiting triage."
          % (pages, since[:10], len(found), len(state["candidates"])))


if __name__ == "__main__":
    main()
