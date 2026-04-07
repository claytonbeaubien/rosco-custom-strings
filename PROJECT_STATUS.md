# RG String Calculator — Project Status
*Last updated: April 4, 2026*
*This is the single source of truth for the current state of the string tool project.*

---

## Current State

**Status: 🔄 Phase 3 (Front End) active — Pack Generator is the primary tool. Phase 4 (Store Integration) not started.**

The Pack Generator (`rosco_pack_generator.html`) is now the primary tool. It replaced the earlier calculator (V1) which is archived. The JSON engine exists as a source-of-truth reference; the pack generator has all data embedded.

---

## Working Files

```
rosco_projects\RG String Calculator\
├── rosco_pack_generator.html          ← ✅ PRIMARY TOOL (V2) — open this
├── Images\                            ← background images referenced by pack generator
├── Notes.csv                          ← general notes
├── data\
│   ├── rosco_string_engine.json       ← source-of-truth data engine (reference)
│   └── Rosco Guitars Logo.png         ← logo asset
├── source_data\
│   ├── DAddario Tension Chart.pdf
│   ├── DAddario Strings Catalogue - 2025.pdf
│   ├── Daddario catalogue Other_2025.pdf
│   └── Daddario Price List - March-2025.xlsx
└── build_history\
    ├── rosco_calculator_v1_archived.html  ← archived V1 calculator (not in use)
    ├── 01_initial_build.md
    ├── 02_update_v1.1_colors_setbuilder.md
    ├── 03_update_tabs_recommended.md
    └── 04_update_plain_wound_rules.md
```

| File | Status | Description |
|------|--------|-------------|
| `rosco_pack_generator.html` | ✅ **PRIMARY** | The main tool — pack generator / recommender (V2) |
| `data/rosco_string_engine.json` | ✅ Reference | Source-of-truth data engine — 344 packs, unit weights, tension targets |
| `build_history/rosco_calculator_v1_archived.html` | 🗄️ Archived | Old V1 calculator — superseded by pack generator |
| `source_data/` | ✅ Source | D'Addario catalogues, price list, tension chart |

---

## Build History

All instruction docs archived in `build_history/` for reference.

| Version | File | What Changed |
|---------|------|-------------|
| v1.0 | `01_initial_build.md` | JSON engine + HTML calculator built. Two tabs: Tension Calculator, Reverse Gauge Finder. |
| v1.1 | `02_update_v1.1_colors_setbuilder.md` | Red → Teal rebrand. Logo added. Set Builder tab added. |
| v1.2 | `03_update_tabs_recommended.md` | Tab order restructured. Rosco Recommended tab added as first tab. |
| v1.3 | `04_update_plain_wound_rules.md` | Plain/wound rules for .017–.020 range. String 3 wound threshold bug fixed. |
| **V2** | `rosco_pack_generator.html` | **Pack Generator replaces calculator as primary tool.** New layout, pack card output, image backgrounds. |

---

## Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Data Foundation — JSON engine | ✅ Complete (March 10) |
| 2 | Recommender Logic | ✅ Complete (March 10) |
| 3 | Web Tool (HTML front end) | 🔄 In progress — pack generator refinement |
| 4 | Store Integration — Shopify buy/subscribe buttons | ⏳ Not started |

---

## Open Questions for Clayton (Phase 4 blockers)

**Product / Pricing:**
- [ ] Which D'Addario string lines is Rosco sourcing? (EXL? NYXL? Singles?) — affects part number accuracy
- [ ] Individual string pricing for Custom Builder, or only full pre-built packs?
- [ ] Are 7-string and 8-string packs validated by Clayton or just tension-calculated?
- [ ] What happens when someone inputs a scale/tuning with no exact pack match — show nearest or "coming soon"?
- [ ] Is Shopify subscription already set up, or does this need to be built?

**Design / UX:**
- [ ] Does the tool live on the existing Rosco website or a new page/subdomain?
- [ ] Mobile-first or desktop-first?
- [ ] Any current issues or refinements needed in the pack generator before moving to Phase 4?

**Store Integration:**
- [ ] What URL format does the Shopify store use for cart links / product pages?
- [ ] What Shopify product IDs exist for current string packs (if any)?

---

## Next Steps

1. Continue refining `rosco_pack_generator.html`
2. Answer open questions above
3. Execute Phase 4 — wire "Buy" / "Subscribe" buttons to Shopify checkout
4. (Long term) Move to web deployment on roscoguitars.com
