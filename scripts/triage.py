"""Work the watchlist: list, promote into the matrix, dismiss, and mark items reviewed.

Usage:
  python scripts/triage.py list [--min 45]                      # new watchlist entries, highest score first
  python scripts/triage.py promote 119-hr-1234 [--issue "Orbital Debris"]
  python scripts/triage.py promote fr-2026-12345 [--issue "Licensing"]
  python scripts/triage.py dismiss 119-hr-1234 [fr-2026-1 ...]  # hide from "new" (stays on the watchlist)
  python scripts/triage.py reviewed <item-id> [<item-id> ...]     # bump a matrix item's last_reviewed
"""
import os
import sys

from common import DATA, ITEMS_DIR, load_items, read_json, save_item, slugify, today, write_json

WATCHLIST = os.path.join(DATA, "watchlist.json")


def arg(name, default=""):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    cmd = sys.argv[1]
    opts = {"--issue", "--min"}
    keys = [a for i, a in enumerate(sys.argv[2:], 2) if not a.startswith("--") and sys.argv[i - 1] not in opts]
    wl = read_json(WATCHLIST, {"entries": {}})
    E = wl["entries"]

    if cmd == "list":
        floor = int(arg("--min", "45"))
        rows = sorted((e for e in E.values() if e.get("status") == "new" and not e.get("in_matrix") and e["score"] >= floor),
                      key=lambda e: -e["score"])
        for e in rows:
            print("%3d  %-18s %-14s %s\n%25s latest: %s %s" % (e["score"], e["key"], e["label"][:14], e["title"][:80], "",
                                                               e.get("latest_date", ""), (e.get("latest_text") or "")[:80]))
        print("%d new entr%s scoring >= %d." % (len(rows), "y" if len(rows) == 1 else "ies", floor))
        return

    if cmd == "promote":
        issue = arg("--issue")
        for key in keys:
            e = E.get(key)
            if not e:
                print("Not on the watchlist: " + key)
                continue
            slug = slugify(e["title"])
            if os.path.exists(os.path.join(ITEMS_DIR, slug + ".json")):
                slug = slugify(e["title"] + "-" + key)
            if e["source"] == "congress":
                tracking = [{"type": "congress", "congress": e["congress"], "bill_type": e["bill_type"], "number": e["number"]}]
                kind, entity, number = "legislation", "Congress", e["label"]
            else:
                tracking = [{"type": "fr_document", "document": e["document"]}] + [
                    {"type": "fr_docket", "docket": d.split(":")[-1].strip()} for d in e.get("dockets", []) if "-" in d and "Notice" not in d]
                kind, entity, number = "regulatory", ", ".join(e.get("agencies", [])[:2]), "; ".join(e.get("dockets", []))
            save_item({
                "id": slug, "name": e["title"], "number": number, "kind": kind, "entity": entity,
                "issues": [issue] if issue else [], "status": e.get("latest_text", ""), "status_date": e.get("latest_date", ""),
                "aligns": "Unassessed", "effect": e.get("summary", ""), "alignment_notes": "", "gridlock": "",
                "sponsors": e.get("sponsor", ""), "links": [e["url"]], "tracking": tracking, "auto": {},
                "review": {"last_reviewed": today(), "notes": "Promoted from watchlist (score %d); analysis pending." % e["score"]},
            })
            e["status"], e["in_matrix"] = "promoted", slug
            print("Promoted %s -> data/items/%s.json (fill in effect/alignment before merging)" % (key, slug))

    elif cmd == "dismiss":
        for key in keys:
            if key in E:
                E[key]["status"] = "dismissed"
                print("Dismissed " + key)
            else:
                print("Not found: " + key)

    elif cmd == "reviewed":
        items = {i["id"]: i for i in load_items()}
        for iid in keys:
            if iid in items:
                items[iid].setdefault("review", {})["last_reviewed"] = today()
                save_item(items[iid])
                print("Marked reviewed: " + iid)
            else:
                print("No such item: " + iid)
        return
    else:
        print(__doc__)
        return
    write_json(WATCHLIST, wl)


if __name__ == "__main__":
    main()
