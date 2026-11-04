"""Find and score space-related bills and Federal Register documents -> data/watchlist.json.

Usage:
  python scripts/discover.py              # routine: anything updated in the last N days
  python scripts/discover.py --backfill   # one-time: every bill since the 106th Congress + 12 months of FR (resumable)
  python scripts/discover.py --backfill --congress 112   # just one Congress
  python scripts/discover.py --rescore    # re-apply relevance.py to stored entries (no API calls)

Sources:
  * Congress.gov bills updated in the window (new bills AND new actions on old ones)
  * Bills referred to the space committees/subcommittees, whatever their title
  * Federal Register full-text searches for space terms (proposed rules, rules, notices)

Every candidate is enriched (subjects, policy area, CRS summary, committees) and
scored by scripts/relevance.py. Low scores are kept and labelled "Likely noise"
so the false-positive rate is visible. Watchlist entries already on the
watchlist get their status refreshed whenever Congress.gov reports an update.
"""
import datetime as dt
import html
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor

from common import DATA, ROOT, congress_api_key, http_json, load_config, load_items, read_json, today, write_json
from import_matrix import tracker_key
import relevance

WATCHLIST = os.path.join(DATA, "watchlist.json")
RUN_ERRORS = os.path.join(ROOT, "build", "run_errors.json")
API = "https://api.congress.gov/v3"
FR = "https://www.federalregister.gov/api/v1/documents.json"
LABEL = {"hr": "H.R.", "s": "S.", "hres": "H.Res.", "sres": "S.Res.", "hjres": "H.J.Res.", "sjres": "S.J.Res.",
         "hconres": "H.Con.Res.", "sconres": "S.Con.Res."}
URLTYPE = {"hr": "house-bill", "s": "senate-bill", "hres": "house-resolution", "sres": "senate-resolution",
           "hjres": "house-joint-resolution", "sjres": "senate-joint-resolution",
           "hconres": "house-concurrent-resolution", "sconres": "senate-concurrent-resolution"}
FR_TERMS = ['"commercial space"', '"outer space"', '"orbital debris"', "spacecraft", "satellite", '"launch vehicle"',
            '"space situational awareness"', '"space traffic"', "reentry", '"Office of Space Commerce"', "NASA", "cislunar"]
FR_FIELDS = ["document_number", "title", "type", "abstract", "agencies", "publication_date", "comments_close_on",
             "docket_ids", "html_url", "action"]


def P():
    return {"api_key": congress_api_key(), "format": "json"}


