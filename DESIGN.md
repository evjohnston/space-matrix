---
name: Space Sustainability Tracker
description: A live, reviewed tracker of U.S. space safety and sustainability policy, set as Flight Data File cue cards.
colors:
  cue-yellow: "#FFC72C"
  cue-soft: "#FFF4CC"
  record-link: "#1C5CAB"
  card-stock: "#F3F4EF"
  laminate: "#FFFFFF"
  well: "#E8EAE3"
  ink: "#121416"
  graphite: "#3B3F43"
  muted: "#5E625D"
  rule: "#121416"
  hairline: "#D3D5CC"
  shell: "#121416"
  shell-ink: "#F3F4EF"
  shell-muted: "#A9ADA6"
  hover-wash: "rgba(18, 20, 22, .045)"
  type-legislation: "#2A78D6"
  type-regulatory: "#1BAF7A"
  type-executive: "#EB6834"
  align-yes: "#2A78D6"
  align-na: "#B3B1A9"
  align-unassessed: "#DAD8D0"
  align-no: "#E34948"
  tier-high: "#184F95"
  tier-medium: "#3987E5"
  tier-low: "#86B6EF"
  tier-noise: "#CFCDC5"
  bar: "#2A78D6"
  bar-muted: "#C3C2BA"
  chart-grid: "#E1E0D9"
  chart-axis: "#A9A79F"
  critical: "#D03B3B"
  good: "#127A12"
  warning: "#8A5A00"
  alert-ink: "#FFFFFF"
  focus-ring: "#121416"
  live: "#3CC25A"
  tab-legislation: "#1C5CAB"
  tab-legislation-ink: "#FFFFFF"
  cue-soft-dark: "#3A3218"
  record-link-dark: "#8EB8F0"
  card-stock-dark: "#15171A"
  laminate-dark: "#1D2024"
  well-dark: "#262A2F"
  ink-dark: "#ECEDE8"
  graphite-dark: "#C9CBC4"
  muted-dark: "#9DA19A"
  rule-dark: "#5A5F66"
  hairline-dark: "#30343A"
  shell-dark: "#08090A"
  shell-ink-dark: "#ECEDE8"
  shell-muted-dark: "#9DA19A"
  shell-edge-dark: "#5A5F66"
  hover-wash-dark: "rgba(255, 255, 255, .05)"
  focus-ring-dark: "#FFC72C"
  type-legislation-dark: "#3987E5"
  type-regulatory-dark: "#199E70"
  type-executive-dark: "#D95926"
  align-yes-dark: "#3987E5"
  align-na-dark: "#5F5E5A"
  align-unassessed-dark: "#3A3A37"
  align-no-dark: "#E66767"
  tier-high-dark: "#9EC5F4"
  tier-medium-dark: "#3987E5"
  tier-low-dark: "#184F95"
  tier-noise-dark: "#4A4945"
  bar-dark: "#3987E5"
  bar-muted-dark: "#4A4945"
  chart-grid-dark: "#2C2C2A"
  chart-axis-dark: "#4E5257"
  critical-dark: "#F07A72"
  good-dark: "#3CC25A"
  warning-dark: "#FAB219"
  alert-ink-dark: "#121416"
  tab-legislation-dark: "#3987E5"
  tab-legislation-ink-dark: "#121416"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "0.01em"
  figure:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "46px"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "tnum"
  numeral:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.05
    fontFeature: "tnum"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.06em"
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
  section:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    letterSpacing: "0.12em"
  label:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.05em"
  column-head:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "12.5px"
    fontWeight: 700
    letterSpacing: "0.1em"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  prose:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "15.5px"
    fontWeight: 400
    lineHeight: 1.65
  meta:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  none: "0px"
  bar-end: "4px"
spacing:
  hair: "3px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  gap: "18px"
  gutter: "24px"
