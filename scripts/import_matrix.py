"""One-time (re)import of the curated matrix CSV into data/items/*.json.

Usage:  python scripts/import_matrix.py [path/to/matrix.csv] [--force]

Each CSV row becomes one item file. The importer infers how each item can be
tracked automatically (Congress.gov bill, Federal Register document/docket) and
falls back to manual review for everything else. Existing item files are left
alone unless --force is given, so curated edits are never clobbered.
"""
import csv
import os
import re
import sys

from common import DATA, ITEMS_DIR, parse_us_date, save_item, slugify, today

CHAMBER_TYPES = {
    ("house", "bill"): "hr", ("senate", "bill"): "s",
    ("house", "joint-resolution"): "hjres", ("senate", "joint-resolution"): "sjres",
    ("house", "concurrent-resolution"): "hconres", ("senate", "concurrent-resolution"): "sconres",
    ("house", "resolution"): "hres", ("senate", "resolution"): "sres",
}
CONGRESS_LINK = re.compile(
    r"congress\.gov/bill/(\d+)(?:st|nd|rd|th)-congress/(house|senate)-(bill|joint-resolution|concurrent-resolution|resolution)/(\d+)")
# Order matters: longer prefixes first.
NUMBER_PATTERNS = [
    (r"H\.\s*J\.\s*Res\.?", "hjres"), (r"S\.\s*J\.\s*Res\.?", "sjres"),
    (r"H\.\s*Con\.\s*Res\.?", "hconres"), (r"S\.\s*Con\.\s*Res\.?", "sconres"),
    (r"H\.\s*Res\.?", "hres"), (r"S\.\s*Res\.?", "sres"),
    (r"H\.\s*R\.?", "hr"), (r"(?<![A-Za-z.])S\.", "s"),
]
FR_DOC = re.compile(r"federalregister\.gov/(?:documents|d)/(?:\d{4}/\d{2}/\d{2}/)?(\d{4}-\d{4,6})")
FR_DOCKET = re.compile(r"\b([A-Z]{2,6}-\d{4}-\d{3,6})\b")
URL = re.compile(r"https?://[^\s;,]+")

COLS = {
    "name": "Legislation Name", "number": "Legislation Number", "issue": "Issue",
    "entity": "Government Entity", "status": "Current Status", "effect": "Substantive Effect",
    "aligns": "Aligns With Policy Recomendations?", "alignment_notes": "How Does it or How Doesn't it Align?",
    "links": "Link to Primary Source", "last_update": "Date of Last Update",
    "gridlock": "Sources of Legislative Gridlock", "sponsors": "Sponsors/Original POCs",
}


LONG_TEXT = {"effect", "alignment_notes", "gridlock", "links"}


def clean(s, keep_newlines=False):
    s = (s or "").replace("\r", "")
    return re.sub(r"[ \t]+" if keep_newlines else r"\s+", " ", s).strip()


def infer_trackers(number, links_text, entity):
    trackers, seen = [], set()

    def add(t):
        key = tracker_key(t)
        if key not in seen:
            seen.add(key)
            trackers.append(t)

    congresses = []
    for m in CONGRESS_LINK.finditer(links_text):
        congress = int(m.group(1))
        congresses.append(congress)
        add({"type": "congress", "congress": congress,
             "bill_type": CHAMBER_TYPES[(m.group(2), m.group(3))], "number": m.group(4)})

    is_congress = "congress" in entity.lower() or congresses
    if is_congress:
        default_congress = congresses[0] if congresses else 119
        rest = number
        for pat, btype in NUMBER_PATTERNS:
            for m in re.finditer(pat + r"\s*(\d+)", rest):
                add({"type": "congress", "congress": default_congress, "bill_type": btype, "number": m.group(1)})
            rest = re.sub(pat + r"\s*\d+", " ", rest)

    for m in FR_DOC.finditer(links_text):
        add({"type": "fr_document", "document": m.group(1)})
    for m in FR_DOCKET.finditer(number + " " + links_text):
        add({"type": "fr_docket", "docket": m.group(1)})
    return trackers


def tracker_key(t):
    if t["type"] == "congress":
        return "congress:%s-%s-%s" % (t["congress"], t["bill_type"], t["number"])
    if t["type"] == "fr_document":
        return "fr_document:" + t["document"]
    if t["type"] == "fr_docket":
        return "fr_docket:" + t["docket"]
    return t["type"]


def kind_for(entity, trackers):
    e = entity.lower()
    if "congress" in e or any(t["type"] == "congress" for t in trackers):
        return "legislation"
    if "executive" in e:
        return "executive"
    return "regulatory"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--force" in sys.argv
    src = args[0] if args else os.path.join(DATA, "source", "matrix.csv")
    os.makedirs(ITEMS_DIR, exist_ok=True)

    with open(src, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    used, created, skipped, warnings = set(), 0, 0, []
    for row in rows:
        r = {k: clean(row.get(col, ""), k in LONG_TEXT) for k, col in COLS.items()}
        if not r["name"]:
            continue
        base = slugify(r["name"])
        slug, n = base, 2
        while slug in used:
            slug, n = "%s-%d" % (base, n), n + 1
        used.add(slug)

        path = os.path.join(ITEMS_DIR, slug + ".json")
        if os.path.exists(path) and not force:
            skipped += 1
            continue

        trackers = infer_trackers(r["number"], r["links"], r["entity"])
        bills = [t for t in trackers if t["type"] == "congress"]
        if len(bills) > 1:
            warnings.append("%s: tracking %d bills (%s) — check these are all intended"
                            % (r["name"], len(bills), ", ".join(tracker_key(t).split(":")[1] for t in bills)))
        if not trackers:
            warnings.append("%s: no API source found — manual review only" % r["name"])

        item = {
            "id": slug,
            "name": r["name"],
            "number": r["number"],
            "kind": kind_for(r["entity"], trackers),
            "entity": r["entity"],
            "issues": [i.strip() for i in re.split(r";", r["issue"]) if i.strip()],
            "status": r["status"],
            "status_date": parse_us_date(r["last_update"]),
            "aligns": r["aligns"] or "Unassessed",
            "effect": r["effect"],
            "alignment_notes": r["alignment_notes"],
            "gridlock": r["gridlock"],
            "sponsors": r["sponsors"],
            "links": URL.findall(r["links"]),
            "tracking": trackers,
            "auto": {},
            "review": {"last_reviewed": today(), "notes": ""},
        }
        save_item(item)
        created += 1

    print("Imported %d items (%d existing left untouched)." % (created, skipped))
    for w in warnings:
        print("  ! " + w)


if __name__ == "__main__":
    main()
