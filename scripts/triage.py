"""Promote or dismiss bills found by discover.py, and mark items as reviewed.

Usage:
  python scripts/triage.py list
  python scripts/triage.py promote 119-hr-1234 [--issue "Orbital Debris"]
  python scripts/triage.py dismiss 119-hr-1234 [119-s-55 ...]
  python scripts/triage.py reviewed <item-id> [<item-id> ...]   # bump last_reviewed to today
"""
import os
import sys

from common import CANDIDATES, ITEMS_DIR, load_items, read_json, save_item, slugify, today, write_json


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    cmd, args = sys.argv[1], [a for a in sys.argv[2:]]
    state = read_json(CANDIDATES, {"seen": [], "candidates": []})
    by_key = {c["key"]: c for c in state["candidates"]}

    if cmd == "list":
        for c in state["candidates"]:
            print("%-16s %s\n%16s  latest: %s %s" % (c["key"], c["title"], "", c["latest_action_date"], c["latest_action_text"][:90]))
        print("%d candidate(s)." % len(state["candidates"]))

    elif cmd == "promote":
        issue = args[args.index("--issue") + 1] if "--issue" in args else ""
        keys = [a for a in args if a in by_key]
        for key in keys:
            c = by_key.pop(key)
            slug = slugify(c["title"])
            if os.path.exists(os.path.join(ITEMS_DIR, slug + ".json")):
                slug = slugify(c["title"] + "-" + key)
            label = {"hr": "H.R.", "s": "S.", "hres": "H.Res.", "sres": "S.Res.", "hjres": "H.J.Res.",
                     "sjres": "S.J.Res.", "hconres": "H.Con.Res.", "sconres": "S.Con.Res."}.get(c["bill_type"], c["bill_type"].upper())
            save_item({
                "id": slug, "name": c["title"], "number": "%s %s" % (label, c["number"]), "kind": "legislation",
                "entity": "Congress", "issues": [issue] if issue else [], "status": c["latest_action_text"],
                "status_date": c["latest_action_date"], "aligns": "Unassessed", "effect": "", "alignment_notes": "",
                "gridlock": "", "sponsors": "", "links": [c["url"]],
                "tracking": [{"type": "congress", "congress": c["congress"], "bill_type": c["bill_type"], "number": c["number"]}],
                "auto": {}, "review": {"last_reviewed": today(), "notes": "Promoted from discovery; analysis pending."},
            })
            print("Promoted %s -> data/items/%s.json (fill in effect/alignment before merging)" % (key, slug))
        missing = [a for a in args if a not in keys and not a.startswith("--") and a != issue]
        if missing:
            print("Not in candidates: " + ", ".join(missing))

    elif cmd == "dismiss":
        for key in args:
            print(("Dismissed " if by_key.pop(key, None) else "Not found: ") + key)

    elif cmd == "reviewed":
        items = {i["id"]: i for i in load_items()}
        for iid in args:
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

    state["candidates"] = list(by_key.values()) if cmd != "list" else state["candidates"]
    write_json(CANDIDATES, state)


if __name__ == "__main__":
    main()