components:
  button:
    backgroundColor: "{colors.laminate}"
    textColor: "{colors.ink}"
    typography: "{typography.section}"
    rounded: "{rounded.none}"
    padding: "7px 14px"
  button-hover:
    backgroundColor: "{colors.well}"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card-stock}"
    typography: "{typography.section}"
    rounded: "{rounded.none}"
    padding: "7px 14px"
  button-primary-hover:
    backgroundColor: "{colors.graphite}"
  button-ghost:
    backgroundColor: "{colors.laminate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "3px 10px"
  button-ghost-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card-stock}"
  segment-option:
    textColor: "{colors.graphite}"
    typography: "{typography.label}"
    height: "26px"
    padding: "0 11px"
  segment-option-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card-stock}"
  input-search:
    backgroundColor: "{colors.laminate}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    height: "36px"
    padding: "0 12px 0 32px"
  field-input:
    backgroundColor: "{colors.laminate}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "8px 10px"
  shell-bar:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.shell-ink}"
    height: "56px"
  shell-tab:
    textColor: "{colors.shell-muted}"
    typography: "{typography.label}"
  shell-tab-active:
    textColor: "{colors.shell-ink}"
  cue-band:
    backgroundColor: "{colors.cue-yellow}"
    textColor: "{colors.ink}"
  cue-item-on:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.cue-yellow}"
  panel:
    backgroundColor: "{colors.laminate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 16px 16px"
  panel-header:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    padding: "9px 16px"
  row-selected:
    backgroundColor: "{colors.cue-soft}"
  step-box:
    backgroundColor: "{colors.laminate}"
    textColor: "{colors.muted}"
    size: "17px"
  step-box-done:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.laminate}"
  step-box-current:
    backgroundColor: "{colors.cue-yellow}"
    textColor: "{colors.ink}"
  flag:
    backgroundColor: "{colors.cue-yellow}"
    textColor: "{colors.ink}"
    padding: "0 6px"
  filter-chip:
    backgroundColor: "{colors.cue-yellow}"
    textColor: "{colors.ink}"
    padding: "3px 4px 3px 10px"
  card-tab-legislation:
    backgroundColor: "{colors.tab-legislation}"
    textColor: "{colors.tab-legislation-ink}"
    padding: "5px 9px"
  card-tab-regulatory:
    backgroundColor: "{colors.type-regulatory}"
    textColor: "{colors.ink}"
    padding: "5px 9px"
  card-tab-executive:
    backgroundColor: "{colors.type-executive}"
    textColor: "{colors.ink}"
    padding: "5px 9px"
  deadline-urgent:
    backgroundColor: "{colors.cue-yellow}"
    textColor: "{colors.ink}"
    width: "54px"
  deadline-closing:
    backgroundColor: "{colors.critical}"
    textColor: "{colors.alert-ink}"
    width: "54px"
---

# Design System: Space Sustainability Tracker

## Overview

**Creative North Star: "The Flight Data File"**

Every bill, order and rule is a procedure card, and where it stands is the step you are on. The system borrows the material of crew cue cards: laminated card stock, near-black ink, heavy 2px rules, square corners, and a single cue-yellow that means "now". It is a working document for people who read closely, so it runs dense and quiet: tables, checklists and ruled panels rather than tiles and pills, with color held back for meaning.

Structure is drawn, not floated. Panels are ruled boxes with a well-toned header strip; rows are separated by hairlines; the only resting depth is the 2px ink border. One typeface family carries everything: Barlow Condensed in caps for labels, numerals and headers, and regular Barlow in sentence case for every sentence a person has to read. The official record and the team's analysis sit in the same card but in visibly different registers: dated, sourced, tabular figures for the record, long-measure prose for the judgment.

Dark mode is the same card under cabin lighting, not an inversion: the ground drops to a blue-black graphite, rules soften to steel, the cue stays the same yellow, and the data palette shifts to its validated dark counterparts.

**Key Characteristics:**
- Laminated card stock ground with near-black ink and 2px structural rules.
- Cue yellow reserved for the present: the current step, the cue band, selected rows, fresh and flagged items.
- Square corners everywhere; the only curve is the 4px rounded end of a chart bar.
- One family, two registers: condensed caps for labels and numerals, regular sentence case for prose.
- The stage drawn as a procedure checklist at one fixed scale on every row.
- A fixed, validated data-viz palette that UI chrome never borrows and themes never touch.

## Colors

Card stock and ink, one cue yellow, and a separate, validated data palette that carries every chart and type mark. Every token has a light value and, where it changes, a `-dark` sibling in the frontmatter that applies under `prefers-color-scheme: dark` (unless the light theme is forced) and under `data-theme="dark"`.

### Primary
- **Cue Yellow** (cue-yellow): the only accent, and it always means "now". It fills the cue band under the shell, the current step box and current procedure row, the active tab underline, filter chips, FRESH / NEW / review flags, urgent deadline counters, major timeline dates on the center spine, and the 3px focus halo on inputs. It has no dark sibling: the yellow is the same in both modes, and so is the ink on it.
- **Cue Wash** (cue-soft; cue-soft-dark, a dim amber): the selected row in the matrix, the selected chart column or bar.

### Secondary
- **Record Blue** (record-link; record-link-dark): links and text buttons only, underlined at 1px with a 3px offset that thickens to 2px on hover. It is a separate token from the legislation data blue and must not be swapped for it.