def strip_html(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()


def bill_key(congress, btype, number):
    return "%s-%s-%s" % (congress, btype.lower(), number)


# ------------------------------------------------------------------ Congress
def list_bills(congress, since=None, max_pages=400):
    """Yield bill stubs. With `since`, only bills updated after it (any Congress)."""
    url = API + "/bill" + ("" if since else "/%s" % congress)
    offset = 0
    for _ in range(max_pages):
        params = dict(P(), limit=250, offset=offset)
        if since:
            params.update(fromDateTime=since, sort="updateDate desc")
        bills = http_json(url, params).get("bills") or []
        for b in bills:
            yield b
        if len(bills) < 250:
            return
        offset += 250


def committee_bills(chamber, code, congresses, since=None):
    offset, out = 0, []
    while True:
        params = dict(P(), limit=250, offset=offset)
        if since:
            params["fromDateTime"] = since
        d = http_json("%s/committee/%s/%s/bills" % (API, chamber, code), params).get("committee-bills") or {}
        bills = d.get("bills") or []
        out += [b for b in bills if int(b.get("congress", 0)) in congresses]
        if len(bills) < 250:
            return out
        offset += 250


def enrich_bill(congress, btype, number):
    base = "%s/bill/%s/%s/%s" % (API, congress, btype, number)
    b = http_json(base, P())["bill"]
    subj = http_json(base + "/subjects", P()).get("subjects") or {}
    sums = http_json(base + "/summaries", P()).get("summaries") or []
    comms = http_json(base + "/committees", P()).get("committees") or []
    codes, names = [], []
    for c in comms:
        codes.append(c.get("systemCode", ""))
        names.append(c.get("name", ""))
        for s in c.get("subcommittees") or []:
            codes.append(s.get("systemCode", ""))
            names.append(s.get("name", ""))
    la = b.get("latestAction") or {}
    sp = (b.get("sponsors") or [{}])[0]
    summary = strip_html(sums[-1]["text"]) if sums else ""
    subjects = [x["name"] for x in subj.get("legislativeSubjects") or []]
    policy = (subj.get("policyArea") or b.get("policyArea") or {}).get("name", "")
    title = b.get("title", "")
    sc = relevance.score(title=title, summary=summary, subjects=subjects, policy_area=policy, committees=codes)
    return {
        "key": bill_key(congress, btype, number), "source": "congress", "congress": int(congress), "bill_type": btype,
        "number": str(number), "label": "%s %s" % (LABEL.get(btype, btype.upper()), number), "title": title,
        "introduced": b.get("introducedDate", ""), "latest_date": la.get("actionDate", ""),
        "latest_text": (la.get("text") or "").strip(), "sponsor": sp.get("fullName", ""), "party": sp.get("party", ""),
        "cosponsors": (b.get("cosponsors") or {}).get("count", 0), "policy_area": policy, "subjects": subjects,
        "committees": [n for n in names if n], "committee_codes": [c for c in codes if c], "summary": summary[:1500],
        "law": ", ".join("%s %s" % (l.get("type", ""), l.get("number", "")) for l in b.get("laws") or []),
        "url": "https://www.congress.gov/bill/%sth-congress/%s/%s" % (congress, URLTYPE.get(btype, btype), number),
        "score": sc["score"], "tier": sc["tier"], "reasons": sc["reasons"],
    }


# ------------------------------------------------------------------ Federal Register
def fr_search(since):
    found = {}
    for term in FR_TERMS:
        page = 1
        while page <= 10:
            d = http_json(FR, {"conditions[term]": term, "conditions[publication_date][gte]": since,
                               "conditions[type][]": ["RULE", "PRORULE", "NOTICE", "PRESDOCU"],
                               "per_page": 100, "page": page, "order": "newest", "fields[]": FR_FIELDS})
            for r in d.get("results") or []:
                found[r["document_number"]] = r
            if page >= (d.get("total_pages") or 1):
                break
            page += 1
    return found


def fr_entry(r):
    agencies = [a.get("name", "") for a in r.get("agencies") or [] if a.get("name")]
    sc = relevance.score(title=r.get("title", ""), summary=r.get("abstract") or "", agencies=agencies, doc_type=r.get("type", ""))
    return {
        "key": "fr-" + r["document_number"], "source": "federal_register", "document": r["document_number"],
        "label": r.get("type", "Document"), "title": r.get("title", ""), "agencies": agencies,
        "summary": (r.get("abstract") or "")[:1500], "latest_date": r.get("publication_date", ""),
        "latest_text": (r.get("action") or "").strip(), "comments_close": r.get("comments_close_on") or "",
        "dockets": r.get("docket_ids") or [], "url": r.get("html_url", ""),
        "score": sc["score"], "tier": sc["tier"], "reasons": sc["reasons"],
    }


# ------------------------------------------------------------------ main
def rescore(entries):
    """Recompute scores from stored fields (no API calls) after tuning relevance.py."""
    for e in entries.values():
        if e["source"] == "congress":
            codes = e.get("committee_codes") or [relevance.NAME2CODE[n] for n in e.get("committees", []) if n in relevance.NAME2CODE]
            sc = relevance.score(title=e["title"], summary=e.get("summary", ""), subjects=e.get("subjects", []),
                                 policy_area=e.get("policy_area", ""), committees=codes)
        else:
            sc = relevance.score(title=e["title"], summary=e.get("summary", ""), agencies=e.get("agencies", []), doc_type=e.get("label", ""))
        e.update(score=sc["score"], tier=sc["tier"], reasons=sc["reasons"])


def main():
    if "--rescore" in sys.argv:
        wl = read_json(WATCHLIST, {"entries": {}})
        rescore(wl["entries"])
        write_json(WATCHLIST, wl)
        t = {}
        for e in wl["entries"].values():
            t[e["tier"]] = t.get(e["tier"], 0) + 1
        print("Rescored %d entries: %s" % (len(wl["entries"]), ", ".join("%s %d" % kv for kv in sorted(t.items()))))
        return
    cfg = load_config().get("discovery", {})
    current = cfg.get("congress", 119)
    first = cfg.get("first_congress", 106)
    backfill = "--backfill" in sys.argv
    only = int(sys.argv[sys.argv.index("--congress") + 1]) if "--congress" in sys.argv else None
    congresses = [only] if only else (list(range(first, current + 1)) if backfill else [current])
    days = int(sys.argv[sys.argv.index("--days") + 1]) if "--days" in sys.argv else cfg.get("lookback_days", 3)
    since_dt = dt.datetime.utcnow() - dt.timedelta(days=365 if backfill else days)
    since = since_dt.strftime("%Y-%m-%dT00:00:00Z")

    wl = read_json(WATCHLIST, {"entries": {}})
    entries = wl["entries"]
    errors, stats = [], {"scanned": 0, "prefiltered": 0, "committee": 0, "enriched": 0, "fr_found": 0, "skipped": 0}

    def want(key, congress):
        """Past-Congress bills don't change; on a resumed backfill, skip ones already scored."""
        if backfill and congress < current and key in entries:
            stats["skipped"] += 1
            return False
        return True

    # 1. candidate bills: title pre-filter over every bill listed
    todo = {}
    for c in (congresses if backfill else [None]):
        try:
            for b in list_bills(c, None if backfill else since):
                bc = int(b.get("congress", 0))
                if bc < first or bc > current:
                    continue
                stats["scanned"] += 1
                key = bill_key(bc, b["type"], b["number"])
                if (key in entries or relevance.PREFILTER.search(b.get("title") or "")) and want(key, bc):
                    todo[key] = (bc, b["type"].lower(), b["number"])
            if backfill:
                print("  listed %sth Congress (%d bills scanned so far, %d to score)" % (c, stats["scanned"], len(todo)), flush=True)
        except Exception as e:
            errors.append({"stage": "discover", "item": "(discovery)", "source": "congress.gov bill list %s" % (c or ""), "error": "%s: %s" % (type(e).__name__, e)})
    stats["prefiltered"] = len(todo)

    # 2. bills referred to space committees, whatever their title. Parent committees only for the
    #    current Congress (they handle many non-space bills); subcommittees for every Congress.
    cset = set(congresses)
    codes = relevance.SPACE_COMMITTEES if current in cset else relevance.SUBCOMMITTEES
    for code in codes:
        chamber = "house" if code.startswith("h") else "senate"
        allowed = cset if code in relevance.SUBCOMMITTEES else {current}
        try:
            for b in committee_bills(chamber, code, allowed, None if backfill else since):
                bc = int(b["congress"])
                key = bill_key(bc, b["type"], b["number"])
                if key not in todo and want(key, bc):
                    stats["committee"] += 1
                    todo[key] = (bc, b["type"].lower(), b["number"])
        except Exception as e:
            errors.append({"stage": "discover", "item": "(discovery)", "source": "committee " + code, "error": "%s: %s" % (type(e).__name__, e)})

    # 3. enrich + score (saves progress so a long backfill can resume)
    def work(args):
        try:
            return enrich_bill(*args), None
        except Exception as e:
            return None, {"stage": "discover", "item": "(watchlist)", "source": bill_key(*args), "error": "%s: %s" % (type(e).__name__, e)}

    print("  scoring %d bills…" % len(todo), flush=True)
    with ThreadPoolExecutor(max_workers=3) as ex:
        for n, (entry, err) in enumerate(ex.map(work, list(todo.values())), 1):
            if err:
                errors.append(err)
                continue
            stats["enriched"] += 1
            old = entries.get(entry["key"], {})
            entry["first_seen"] = old.get("first_seen") or today()
            entry["status"] = old.get("status", "new")
            entries[entry["key"]] = entry
            if n % 100 == 0:
                print("  scored %d/%d bills…" % (n, len(todo)), flush=True)
                if backfill:
                    write_json(WATCHLIST, wl)

    # 4. Federal Register (skipped when backfilling a single past Congress)
    try:
        if only and only < current:
            raise StopIteration
        docs = fr_search(since_dt.strftime("%Y-%m-%d"))
        stats["fr_found"] = len(docs)
        for r in docs.values():
            e = fr_entry(r)
            old = entries.get(e["key"], {})
            e["first_seen"] = old.get("first_seen") or today()
            e["status"] = old.get("status", "new")
            entries[e["key"]] = e
    except StopIteration:
        pass
    except Exception as e:
        errors.append({"stage": "discover", "item": "(discovery)", "source": "federal register search", "error": "%s: %s" % (type(e).__name__, e)})

    # 5. link to matrix items
    in_matrix = {}
    for it in load_items():
        for t in it.get("tracking", []):
            k = tracker_key(t)
            if k.startswith("congress:"):
                in_matrix[k.split(":", 1)[1]] = it["id"]
            elif k.startswith("fr_document:"):
                in_matrix["fr-" + k.split(":", 1)[1]] = it["id"]
    for k, e in entries.items():
        e["in_matrix"] = in_matrix.get(k, "")

    wl["entries"] = dict(sorted(entries.items()))
    write_json(WATCHLIST, wl)

    os.makedirs(os.path.dirname(RUN_ERRORS), exist_ok=True)
    prior = read_json(RUN_ERRORS, [])
    write_json(RUN_ERRORS, [e for e in prior if e.get("stage") != "discover"] + errors)
    tiers = {}
    for e in entries.values():
        tiers[e["tier"]] = tiers.get(e["tier"], 0) + 1
    print("Scanned %(scanned)d bills (%(prefiltered)d title matches, %(committee)d via committees, %(skipped)d already scored), enriched %(enriched)d; "
          "%(fr_found)d Federal Register docs." % stats)
    print("Watchlist: %d entries · %s · %d errors" % (len(entries), ", ".join("%s %d" % kv for kv in sorted(tiers.items())), len(errors)))


if __name__ == "__main__":
    main()
