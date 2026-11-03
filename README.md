# Space Sustainability Legislation Tracker

A static microsite for the Space Sustainability Legislation Matrix. Official status is polled from public APIs every six hours, and every change goes through a pull request that a person reviews before it's published.

```
Congress.gov API ─┐                                       ┌─ merge ─▶ GitHub Pages
Federal Register ─┼─▶ check.yml (every 6h) ─▶ review PR ──┤
New-bill search  ─┘    writes data/ only      + report    └─ edit curated fields on the PR branch first if needed
```

## What's automatic and what's reviewed

| | Who maintains it | Where |
|---|---|---|
| Latest official action, cosponsors, public law, FR comment deadlines, new docket documents | Bot | `auto` block in each `data/items/*.json` |
| Status wording, substantive effect, alignment, gridlock, sponsors, issues | You | all other fields in `data/items/*.json` |
| Executive orders, SPDs, FCC dockets, agency policies (no usable API) | You, prompted every 90 days | `review.last_reviewed` |

The bot never edits the curated fields. When an official source changes, the PR report shows the new action next to your current status text, so you can decide whether the analysis needs updating.

The report also runs **consistency checks** every time. It flags a bill whose title doesn't match the item (a likely wrong number or link), a comment period that has closed while the status still says it's open, a docket that has a new final rule, an official record newer than your status date, and a bill that became law when the status doesn't say so.

## One-time setup

1. **Get a Congress.gov API key** (free, instant): https://api.congress.gov/sign-up/
2. **Create a GitHub repo** and push this folder to `main`.
3. Under **Settings → Secrets and variables → Actions**, add the secret `CONGRESS_API_KEY`.
4. Under **Settings → Actions → General → Workflow permissions**, choose "Read and write" and tick "Allow GitHub Actions to create and approve pull requests".
5. Under **Settings → Pages**, set **Source** to "GitHub Actions".
6. Under **Settings → General**, tick "Automatically delete head branches".
7. Run **Actions → Check for updates → Run workflow** once. The first run records a baseline and logs no changes. Its job summary shows the full consistency report.

## Reviewing a PR

The bot keeps a single open PR, "Tracker updates for review", and adds to it on each run instead of opening new ones. It also keeps any edits you push to that branch.

- **Official updates**: for each item, read the new action. If the status or analysis should change, edit `data/items/<id>.json` on the PR branch, either in GitHub's web editor or locally.
- **New space-related bills**: run `python scripts/triage.py promote <key> --issue "Orbital Debris"` to add one (then fill in the analysis), or `python scripts/triage.py dismiss <key>` to ignore it.
- **Manual items due for review**: check the source, update the item if needed, then run `python scripts/triage.py reviewed <item-id>`.
- **Merge** the PR to publish. To hold back a single change, revert its file on the branch before merging.

## Run locally

Requires Python 3.9+ with no extra packages.

```sh
export CONGRESS_API_KEY=...        # otherwise uses DEMO_KEY, which is heavily rate-limited
python3 scripts/check_updates.py   # poll sources, update data/items/*/auto + data/changelog.json
python3 scripts/discover.py        # find new space bills -> data/candidates.json
python3 scripts/report.py          # write build/REPORT.md
python3 scripts/build.py           # compile site/data.json
python3 -m http.server -d site     # open http://localhost:8000
```

## Files

- `data/items/*.json`: one file per matrix item; the source of truth.
- `data/changelog.json`: every detected official change, shown on the site as "Recent changes" and in each item's history.
- `data/candidates.json`: discovered bills awaiting triage. These are never published.
- `data/config.json`: site title, review cadence, and discovery keyword patterns.
- `data/source/`: the original spreadsheet exports. `scripts/import_matrix.py` built the items from `matrix.csv`; rerunning it skips existing files unless you pass `--force`, which overwrites them.
- `site/`: static HTML, CSS, and JS. `data.json` is generated at deploy time.

## Adding tracking to an item

Add entries to an item's `tracking` array:

```json
{"type": "congress", "congress": 119, "bill_type": "hr", "number": "1234"}
{"type": "fr_document", "document": "2026-20388"}
{"type": "fr_docket", "docket": "FAA-2026-9936"}
```

An empty `tracking` array means the item is reviewed manually.