### Neutral
- **Card Stock** (card-stock; card-stock-dark): the page ground. Card stock is also the text color on ink-filled buttons.
- **Laminate** (laminate; laminate-dark): panels, inputs, step boxes, the drawer.
- **Well** (well; well-dark): panel header strips, table total rows, the timeline date spine, the CLI block, button hover.
- **Ink** (ink; ink-dark): text, filled check boxes, pressed segments, primary buttons, and the ink on cue yellow.
- **Graphite** (graphite; graphite-dark): secondary text, labels, column heads.
- **Muted Sage** (muted; muted-dark): meta lines, hints, dimmed rows. It is 5.6:1 on card stock.
- **Rule** (rule; rule-dark): every 2px structural border. In light mode it matches ink; in dark mode it softens to steel.
- **Hairline** (hairline; hairline-dark): 1px row separators and 1.5px tag and signal outlines.
- **Shell Black** (shell, shell-ink, shell-muted; shell-dark, shell-ink-dark, shell-muted-dark): the top bar, the cue band's header block, the "on" cue, toasts. In dark mode the shell gains a 2px bottom edge (shell-edge-dark).
- **Hover Wash** (hover-wash; hover-wash-dark): the hover state for every row, bar and column.
- **Focus Ring** (focus-ring; focus-ring-dark): the 2px focus outline. It is ink in light mode and cue yellow in dark mode. Inside the shell it is always cue yellow.
- **Alert Ink** (alert-ink; alert-ink-dark): text and the alert-icon cutout on critical-red fills. It is white in light mode and ink in dark mode.

### Data palette (fixed)
These values are a validated data-viz palette, set per mode. They are not themable and do not follow brand changes.
- **Categorical item type:** legislation, regulatory, executive (type-legislation, type-regulatory, type-executive and their `-dark` siblings). They appear as 9px square type dots and as bar fills.
- **Card-tab block:** tab-legislation and tab-legislation-ink (plus `-dark` siblings) are a deeper step of the legislation hue. They are used only for the solid card-tab block, so its 13px label holds 4.5:1. Regulatory and executive tabs use their type colors with ink text. Charts and type dots keep type-legislation.
- **Diverging alignment:** aligns, N/A, unassessed, doesn't align (align-yes, align-na, align-unassessed, align-no and `-dark` siblings).
- **Ordinal relevance tier:** High, Medium and Low (tier-high, tier-medium, tier-low), plus a likely-noise gray (tier-noise). The dark siblings reverse the lightness ramp so High stays the most prominent.
- **Chart chrome:** bar, bar-muted (pending and inactive bars, dead stage boxes), chart-grid, chart-axis, each with a `-dark` sibling.
- **Reserved status:** critical (deadlines only), good, warning, each with a `-dark` sibling.
- **Live signal** (live): the pulsing live-check dot in the shell bar. It sits on shell black in both modes, so it has one value.

### Named Rules
**The Cue Is Now Rule.** Yellow marks the present and nothing else: the current step, what needs attention now, what is selected, what is new. It is never decoration, never a section color, never a background for prose.

**The Fixed Palette Rule.** The data colors are validated as sets (categorical, diverging, ordinal, reserved status) and are fixed per mode. Do not re-theme them, re-order them, or borrow them for chrome; meaning is never carried by color alone, so every mark also has a label.

**The Red Means Deadline Rule.** Critical red is reserved for deadlines: closing comment periods, the WARNING caution stripe, future-dated timeline entries, and the critical count in the cue band. Inside the cue band the red is a fixed #D03B3B in both modes, because the band is yellow in both modes.

## Typography

**Display Font:** Barlow Condensed (with Arial Narrow, sans-serif), weights 500 to 800
**Body Font:** Barlow (with system-ui, sans-serif), weights 400 to 700
**Label/Mono Font:** Barlow Condensed for labels; ui-monospace only inside the CLI command block

**Character:** One grotesque family in two registers. The condensed caps read like stencilled card headings and gauge numerals; regular Barlow carries long-form analysis at an easy measure.

