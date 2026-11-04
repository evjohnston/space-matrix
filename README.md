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
- **New on the watchlist**: entries scoring 45+ are listed with their score and top reasons. Run `python scripts/triage.py promote <key> --issue "Orbital Debris"` to move one into the matrix (then fill in the analysis), or `python scripts/triage.py dismiss <key>` to hide it. `python scripts/triage.py list` shows everything new.
- **Manual items due for review**: check the source, update the item if needed, then run `python scripts/triage.py reviewed <item-id>`.
- **Merge** the PR to publish. To hold back a single change, revert its file on the branch before merging.

## Run locally

Requires Python 3.9+ with no extra packages.

```sh
export CONGRESS_API_KEY=...        # otherwise uses DEMO_KEY, which is heavily rate-limited
python3 scripts/check_updates.py   # poll sources, update data/items/*/auto + data/changelog.json
python3 scripts/discover.py        # find + score new/updated space bills & FR docs -> data/watchlist.json
python3 scripts/discover.py --backfill   # one-time: score every bill since the 106th Congress + 12 months of FR (resumable)
python3 scripts/discover.py --rescore    # re-apply relevance.py to stored entries, no API calls
python3 scripts/report.py          # write build/REPORT.md
python3 scripts/build.py           # compile site/data.json
python3 -m http.server -d site     # open http://localhost:8000
```

## Design

The visual system follows the "Flight Data File" direction chosen with Impeccable. Product facts are in `PRODUCT.md`, the direction contract is in `.impeccable/surfaces/`, and the token system will be in `DESIGN.md`. Impeccable's skill and its design-check hooks are installed locally in `.claude/` (not committed). Run `npx impeccable install --project --providers=claude` to set them up on another machine.

## Files

- `data/items/*.json`: one file per matrix item; the source of truth.
- `data/changelog.json`: every detected official change, shown on the site as "Recent changes" and in each item's history.
- `data/watchlist.json`: every scored match from discovery, published on the site's Watchlist tab, clearly labelled as unanalyzed.
- `data/config.json`: site title, review cadence, and discovery keyword patterns.
- `data/source/`: the original spreadsheet exports. `scripts/import_matrix.py` built the items from `matrix.csv`; rerunning it skips existing files unless you pass `--force`, which overwrites them.
- `site/`: static HTML, CSS, and JS. `data.json` is generated at deploy time.

## Editing on the site

Collaborators on the GitHub repo can sign in on the site and edit analysis in place. Saving commits the item's JSON file directly to `main`, credited to the editor's own GitHub account, and the site redeploys in about a minute. Editors can also add a watchlist entry to the matrix with **Add to matrix**. Only people with write access to the repo can save, because GitHub enforces it, so you control who can edit by managing collaborators under **Settings → Collaborators**. Every edit is a normal commit, so `git log` shows who changed what and any edit can be reverted.

**Sign-in options**

- **Personal access token (works with no setup):** click *Sign in to edit* and paste a GitHub token. Use a fine-grained token scoped to this repository with **Contents: Read and write**, or a classic token with `public_repo`. The token is kept only in that browser tab.
- **"Sign in with GitHub" button (one-time setup, free):**
  1. Create a GitHub OAuth app at <https://github.com/settings/developers> → **New OAuth App**. Set the homepage to the site URL and the callback URL to `https://<your-worker>.workers.dev/callback`.
  2. Deploy the helper in `oauth-worker/`:
     ```sh
     cd oauth-worker
     npx wrangler login
     npx wrangler secret put GITHUB_CLIENT_ID
     npx wrangler secret put GITHUB_CLIENT_SECRET
     npx wrangler deploy
     ```
     Edit `ALLOWED_ORIGINS` in `wrangler.toml` if the site lives somewhere other than `www.emersonjohnston.org` or `localhost:8000`.
  3. Put the worker URL in `data/config.json` → `editing.oauth_proxy`, then commit.

The worker only swaps GitHub's login code for a token and hands the token back to the page in the URL fragment. It never stores tokens.

## Watchlist and relevance scores

Discovery runs with every check and looks in three places:

1. **Congress.gov bills updated in the last 3 days.** The one-time backfill covers every Congress from the 106th (1999) on. This catches newly introduced bills and new actions on older ones. Any title loosely matching a space term is fetched and scored, and entries already on the watchlist are refreshed.
2. **Bills referred to the space committees**: House Space and Aeronautics; Senate Aviation, Space, and Innovation; both Strategic Forces subcommittees; and the parent Science and Commerce committees. These are included even when the title never says "space."
3. **Federal Register full-text searches** for terms such as "commercial space," "orbital debris," spacecraft, satellite and reentry. These cover proposed rules, final rules, notices and presidential documents.

Each match gets an **explainable 0–100 score** from `scripts/relevance.py`. Points come from:

- space terms in the title,
- Congress's official subject tags ("Space flight and exploration," "Spacecraft and satellites"),
- referral to a space committee,
- space terms in the CRS summary or abstract,
- sustainability terms (debris, situational awareness, traffic coordination, deorbit),
- policy area, and
- whether a document is binding rulemaking.

Titles where "space" means something else (airspace, office space, "women's spaces," space-available travel, Sunshine Act meeting notices) lose points.

| Tier | Score |
|---|---|
| High | 70+ |
| Medium | 45–69 |
| Low | 25–44 |
| Likely noise | under 25 |

Low and noise entries are kept, so the Watchlist tab can show the score distribution and which signals produce noise. To adjust the scoring, edit the weights and term lists in `scripts/relevance.py`, then rerun `discover.py --backfill`.

**Known gap:** large omnibus bills (the NDAA, appropriations) have generic titles and subjects, so they score low. Add them to the matrix by hand, as you already have.

## Adding tracking to an item

Add entries to an item's `tracking` array:

```json
{"type": "congress", "congress": 119, "bill_type": "hr", "number": "1234"}
{"type": "fr_document", "document": "2026-20388"}
{"type": "fr_docket", "docket": "FAA-2026-9936"}
```

An empty `tracking` array means the item is reviewed manually.
