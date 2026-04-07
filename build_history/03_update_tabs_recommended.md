# COWORK INSTRUCTIONS — UPDATE 2
## Rosco Calculator HTML — Tab Restructure + Rosco Recommended Tab

**File to edit:** `rosco_calculator.html`  
**Location:** `C:\Users\Claytron\Rosco Guitars Ltd\Rosco Guitars - Documents\09. Rosco AI\RG String Calculator\`

---

## OVERVIEW OF CHANGES

1. **Reorder tabs** — new order: Rosco Recommended → Custom Set Builder → Tension Calculator → Reverse Gauge Finder
2. **Rename "Set Builder"** → "Custom Set Builder"
3. **Fix 7/8-string auto-gauge** — when switching to 7 or 8 strings, auto-populate the closest gauge to Rosco tension targets
4. **Add new "Rosco Recommended" tab** — simple 3-field lookup that displays the matching Rosco pack from the JSON

---

## CHANGE 1 — REORDER AND RENAME TABS

Change the tab bar so tabs appear in this order:
1. Rosco Recommended *(new — see Change 4)*
2. Custom Set Builder *(was "Set Builder")*
3. Tension Calculator *(unchanged)*
4. Reverse Gauge Finder *(unchanged)*

Update all tab button labels and their corresponding `data-tab` attributes to match.

---

## CHANGE 2 — FIX 7/8-STRING AUTO-GAUGE IN CUSTOM SET BUILDER

**Problem:** When user switches from 6 to 7 or 8 strings, the new string rows appear blank or with wrong gauges. They should auto-populate with the gauge closest to the Rosco tension target for that string position.

**Rosco tension targets by string number:**
```
String 1 (high): 13.5 lbs — Plain
String 2:        14.5 lbs — Plain
String 3:        15.5 lbs — Plain (wound if gauge > 19, then target 16.0 lbs)
String 4:        18.0 lbs — Wound
String 5:        19.0 lbs — Wound
String 6:        20.0 lbs — Wound
String 7:        21.0 lbs — Wound
String 8:        22.0 lbs — Wound
```

**How to find closest gauge:**

Use the tension formula: `T = (UW × (2 × L × F)²) / 386.4`

Rearranged to find unit weight: `UW = (T × 386.4) / (2 × L × F)²`

Then find the gauge in the unit weight table (from `rosco_string_engine.json`) whose unit weight is closest to the calculated target UW. Use the plain steel series for strings 1–3 and nickel wound for strings 4–8.

**When this runs:**
- On page load (initial 6-string default should already work — verify it does)
- Whenever the user changes the string count selector (6 → 7 → 8 and back)
- Whenever the user changes the scale length field
- Whenever the user changes a note in a row (recalculate that row's closest gauge)

**Note:** The Plain/Wound toggle for each row should be set automatically based on string number (strings 1–3 = Plain, strings 4–8 = Wound) when switching string counts. The user can still manually override it.

---

## CHANGE 3 — ADD "ROSCO RECOMMENDED" TAB (NEW FIRST TAB)

This is the customer-facing tab. Keep it dead simple.

### Layout

```
┌─────────────────────────────────────────┐
│  🎸 Rosco Recommended                   │
│  Find your perfect tension-balanced set │
│                                         │
│  Strings:  [ 6 ▾ ]  (options: 6, 7, 8) │
│                                         │
│  Scale Length: [ 25.5 ▾ ]              │
│  (options: 24.75, 25, 25.5, 26.5,       │
│   27, 27.7 — show as "24.75″" etc)     │
│                                         │
│  Tuning: [ E Standard ▾ ]              │
│  (see full list below)                  │
│                                         │
│  [  Find My Pack  ]   ← teal button    │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  RESULTS CARD (appears below)    │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Tuning Dropdowns

The tuning dropdown must be **filtered by string count**. When user selects 6 strings, only show 6-string tunings. When they select 7, show 7-string tunings, etc.

Build the tuning list dynamically from the packs in `rosco_string_engine.json` — read whatever packs exist and group them by string count. Do not hardcode the list.

Display only the tuning name (e.g. "E Standard", "Drop D") — not the full match key. Deduplicate so each tuning name appears only once per string count.