### Hierarchy
- **Display** (800, 28px, 1.05, caps, balanced wrap): the procedure card (drawer) title.
- **Figure** (800, 46px, 1): the big relevance score in a watchlist card.
- **Numeral** (800, 28px, 1.05, tabular): figure-strip values and cue counts under 640px; cue counts run at 30px on wider screens, deadline counters and score cells at 22px.
- **Headline** (700, 19px, 0.06em, caps): the product name in the shell bar; the cue band header runs at 800, 20px, 0.08em.
- **Title** (700, 16px, 1.2, 0.08em, caps): panel headings.
- **Section** (700, 14px, 0.12em, caps, 2px rule beneath): drawer section heads; also the button face.
- **Label** (600, 13px, 0.05 to 0.08em, caps): tabs, segments, selects, stage labels, alignment pills, legends, fact terms.
- **Column head** (700, 12.5px, 0.1em, caps): table headers.
- **Body** (400, 15px, 1.5): interface text, table cells (14px), feed entries (13.5px).
- **Prose** (400, 15.5px, 1.65, max 68ch, sentence case, paragraphs preserved): the team's analysis.
- **Meta** (400, 12.5px, muted): dates, sources, hints, sub-lines.

### Named Rules
**The Two Registers Rule.** Labels, numerals and headers are Barlow Condensed caps; analysis prose and any sentence a reader must parse is regular Barlow in sentence case. Never set analysis in condensed caps.

**The Tabular Figures Rule.** Every count, score, date and day counter uses tabular lining figures, right-aligned in numeric columns.

## Layout

A centered 1400px container with 24px gutters (16px under 640px). The matrix view stacks a 56px black shell bar, the full-width cue band, a sticky 2px-ruled filter row, then a grid of ruled panels at an 18px gap: the matrix table beside a 340px change feed, then chart panels in a 2:1 row and a three-up row. Breakpoints at 1180px (feed drops below, charts go two-up, cue band wraps to two columns), 860px (single column), 760px (table rows become stacked cards, segments go full width), and 640px.

Density is deliberate: table cells pad 8px by 12px, panel bodies 16px, panel headers 9px by 16px. The procedure card is a 440px right drawer; on wide screens it docks under the shell and the page reflows beside it, hiding cosponsor columns and cue descriptions to keep the table readable. Selecting a row lifts it onto cue wash and dims every other row to muted, with step boxes and type dots at 45% opacity.

## Elevation & Depth

Flat by construction. Resting surfaces carry no shadow; depth comes from 2px ink rules, the well-toned header strip, and the shell's black. Shadows appear only on layers that float over the page, and they are soft and ambient, never offset.

### Shadow Vocabulary
- **Drawer** (`box-shadow: -18px 0 48px rgba(0, 0, 0, .18)`): the undocked procedure card; removed when docked.
- **Modal** (`box-shadow: 0 24px 64px rgba(0, 0, 0, .28)`): the editing dialog over a 45% scrim.
- **Toast** (`box-shadow: 0 12px 32px rgba(0, 0, 0, .28)`): save confirmations on shell black with a 2px cue-yellow border; failures switch to a dashed shell-ink border, never red.
- **Tooltip** (`box-shadow: 0 10px 28px rgba(0, 0, 0, .16)`): chart and score tooltips.

### Named Rules
**The Ruled Not Raised Rule.** If it sits in the page, it is a ruled box with no shadow. Only the drawer, modal, toast and tooltip float.

## Shapes

Square corners on every surface, input, button, tag, step box and badge (0px). The only curves are functional: the 4px rounded end of a horizontal chart bar or stacked bar, and the circular live-status pulse. Borders follow a three-weight system: 2px ink rules for structure (panels, inputs, buttons, step boxes, table head), 1.5px for small outlines (tags, signal chips, tab counts, shell controls), 1px hairlines between rows. Dashed outlines mark negative signals and the step where a dead item stopped.

The hazard stripe is the world's own caution device: a 10px band of 9px diagonal stripes (cue yellow on shell black for CAUTION and NOTE; critical red on laminate for WARNING) heading a caution block, and nowhere else.

### Named Rules
**The Two-Pixel Rule.** Structure is drawn in 2px ink. If a container needs separating, rule it; do not round it, tint it, or shadow it.

## Components

### Buttons
- **Shape:** square (0px), 2px rule border, Barlow Condensed 700 14px caps at 0.08em.
- **Default:** laminate face, ink text, 7px 14px padding; hover fills with well. Small variant 4px 10px at 13px.
- **Primary:** ink face and border with card-stock text; hover lightens to graphite.
- **Ghost toggle:** 3px 10px, 12.5px caps; pressed state fills with ink.
- **In the shell:** transparent with a shell-muted border that brightens to shell-ink on hover; focus outline switches to cue yellow.
- **Disabled:** 50% opacity.

