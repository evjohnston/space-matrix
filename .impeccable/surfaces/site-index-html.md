---
version: 1
slug: "site-index-html"
primary_target: "site/index.html"
related_targets: ["site/styles.css","site/app.js","site/watch.js","site/edit.js"]
---

## Scope

The tracker's single-page app (`site/index.html` + `app.js`, `watch.js`, `edit.js`, `styles.css`): the Matrix tab, the Watchlist tab, the item/entry drawer, and the editing modal. Mode: **Operate**. Audience: policy staff and researchers checking where items stand, plus the team triaging and writing analysis.

## Direction contract

THESIS: Every bill, order and rule is a procedure card, and where it stands is the step you're on. This refuses the category default of a SaaS dashboard (white cards, KPI tiles, pastel status pills, left nav).

OWN-WORLD: The colors of laminated card stock: a cool off-white ground `#F3F4EF` with near-black ink `#121416`. A black shell bar and a cue-yellow band (`#FFC72C`) carry "now". 2px ink rules and square corners, no rounded pills. One grotesque family, Barlow and Barlow Condensed: condensed caps for labels, numerals and headers, and regular Barlow sentence case for all prose. The validated type colors (legislation `#2A78D6`, regulatory `#1BAF7A`, executive `#EB6834`) appear as card-tab blocks. Caution blocks have a hazard-striped header. Status red `#D03B3B` is reserved for deadlines.

STORY: A visitor sees what is due now, scans every item's stage step for step, opens one to read its official record beside the team's analysis, and trusts both because each carries its date, source and author.

FIRST VIEWPORT: A black shell bar holds the product name, Matrix and Watchlist tabs, live check status and sign-in. Below it, a cue-yellow CUE · NOW strip of three or four counts (comment periods closing, items needing review, items moved in 30 days). Then a 2px-ruled filter row over the dense matrix table, whose stage column is a numbered checkbox checklist at one fixed scale. The selected row lifts and the rest dim, and its procedure card opens on the right. Charts sit below the table in ruled panels.

FORM: Flight Data File cue cards, assigned as candidate 6 of 7 (seed:9499eb8c1bf81788). Raises: one grotesque family throughout (design annual); fixed-scale stage checklists on a shared baseline (botanical folio); House-left / Senate-right timeline around a center date spine (labanotation); right-aligned tabular figures (cassette J-card); selected row lifts and the rest dims (streaming wall). Signature move: the stage drawn as a procedure checklist, with checked steps in ink, the current step on cue yellow with ▶, and later steps as empty boxes. Caution blocks carry review flags and deadlines.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Constraints

- Keep every existing function, data field, filter, chart, URL route and editing flow. Charts keep the validated palette rules.
- Analysis prose stays sentence case at a comfortable reading measure, never condensed caps.
- WCAG 2.2 AA, light and dark modes. Dark mode is the same world under cabin lighting, not an inversion.

## Unresolved

- No logo or mark: use the product name in condensed caps.