### Lookup Logic

When user clicks "Find My Pack":

1. Build the match key: `{scale×100}-{Tuning}-{strings}`  
   Example: scale=25.5, tuning="Drop D", strings=6 → key = `2550-Drop D-6`
2. Look up that key in `rosco_string_engine.json` under the `packs` array
3. If found → show the Results Card
4. If not found → show a friendly "not yet available" message:  
   > *"This combination isn't in our pack library yet — try the Custom Set Builder to dial in your own, or contact us and we'll add it."*

### Results Card

When a pack is found, display a clean card:

```
┌─────────────────────────────────────────────────┐
│  ✓  E Standard — 25.5" — 6 String              │
│     Rosco Tension-Balanced Set                  │
├──────┬────────┬───────┬────────┬────────────────┤
│  #   │  Note  │  Type │  Gauge │  Tension       │
├──────┼────────┼───────┼────────┼────────────────┤
│  1   │  E4    │  PL   │  .009  │  13.1 lbs  ✓  │
│  2   │  B3    │  PL   │  .0125 │  14.2 lbs  ✓  │
│  3   │  G3    │  PL   │  .0165 │  15.6 lbs  ✓  │
│  4   │  D3    │  NW   │  .026  │  18.4 lbs  ✓  │
│  5   │  A2    │  NW   │  .036  │  19.0 lbs  ✓  │
│  6   │  E2    │  NW   │  .049  │  19.7 lbs  ✓  │
└──────┴────────┴───────┴────────┴────────────────┘
│  Overall balance: ●●●●● Excellent               │
└─────────────────────────────────────────────────┘
```

**Column details:**
- **#** — string number (1 = highest pitch)
- **Note** — the note for this string in the selected tuning
- **Type** — PL (plain) or NW (nickel wound)
- **Gauge** — formatted as `.009`, `.0125`, `.026` etc (leading dot, no zero before decimal for gauges < .010)
- **Tension** — calculated using the formula `T = (UW × (2 × L × F)²) / 386.4` — show 1 decimal place + "lbs"
- **Status icon** — ✓ green if within ±1.5 lbs of Rosco target, ⚠ yellow if ±3 lbs, ✗ red if outside that

**Overall balance line:**
- Calculate average deviation from targets across all strings
- Avg deviation < 1 lb → "●●●●● Excellent"
- < 2 lbs → "●●●●○ Very Good"
- < 3 lbs → "●●●○○ Good"
- Otherwise → "●●○○○ Fair"

Use Rosco teal `#2cd5c4` for the checkmarks and positive indicators.

---

## TUNING LIST FOR DROPDOWNS

These are all the tunings to support. Build the dropdown dynamically from the JSON, but here is the complete list for reference. When packs aren't in the JSON yet, just skip them (they won't appear until Cowork adds them in a later session).

**6-string:**  
E Standard, D# Standard, D Standard, C# Standard, C Standard, B Standard, A# Standard, A Standard, G# Standard, G Standard, Drop D, Drop C#, Drop C, Drop B, Drop A#, Drop A, Drop G#, Drop G, Drop F#, Drop F

**7-string:**  
B Standard, A# Standard, A Standard, G# Standard, G Standard, F# Standard, Drop A, Drop G#, Drop G, Drop F#, Drop F, Drop E

**8-string:**  
F# Standard, F Standard, E Standard, D# Standard, D Standard, Drop E, Drop D#, Drop D, Drop C#, Drop C, Drop B

---

## IMPORTANT NOTES FOR COWORK

- The JSON file (`rosco_string_engine.json`) already exists in the same folder. The HTML reads it via a local file reference. **Do not change how the JSON is loaded.**
- All changes are to the HTML file only.
- Test each tab after changes to make sure existing Tension Calculator and Reverse Gauge Finder tabs still work correctly.
- The "Find My Pack" button and results card should feel polished — same dark card style as the rest of the tool, teal accent for positive results.
- The tab that is active on first load should be **Rosco Recommended**.

---

*Instruction doc prepared by: Chat session, March 2026*  
*Next step: Open rosco_calculator.html in VS Code or text editor and apply all changes above*