### Chips
- **Filter chips:** cue-yellow blocks with ink text and a bold value, a 18px close cell that darkens on hover; "clear" is a plain underlined link.
- **Flags and fresh tags:** cue-yellow condensed caps (700, 11.5 to 12px) with a small alert triangle; on dimmed rows they fall back to well and graphite.
- **Tags and signals:** 1.5px hairline outline, 12 to 12.5px Barlow; negative signals use a dashed axis-gray border.

### Cards / Containers
- **Corner Style:** square (0px).
- **Background:** laminate, with a well header strip ruled off by 2px.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 2px rule.
- **Internal Padding:** 16px sides and bottom; header 9px 16px.

### Inputs / Fields
- **Style:** laminate, 2px rule border, square, 36px tall in the filter row; editing fields use 15px Barlow with 8px 10px padding. Labels above are 12.5px condensed caps, with sentence-case helper text in muted Barlow.
- **Focus:** native outline removed in favor of a 3px cue-yellow halo (`box-shadow: 0 0 0 3px` cue).
- **Checkboxes:** custom square 16px boxes with a 2px ink border, filling ink with a card-stock check when checked.
- **Selects and segments:** condensed caps; the segmented control is a 2px-ruled tray whose pressed option fills with ink.

### Navigation
- **Shell bar:** 56px black bar with the product name in condensed caps (the word "Tracker" in cue yellow), Matrix and Watchlist tabs, live check status, account and theme controls.
- **Tabs:** 15px condensed caps in shell-muted, brightening on hover; the current tab takes shell-ink and a 3px cue-yellow inset underline. Counts sit in 1.5px outlined boxes. Under 900px the tabs wrap to a full-width second row.

### Cue Band
The signature strip under the shell: a full-bleed cue-yellow band with a shell-black header block ("CUE / NOW"), then three or four count buttons (30px 800 numeral plus a Barlow sentence) separated by 2px translucent-ink rules, and a condensed-caps summary at the right. The active cue inverts to shell black with yellow text. Wraps to two columns at 1180px and 640px.

### Procedure Checklist
The stage, drawn at one fixed scale on every row: a run of 17px square boxes with 2px ink borders and a 3px gap. Completed steps fill ink with a check; the current step fills cue yellow with a shell border; later steps are empty boxes with their number; where a withdrawn or died item stopped is a dashed box with an X, and the whole run greys to bar-muted. In the procedure card the same logic expands into a numbered, ruled list with 20px boxes, the current row in full cue yellow and its box in shell black carrying a play mark.

### Caution Block
A 2px shell-ruled box headed by the hazard stripe, carrying review flags and comment-period notices. The label (CAUTION, NOTE, WARNING) is 800 14px condensed caps at 0.12em; the body is 14px Barlow sentence case. WARNING (seven days or fewer) switches the stripe and label to critical red.

### Deadline Counter
A 54px ruled box with a 22px day count over a 10.5px caps unit, beside the item name and a 4px progress track. Urgent counters fill cue yellow; closing counters fill critical red with alert-ink type.

### Card Tab
A solid block in the item's type color, 13px 700 condensed caps, at the head of the procedure card identity line; the legislation tab uses the deeper tab-legislation step with tab-legislation-ink, regulatory green and executive orange carry ink text.

### Bilateral Timeline
For bills, House events sit right-aligned to the left of a 74px center date spine and Senate events to the right; the spine is a well-toned column ruled 2px on both sides, and major dates fill cue yellow.

## Do's and Don'ts

### Do:
- **Do** rule every in-page container in 2px ink and keep every corner square.
- **Do** reserve cue yellow for the present: current step, cue band, selection, fresh and flagged items, input focus.
- **Do** set labels, numerals and headers in Barlow Condensed caps and all analysis in regular Barlow sentence case at 15.5px/1.65 within 68ch.
- **Do** use tabular figures for every count, score and date.
- **Do** draw any stage as the fixed-scale procedure checklist: ink for done, cue yellow for current, empty boxes for later.
- **Do** take chart and type colors only from the fixed data palette, in their validated roles and per-mode values, with a text label beside every color mark.
- **Do** give every status a date and a source line in muted meta type.

### Don't:
- **Don't** re-theme, re-order or repurpose the data palette, or use legislation blue for links.
- **Don't** use critical red for anything but deadlines; inside the cue band it stays #D03B3B in both modes.
- **Don't** round corners, add pastel status pills, or build KPI tiles; counts live in the ruled figure strip or the cue band.
- **Don't** add shadows to resting panels; only the drawer, modal, toast and tooltip float.
- **Don't** use the hazard stripe outside a caution block.
- **Don't** set analysis prose in condensed caps.
- **Don't** invert dark mode; keep the cue yellow and the card structure, and switch every token to its `-dark` sibling.
