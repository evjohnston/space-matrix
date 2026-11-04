# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Policy staff and researchers** (congressional and agency staff, think-tank analysts). They check where U.S. space-sustainability bills, executive actions and rulemakings stand, and what each one would actually do.
- **The matrix team and invited analysts.** They maintain the tracker: they review automated official updates, triage the watchlist, and write the analysis (substantive effect, alignment with the policy recommendations, sources of gridlock). They edit on the site after signing in with GitHub.

## Product Purpose

A live, reviewed tracker of U.S. space safety and sustainability policy. It does three jobs: shows the current official status of every tracked item, explains what each item does and whether it aligns with the *Space Safety and Sustainability, Part II: Policy Recommendations* report, and surfaces newly active, relevant bills and rules before anyone has to go looking. Success means a staffer or researcher can answer "where does this stand, what does it do, and does it fit the recommendations?" in one visit, and trust the answer.

## Positioning

All four of these together, which Congress.gov, the Federal Register or a news feed can't truthfully claim:

1. **Expert analysis is the core value.** Alignment judgments and substantive-effect write-ups by the team sit alongside the official record.
2. **One place for all branches.** Congressional bills, executive orders and space policy directives, and agency rulemakings (FAA, FCC, NOAA/OSC and others) live in one view.
3. **Live and verified.** Official status is polled every six hours from Congress.gov and the Federal Register. Changes are dated, logged, and reviewed before publication; analysis edits are attributed and kept in git history.
4. **Signal over noise.** Every discovered bill or rule gets an explainable 0–100 relevance score, and the noise stays visible rather than hidden.

## Operating Context

- Desk research: staff cross-referencing bills, dockets and the recommendations report, often with Congress.gov or the Federal Register open alongside. Desktop first, but it must work on a phone.
- Team workflow: a review PR every six hours (official updates, consistency flags, new watchlist entries), plus in-site editing for analysts. Triage moves watchlist entries into the matrix.
- Terminology: matrix (curated items), watchlist (scored discoveries), stage, alignment (Aligns / Doesn't align / N/A / Unassessed), relevance tiers (High 70+, Medium 45+, Low 25+, Likely noise).

## Capabilities and Constraints

- Static site on GitHub Pages (custom domain via evjohnston.github.io → www.emersonjohnston.org/space-matrix/). Plain HTML, CSS and JS with no build framework. Python scripts generate `site/data.json` and `site/watchlist.json`.
- Data: 39 curated matrix items, and roughly 1,600+ watchlist entries from the 106th Congress onward plus 12 months of the Federal Register, growing.
- Editing: GitHub sign-in (Cloudflare Worker OAuth helper, or a pasted token as fallback). Only repo collaborators can save, and saves commit directly to `main` and publish within about a minute.
- The analysis text is long-form, multi-paragraph prose, and must stay comfortable to read.
- Charts follow the validated data-viz palette rules: categorical type colors, a diverging alignment scale, an ordinal tier ramp, and reserved status colors.

## Brand Commitments

Independent, with no parent organization or brand to match. The name in use is "Space Sustainability Legislation Matrix."

## Evidence on Hand

- Real data only: `data/items/*.json` (curated analysis), `data/watchlist.json` (scored discoveries), `data/changelog.json` (detected official changes).
- The policy recommendations report is referenced by name in the analysis text. There's no copy or link in the repo; don't fabricate quotes from it.
- There are no testimonials, user counts or press, and future work must not invent them.

## Product Principles

1. **Official record and expert judgment stay visibly distinct.** Users must always be able to tell what came from Congress.gov or the Federal Register and what is the team's analysis.
2. **Show your work.** Every status has a date and source, every score has its reasons, and every edit has an author.
3. **Density with clarity.** It's a working tool for people who read closely: rich data, but scannable and quiet.
4. **Freshness is a feature.** What changed recently, and what's closing soon, should be the first thing a returning visitor sees.

## Accessibility & Inclusion

Target WCAG 2.2 AA: full keyboard operation, visible focus, no meaning carried by color alone, light and dark modes, and readable long-form text.
