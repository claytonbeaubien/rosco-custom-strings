# COWORK INSTRUCTIONS — UPDATE 3
## Rosco Calculator HTML — Plain/Wound Rules + Labeling

**File to edit:** `rosco_calculator.html`  
**Location:** `C:\Users\Claytron\Rosco Guitars Ltd\Rosco Guitars - Documents\09. Rosco AI\RG String Calculator\`

---

## BACKGROUND — THE PROBLEM

D'Addario makes four gauges that exist in **both** plain steel and nickel wound versions:

| Gauge | Available as Plain? | Available as Wound? |
|-------|--------------------|--------------------|
| .017  | ✅ PL017           | ✅ NW017           |
| .018  | ✅ PL018           | ✅ NW018           |
| .019  | ✅ PL019           | ✅ NW019           |
| .020  | ✅ PL020           | ✅ NW020           |

A customer seeing ".017" on their set does NOT know if it's plain or wound without a label. These are meaningfully different strings — different tension, different feel, different sound.

**All other gauges below .017 are plain-only. All gauges above .020 are wound-only.** No ambiguity there.

---

## CHANGE 1 — PLAIN/WOUND ASSIGNMENT RULES

Implement these rules everywhere gauge is selected or displayed (Rosco Recommended tab, Custom Set Builder tab, and any calculation output):

### Standard rule (strings 1–3 = plain, strings 4–8 = wound)

For tunings **C Standard and higher** (i.e., E, D#, D, C# Standard, Drop D, Drop C#, Drop C, and all higher-pitched tunings):
- String 3 will land at or below gauge .019 → **use plain steel, target tension 15.5 lbs**

For tunings **below C Standard** (B Standard, A#, A, G#, G Standard and all Drop tunings in that range):
- String 3 will require gauge .020 or higher to hit target tension → **use nickel wound, target tension switches to 16.0 lbs**

### The rule in code

```
function getStringType(stringNumber, gauge) {
  if (stringNumber <= 2) return 'plain';
  if (stringNumber >= 4) return 'wound';
  
  // String 3 — check gauge
  const gaugeValue = parseFloat(gauge); // e.g. 0.020
  if (gaugeValue > 0.019) {
    return 'wound'; // target tension for this string = 16.0 lbs
  } else {
    return 'plain'; // target tension for this string = 15.5 lbs
  }
}
```

The tension target used for string 3's status dot/check should update accordingly:
- Plain string 3 → target = 15.5 lbs
- Wound string 3 → target = 16.0 lbs

---

## CHANGE 2 — LABELING AMBIGUOUS GAUGES

Wherever a gauge in the range .017–.020 is displayed, **always show the type label alongside it**.

### In the Rosco Recommended results card:

The TYPE column already exists. For gauges .017–.020, append **p** or **w** directly to the gauge number so it reads as one compact unit. Remove the separate TYPE column for these rows and instead show it inline:

| # | Note | Gauge | Tension |
|---|------|-------|---------|
| 3 | G3   | .017**p** | 15.2 lbs ✓ |

or for a lower tuning:

| # | Note | Gauge | Tension |
|---|------|-------|---------|
| 3 | F#3  | .020**w** | 16.1 lbs ✓ |

Style: the `p` or `w` suffix should be the same teal colour as the gauge number, slightly smaller font (e.g. 0.8em), so it reads as `.020w` — compact and clear.

For all other gauges (outside .017–.020), show the gauge number only with no suffix — no ambiguity needed.

### In the Custom Set Builder:

Each row has a Plain/Wound toggle. For gauges .017–.020, show the suffix inline next to the gauge value in that row's display:

- e.g. the gauge field shows `.019p` or `.019w` based on the current toggle state
- When the user manually flips the toggle, the suffix updates live
- The suffix is the same small teal style as above

---

## CHANGE 3 — FIX STRING 3 WOUND THRESHOLD BUG (CRITICAL)

**The bug:** String 3 is currently finding the closest plain gauge to the 15.5 lb target and displaying it — even when that gauge is .020 or above. It should NEVER display a plain .020 (or higher). The fix is a two-pass selection process.

**The current broken behaviour seen:** A# Standard 26.5" shows string 3 as `.020p` at 12.4 lbs. This is wrong — .020 plain cannot hit the tension target AND violates the Rosco rule. It must switch to wound.

### Correct two-pass logic for string 3 (replace the existing string 3 gauge selection code entirely):

```javascript
function selectString3Gauge(scaleLengthInches, noteFreqHz, unitWeights) {
  // PASS 1: Try plain steel
  // Calculate required unit weight to hit 15.5 lbs target
  const targetTensionPlain = 15.5;
  const requiredUW_plain = (targetTensionPlain * 386.4) / Math.pow(2 * scaleLengthInches * noteFreqHz, 2);
  
  // Find closest plain steel gauge
  const closestPlain = findClosestGauge(requiredUW_plain, unitWeights.plain_steel);
  
  // CHECK: Is that gauge > .019?
  if (parseFloat(closestPlain.gauge) > 0.019) {
    // PASS 2: Switch to wound, retarget at 16.0 lbs
    const targetTensionWound = 16.0;
    const requiredUW_wound = (targetTensionWound * 386.4) / Math.pow(2 * scaleLengthInches * noteFreqHz, 2);
    const closestWound = findClosestGauge(requiredUW_wound, unitWeights.nickel_wound);
    return { gauge: closestWound.gauge, type: 'wound', target: 16.0 };
  } else {
    return { gauge: closestPlain.gauge, type: 'plain', target: 15.5 };
  }
}
```

**This logic must apply in ALL three of these places:**
1. Custom Set Builder — when auto-selecting gauges on load, string count change, scale change, or note change
2. Rosco Recommended tab — when calculating/displaying a pack that isn't pre-stored in the JSON (dynamic calculation path)
3. Any reverse calculation that touches string 3

**For pre-stored JSON packs** (Rosco Recommended tab displaying a pack from the JSON file): the pack data already contains the correct gauge and type. Trust the JSON data — do not re-run the selection logic on top of it. Just display what the JSON says. The JSON was built correctly.

---

## CHANGE 4 — GAUGE DISPLAY FORMATTING (ALL GAUGES)

**Bug seen:** `.020` is being displayed as `.02` — the trailing zero is dropped.

**Rule:** All gauges must display with consistent decimal places. Specifically:

- Gauges with 3 decimal places: always show all 3 → `.009`, `.017`, `.020`, `.024`, `.036`, `.049`
- Gauges with 4 decimal places: always show all 4 → `.0095`, `.0105`, `.0115`, `.0125`, `.0135`, `.0155`, `.0165`

**Never strip trailing zeros from gauge values.**

Implement a formatting function used everywhere a gauge is displayed:

```javascript
function formatGauge(gauge) {
  // gauge is stored as a number like 0.020 or 0.0125
  // Convert to string with correct decimal places
  const str = gauge.toString();
  // If it has 4+ decimal digits already, return as-is
  // If it has 3 decimal digits, pad to 3 (don't strip trailing zero)
  // Always drop the leading zero: 0.020 → .020
  
  // Simple approach: use toFixed based on the gauge value
  if (gauge < 0.010) {
    return '.' + gauge.toFixed(4).slice(2); // .0095, .0105 etc
  } else {
    return '.' + gauge.toFixed(3).slice(2); // .017, .020, .036 etc
  }
}
```

Apply this `formatGauge()` function everywhere a gauge number is rendered in the HTML.

---

## CHANGE 4 — UPDATE THE ROSCO RECOMMENDED PACK DISPLAY

When displaying a pack from the JSON, the TYPE field for each string comes from the pack data itself (it's already stored). However, apply this additional rule when rendering:

- If string type is 'plain' or 'wound' AND gauge is in range .017–.020 → make the TYPE label **bold and full brightness** (not dimmed like the other NW labels currently are)
- Add a tooltip or small note on hover for these gauges: `"Available as both plain and wound — this set uses [plain/wound]"`

---

## SUMMARY OF WHAT TO CHECK AFTER CHANGES

1. **E Standard 25.5" 6-string** → string 3 = `.0165p`, ~15.5 lbs ✓
2. **A# Standard 26.5" 6-string** → string 3 MUST be wound. Should show something like `.020w` or `.021w` at ~16.0 lbs. The old broken result was `.020p` at 12.4 lbs — that must be gone.
3. **B Standard 25.5" 6-string** → string 3 borderline — check which side of .019 it lands on and verify the rule fires correctly
4. **A Standard 26.5" 6-string** → string 3 should be wound, ~16.0 lbs target ✓
5. **All gauges** → `.020` must display as `.020` not `.02`. `.0125` must display as `.0125` not `.012` or `.0125`. Check several packs for consistent formatting.
6. **p/w suffix** → any gauge .017–.020 should show the suffix. `.020w` ✓ `.017p` ✓. Gauges outside this range show no suffix.

---

*Instruction doc prepared by: Chat session, March 2026*
