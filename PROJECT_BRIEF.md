# RG String Calculator — Project Brief
*Last updated: April 4, 2026*

---

## The Vision

Build a web-based string tool for Rosco Guitars that does two things:

1. **The Rosco Set Recommender** — Tell the tool what guitar scale length you have and what tuning you want, and it recommends the exact Rosco curated string set (with D'Addario part numbers and gauges) that will hit the right tension targets per string. This is Rosco's IP — the curated, tension-balanced approach that separates Rosco from just buying a random pack.

2. **The Custom Set Builder** — A live price-building tool where a player can pick individual gauges string-by-string, see tension values update in real time, and hit "Buy" or "Subscribe" to order directly. The price updates dynamically as they build. Think D'Addario's string selector but branded Rosco, living on the Rosco website, with buy-through integrated.

These two tools can live as one cohesive product — start with the Recommender, let power users dive into the Custom Builder, and every path ends at checkout.

---

## The Rosco String Philosophy

> *"Buttery smooth highs. Tight, focused lows."*

Rosco sets use **Progressive Tension** — not flat balanced tension, not gauge-matched. Each string is tuned to a progressively higher target as you move to the lower strings. Higher strings are easier for lead work and vibrato; lower strings are a tight, high-impedance anchor for heavy rhythm and low-action setups without string excursion. This is the **Rosco Signature Feel**.

---

### Guitar Tension Ladder (6/7/8-string)

| String | Target (lbs) | Type | Notes |
|--------|-------------|------|-------|
| 1 (high e) | 13.5 | Plain | |
| 2 (B) | 14.5 | Plain | |
| 3 (G) | 15.5 | Plain | Wound if gauge >19p → target becomes 16.0 lbs |
| 4 (D) | 18.0 | Wound | |
| 5 (A) | 19.0 | Wound | |
| 6 (E) | 20.0 | Wound | |
| 7 (low B) | 21.0 | Wound | 7-string |
| 8 (low F#) | 22.0 | Wound | 8-string |

**Guitar Tolerance Bands:** ±1.5 lbs = OK (teal) / ±3.0 lbs = Warning (orange) / outside ±3.0 = Critical (red)

**Drop Tuning Rule (guitar):** The lowest string targets the *next* string number's tension value to compensate for the lower pitch and reduced stiffness (e.g. string 6 in Drop D targets 21 lbs instead of 20; string 7 in a 7-string Drop tuning targets 22 lbs).

---

### Bass Tension Ladder (4/5-string)

| String | Target (lbs) | Notes |
|--------|-------------|-------|
| 1 (high G) | 32.0 | Playable top-end |
| 2 (D) | 34.0 | |
| 3 (A) | 36.0 | |
| 4 (E / low D) | 38.0 | |
| 5+ (B / A / low) | 40.0 | Tight anchor |

**Bass Tolerance Bands:** ±3.0 lbs = OK (teal) / ±7.0 lbs = Warning (orange) / outside ±7.0 = Critical (red)

**Drop Tuning Rule (bass):** The lowest string always targets 40.0 lbs regardless of string count, to anchor the dropped interval with maximum stability.

---

Standard guitar sets use 3 plain / 3 wound. For tunings C Standard and lower (where hitting target tension requires >19p on string 3), that string switches to wound.

---

## The Physics (What the Tool Needs to Calculate)

String tension is calculable with the following formula:

```
T = (UW × (2 × L × F)²) / 386.4
```

Where:
- `T` = Tension in pounds
- `UW` = Unit weight of the string (lbs/inch) — provided by D'Addario in their spec sheets
- `L` = Scale length in inches (e.g. 25.5", 24.75", 27", etc.)
- `F` = Frequency of the note in Hz (e.g. E4 = 329.63 Hz)
- `386.4` = gravitational constant conversion

To find the **correct gauge** for a target tension, you invert this: given a scale length, target note, and target tension, solve for the required unit weight, then look up which D'Addario string matches.

---

## Tool Components — Feature List

### Component 1: Rosco Set Recommender

**Inputs:**
- Scale length (dropdown or free entry — common values: 24.75", 25", 25.5", 26.5", 27", 28")
- String count (6, 7, 8)
- Target tuning (dropdown — presets like E Standard, Eb, D, C#, C, B, A, Drop D, Drop C, Drop B, Drop A, Drop Ab, Drop G, Drop F#, Drop F, Drop E... all the way down)

**Output:**
- Recommended Rosco set (string by string)
- Gauge per string
- D'Addario part number per string
- Calculated tension per string at that scale/tuning
- "Add to Cart" button linking to the matching pre-built Rosco pack on the store

**Backend logic:**
- Look up pre-built Rosco packs already designed by Clayton (need all these uploaded)
- If no exact match, either interpolate or show nearest match
- Flag if a string is borderline (e.g., string 3 crossing the wound threshold)

---

### Component 2: Custom Set Builder

**Inputs:**
- Scale length
- String count
- Per-string note selection (or just set the full tuning)
- Per-string gauge selection (dropdown filtered by what makes sense for the target tension)

**Live-updating display:**
- Tension value per string, colour-coded vs Rosco targets (green = good, yellow = close, red = off)
- Total set price (updates in real time as gauges change)
- D'Addario part numbers selected

**Output:**
- Full custom set summary
- "Buy This Set" → checkout
- "Subscribe" → recurring order option
- Optional: "Save My Set" (user account or shareable link)

---

### Component 3: Price Engine

**Logic:**
- Each individual string maps to a D'Addario part number + cost price
- Retail price per string derived from cost (need margin rules confirmed)
- Set price = sum of individual string prices
- Shipping: under $100 order = customer pays; $100+ = free shipping
- VIP/Artist 15% discount code support

---

## What's In the Workspace

| File | Status | Notes |
|------|--------|-------|
| `rosco_pack_generator.html` | ✅ **PRIMARY TOOL (V2)** | The main tool — open this one |
| `data/rosco_string_engine.json` | ✅ **Built Mar 10** | Source-of-truth data engine |
| `source_data/DAddario Strings Catalogue - 2025.pdf` | ✅ Available | Full catalogue with string specs |
| `source_data/Daddario catalogue Other_2025.pdf` | ✅ Available | Additional catalogue data |
| `source_data/Daddario Price List - March-2025.xlsx` | ✅ Available | Pricing data |
| `build_history/rosco_calculator_v1_archived.html` | 🗄️ Archived | V1 calculator — superseded by pack generator |

---

## Build Progress

### Phase 1 — Data Foundation ✅ COMPLETE
**Delivered: `rosco_string_engine.json` (March 10, 2026)**

The full tension engine is built and live. It contains:

- **344 Rosco string packs** — every combination of scale length × tuning × string count
- **8 scale lengths covered:** 24.75", 25", 25.5", 26.5", 27", 27.75", 28", 29"
- **24 tunings covered:** E Standard through the full drop tuning range (Drop A, Drop A#, Drop B, Drop C… all the way down), plus non-standard standards
- **6-string, 7-string, and 8-string** packs all included
- **59 note frequencies** (E4 down to B0) — full chromatic range
- **D'Addario unit weights** — plain steel (PL series), nickel wound (NW series), and interpolated values
- **Rosco tension targets** built in for all string counts
- **Gauge → Part number** mapping (55 entries)

The tension formula (`T = (UW × (2 × L × F)²) / 386.4`) is embedded and drives all recommendations.

---

### Phase 2 — Recommender Logic ✅ COMPLETE
Built directly into the HTML tool. The engine reads `rosco_string_engine.json` and resolves any scale/tuning input to the correct Rosco pack.

---

### Phase 3 — Web Tool (Front End) 🔄 IN PROGRESS
**V1: `rosco_calculator.html` — archived (March 10, 2026)**
**V2: `rosco_pack_generator.html` — current primary tool (April 2026)**

The pack generator is the active tool. It outputs a styled pack card (scale, tuning, gauge/note/tension per string, QR code) and lets the user configure string count, scale, tuning, and individual gauges.

The V1 calculator (four-tab layout with Recommender, Custom Builder, Tension Calc, Reverse Gauge Finder) has been archived in `build_history/` for reference.

---

### Phase 4 — Store Integration ⏳ NOT STARTED
- Connect "Buy" / "Subscribe" buttons to Shopify (or current platform)
- Test full purchase flow

---

## Open Questions for Clayton

**Data / Product:**
- [ ] Confirmation of which D'Addario string lines Rosco is sourcing from (EXL? NYXL? NW + PL singles?) — affects part number accuracy in the tool
- [ ] Is there a separate price per individual string for the custom builder, or does Rosco only sell full pre-built packs?
- [ ] For 7-string and 8-string — are those packs already validated by Clayton, or just calculated from the tension formula?
- [ ] What should happen when someone inputs a scale/tuning combo with no exact Rosco pack match? Show nearest? Show "coming soon"?
- [ ] Subscribe option — is Shopify subscription already set up, or does this need to be built?

**Design / UX:**
- [ ] Does the tool live on the existing Rosco website, or is it a new standalone page/subdomain?
- [ ] Mobile-first or desktop-first?
- [ ] Any specific refinements or issues to fix in the current HTML version?

**Store Integration:**
- [ ] Store/website platform (Shopify? Wix? Other?) — affects how the tool integrates at checkout
- [ ] "Add to Cart" / "Buy This Set" — what URL format does the store use for cart links?

---

## Competitive Landscape

- **D'Addario String Tension Calculator** — the main comp. Lets you select string and see tension, but doesn't guide you toward a set based on feel/tuning goals.
- **Contriver Guitars** — only other brand doing tension-curated sets Clayton has found. Tensions are tighter than Rosco's targets. (Note from Clayton: "Good to see. But his tensions are a bit tighter for sure.")
- **Opportunity:** No one has a tension-first recommender that goes from "I play in Drop B on a 26.5" guitar" directly to "here's your pack, add to cart." That's the gap.

---

## Notes & Vibes

This isn't just a calculator. It's a marketing tool. Every person who uses it is being educated on why Rosco strings are different — they're seeing the tension values, they're understanding why gauge alone doesn't tell the whole story. By the time they hit "Buy," they know exactly why they're buying a curated set instead of just grabbing whatever's at the guitar shop.

The tool should feel confident, clean, and fast. Rosco brand. No clutter.

---

*Updated by Claude — April 4, 2026. Pack generator (V2) is now the primary tool. V1 calculator archived. Phase 3 refinement ongoing. Phase 4 store integration not yet started.*
