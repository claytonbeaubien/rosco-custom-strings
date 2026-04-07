# Cowork Instructions: RG String Calculator Build
*For Claude Cowork — execute these steps in order. Do not skip validation steps.*

---

## Context

We are building the Rosco Guitars string tension calculator engine. This involves:
1. Building a master JSON data file (`rosco_string_engine.json`) containing the D'Addario unit weight table, note frequencies, and Rosco tension targets
2. Building a local HTML calculator (`rosco_calculator.html`) that uses this data — a browser-based tool Clayton can open anytime to calculate string tension without visiting daddario.com

**Both files go in:**
`C:\Users\Claytron\Rosco Guitars Ltd\Rosco Guitars - Documents\09. Rosco AI\RG String Calculator\`

**Source PDF is in the same folder:**
`DAddario_Tension_Chart.pdf` — this contains the unit weight table we need

**Do NOT touch Airtable during this task. Read-only until explicitly instructed otherwise.**

---

## Step 1 — Build `rosco_string_engine.json`

Create a JSON file with the following structure. All unit weight values come from the D'Addario tension chart PDF. All values below are verified correct — use them exactly.

### File: `rosco_string_engine.json`

```json
{
  "meta": {
    "version": "1.0",
    "description": "Rosco Guitars string tension engine — D'Addario XL unit weights + Rosco tension targets",
    "last_updated": "2026-03-10",
    "formula": "T = (UW * (2 * L * F)^2) / 386.4",
    "tension_unit": "lbs",
    "scale_length_unit": "inches"
  },

  "note_frequencies": {
    "E4": 329.63,
    "D#4": 311.13, "Eb4": 311.13,
    "D4": 293.66,
    "C#4": 277.18, "Db4": 277.18,
    "C4": 261.63,
    "B3": 246.94,
    "A#3": 233.08, "Bb3": 233.08,
    "A3": 220.00,
    "G#3": 207.65, "Ab3": 207.65,
    "G3": 196.00,
    "F#3": 185.00, "Gb3": 185.00,
    "F3": 174.61,
    "E3": 164.81,
    "D#3": 155.56, "Eb3": 155.56,
    "D3": 146.83,
    "C#3": 138.59, "Db3": 138.59,
    "C3": 130.81,
    "B2": 123.47,
    "A#2": 116.54, "Bb2": 116.54,
    "A2": 110.00,
    "G#2": 103.83, "Ab2": 103.83,
    "G2": 98.00,
    "F#2": 92.50, "Gb2": 92.50,
    "F2": 87.31,
    "E2": 82.41,
    "D#2": 77.78, "Eb2": 77.78,
    "D2": 73.42,
    "C#2": 69.30, "Db2": 69.30,
    "C2": 65.41,
    "B1": 61.74,
    "A#1": 58.27, "Bb1": 58.27,
    "A1": 55.00,
    "G#1": 51.91, "Ab1": 51.91,
    "G1": 49.00,
    "F#1": 46.25, "Gb1": 46.25,
    "F1": 43.65,
    "E1": 41.20,
    "D#1": 38.89, "Eb1": 38.89,
    "D1": 36.71,
    "C#1": 34.65, "Db1": 34.65,
    "C1": 32.70,
    "B0": 30.87
  },

  "unit_weights": {
    "plain_steel": {
      "comment": "PL series — D'Addario plain steel, Lock Twist. Values in lbs/inch.",
      "PL007": 0.00001085,
      "PL008": 0.00001418,
      "PL0085": 0.00001601,
      "PL009": 0.00001794,
      "PL0095": 0.00001999,
      "PL010": 0.00002215,
      "PL0105": 0.00002442,
      "PL011": 0.00002680,
      "PL0115": 0.00002930,
      "PL012": 0.00003190,
      "PL013": 0.00003744,
      "PL0135": 0.00004037,
      "PL014": 0.00004342,
      "PL015": 0.00004984,
      "PL016": 0.00005671,
      "PL017": 0.00006402,
      "PL018": 0.00007177,
      "PL019": 0.00007997,
      "PL020": 0.00008861,
      "PL022": 0.00010722,
      "PL024": 0.00012760,
      "PL026": 0.00014975
    },
    "nickel_wound": {
      "comment": "NW series — D'Addario XL Nickelplated Steel Round Wound. Values in lbs/inch.",
      "NW017": 0.00005524,
      "NW018": 0.00006215,
      "NW019": 0.00006947,
      "NW020": 0.00007495,
      "NW021": 0.00008293,
      "NW022": 0.00009184,
      "NW024": 0.00010857,
      "NW026": 0.00012671,
      "NW028": 0.00014666,
      "NW030": 0.00017236,
      "NW032": 0.00019347,
      "NW034": 0.00021590,
      "NW036": 0.00023964,
      "NW038": 0.00026471,
      "NW039": 0.00027932,
      "NW042": 0.00032279,
      "NW044": 0.00035182,
      "NW046": 0.00038216,
      "NW048": 0.00041382,
      "NW049": 0.00043014,
      "NW052": 0.00048109,
      "NW054": 0.00053838,
      "NW056": 0.00057598,
      "NW059": 0.00064191,
      "NW060": 0.00066542,
      "NW062": 0.00070697,
      "NW064": 0.00074984,
      "NW066": 0.00079889,
      "NW068": 0.00084614,
      "NW070": 0.00089304,
      "NW072": 0.00094124,
      "NW074": 0.00098869,
      "NW080": 0.00115011
    },
    "interpolated": {
      "comment": "Half-size gauges not in the PDF — unit weights calculated by linear interpolation between adjacent PL values. Used for gauges like 9.5, 10.5, 11.5, 12.5, 16.5.",
      "PL0095_interp": 0.00001999,
      "PL0105_interp": 0.00002442,
      "PL0115_interp": 0.00002930,
      "PL0125_interp": 0.00003467,
      "PL0135_interp": 0.00004037,
      "PL0165_interp": 0.00006037
    }
  },

  "gauge_to_part_number": {
    "comment": "Maps gauge label (as it appears in Airtable) to D'Addario part number prefix and unit weight key. 'w' suffix = wound.",
    "7":    { "type": "plain", "part": "PL007",  "uw_key": "PL007" },
    "8":    { "type": "plain", "part": "PL008",  "uw_key": "PL008" },
    "8.5":  { "type": "plain", "part": "PL0085", "uw_key": "PL0085" },
    "9":    { "type": "plain", "part": "PL009",  "uw_key": "PL009" },
    "9.5":  { "type": "plain", "part": "PL0095", "uw_key": "PL0095" },
    "10":   { "type": "plain", "part": "PL010",  "uw_key": "PL010" },
    "10.5": { "type": "plain", "part": "PL0105", "uw_key": "PL0105" },
    "11":   { "type": "plain", "part": "PL011",  "uw_key": "PL011" },
    "11.5": { "type": "plain", "part": "PL0115", "uw_key": "PL0115" },
    "12":   { "type": "plain", "part": "PL012",  "uw_key": "PL012" },
    "12.5": { "type": "plain", "part": "PL0125", "uw_key": "PL0125_interp" },
    "13":   { "type": "plain", "part": "PL013",  "uw_key": "PL013" },
    "13.5": { "type": "plain", "part": "PL0135", "uw_key": "PL0135" },
    "14":   { "type": "plain", "part": "PL014",  "uw_key": "PL014" },
    "15":   { "type": "plain", "part": "PL015",  "uw_key": "PL015" },
    "16":   { "type": "plain", "part": "PL016",  "uw_key": "PL016" },
    "16.5": { "type": "plain", "part": "PL0165", "uw_key": "PL0165_interp" },
    "17":   { "type": "plain", "part": "PL017",  "uw_key": "PL017" },
    "18":   { "type": "plain", "part": "PL018",  "uw_key": "PL018" },
    "19":   { "type": "plain", "part": "PL019",  "uw_key": "PL019" },
    "20":   { "type": "plain", "part": "PL020",  "uw_key": "PL020" },
    "17w":  { "type": "wound", "part": "NW017",  "uw_key": "NW017" },
    "18w":  { "type": "wound", "part": "NW018",  "uw_key": "NW018" },
    "19w":  { "type": "wound", "part": "NW019",  "uw_key": "NW019" },
    "20w":  { "type": "wound", "part": "NW020",  "uw_key": "NW020" },
    "21w":  { "type": "wound", "part": "NW021",  "uw_key": "NW021" },
    "22w":  { "type": "wound", "part": "NW022",  "uw_key": "NW022" },
    "24w":  { "type": "wound", "part": "NW024",  "uw_key": "NW024" },
    "26w":  { "type": "wound", "part": "NW026",  "uw_key": "NW026" },
    "28w":  { "type": "wound", "part": "NW028",  "uw_key": "NW028" },
    "30w":  { "type": "wound", "part": "NW030",  "uw_key": "NW030" },
    "32w":  { "type": "wound", "part": "NW032",  "uw_key": "NW032" },
    "34w":  { "type": "wound", "part": "NW034",  "uw_key": "NW034" },
    "36":   { "type": "wound", "part": "NW036",  "uw_key": "NW036" },
    "38":   { "type": "wound", "part": "NW038",  "uw_key": "NW038" },
    "39":   { "type": "wound", "part": "NW039",  "uw_key": "NW039" },
    "42":   { "type": "wound", "part": "NW042",  "uw_key": "NW042" },
    "44":   { "type": "wound", "part": "NW044",  "uw_key": "NW044" },
    "46":   { "type": "wound", "part": "NW046",  "uw_key": "NW046" },
    "48":   { "type": "wound", "part": "NW048",  "uw_key": "NW048" },
    "49":   { "type": "wound", "part": "NW049",  "uw_key": "NW049" },
    "50":   { "type": "wound", "part": "NW049",  "uw_key": "NW049" },
    "52":   { "type": "wound", "part": "NW052",  "uw_key": "NW052" },
    "54":   { "type": "wound", "part": "NW054",  "uw_key": "NW054" },
    "56":   { "type": "wound", "part": "NW056",  "uw_key": "NW056" },
    "59":   { "type": "wound", "part": "NW059",  "uw_key": "NW059" },
    "60":   { "type": "wound", "part": "NW060",  "uw_key": "NW060" },
    "62":   { "type": "wound", "part": "NW062",  "uw_key": "NW062" },
    "64":   { "type": "wound", "part": "NW064",  "uw_key": "NW064" },
    "66":   { "type": "wound", "part": "NW066",  "uw_key": "NW066" },
    "68":   { "type": "wound", "part": "NW068",  "uw_key": "NW068" },
    "70":   { "type": "wound", "part": "NW070",  "uw_key": "NW070" },
    "74":   { "type": "wound", "part": "NW074",  "uw_key": "NW074" },
    "80":   { "type": "wound", "part": "NW080",  "uw_key": "NW080" }
  },

  "rosco_tension_targets": {
    "description": "Rosco Guitars target tensions per string position. Philosophy: tension-balanced sets. Buttery smooth highs, tight focused lows.",
    "6_string": {
      "1": { "target_lbs": 13.5, "type": "plain", "note": "High E" },
      "2": { "target_lbs": 14.5, "type": "plain", "note": "B" },
      "3": { "target_lbs": 15.5, "type": "plain", "note": "G — wound if gauge >19p, then target 16 lbs" },
      "4": { "target_lbs": 18.0, "type": "wound", "note": "D" },
      "5": { "target_lbs": 19.0, "type": "wound", "note": "A" },
      "6": { "target_lbs": 20.0, "type": "wound", "note": "Low E" }
    },
    "7_string": {
      "1": { "target_lbs": 13.5, "type": "plain" },
      "2": { "target_lbs": 14.5, "type": "plain" },
      "3": { "target_lbs": 15.5, "type": "plain", "note": "wound if gauge >19p, target 16 lbs" },
      "4": { "target_lbs": 18.0, "type": "wound" },
      "5": { "target_lbs": 19.0, "type": "wound" },
      "6": { "target_lbs": 20.0, "type": "wound" },
      "7": { "target_lbs": 21.0, "type": "wound" }
    },
    "8_string": {
      "1": { "target_lbs": 13.5, "type": "plain" },
      "2": { "target_lbs": 14.5, "type": "plain" },
      "3": { "target_lbs": 15.5, "type": "plain", "note": "wound if gauge >19p, target 16 lbs" },
      "4": { "target_lbs": 18.0, "type": "wound" },
      "5": { "target_lbs": 19.0, "type": "wound" },
      "6": { "target_lbs": 20.0, "type": "wound" },
      "7": { "target_lbs": 21.0, "type": "wound" },
      "8": { "target_lbs": 22.0, "type": "wound" }
    }
  },

  "standard_scale_lengths": [24.75, 25.0, 25.5, 26.5, 27.0, 27.75, 28.0, 29.0],

  "string_packs": {
    "comment": "Generated packs will be added here by Cowork in future steps. Format per pack shown below.",
    "example_format": {
      "pack_id": "2550-E Standard-6",
      "scale_length": 25.5,
      "tuning": "E Standard",
      "string_count": 6,
      "strings": [
        { "string_num": 1, "note": "E4", "gauge": "9",   "type": "plain", "tension_lbs": 13.1 },
        { "string_num": 2, "note": "B3", "gauge": "12.5","type": "plain", "tension_lbs": 14.2 },
        { "string_num": 3, "note": "G3", "gauge": "16.5","type": "plain", "tension_lbs": 15.6 },
        { "string_num": 4, "note": "D3", "gauge": "26w", "type": "wound", "tension_lbs": 18.4 },
        { "string_num": 5, "note": "A2", "gauge": "36",  "type": "wound", "tension_lbs": 19.0 },
        { "string_num": 6, "note": "E2", "gauge": "50",  "type": "wound", "tension_lbs": 19.7 }
      ]
    }
  }
}
```

Save this file to:
`C:\Users\Claytron\Rosco Guitars Ltd\Rosco Guitars - Documents\09. Rosco AI\RG String Calculator\rosco_string_engine.json`

---

## Step 2 — Validate the JSON

Before building the HTML, run a quick Python validation to confirm the formula produces correct results against the known 25.5" E Standard pack.

Run this Python snippet (in terminal or as a script):

```python
import json, math

# Load the engine
with open(r"C:\Users\Claytron\Rosco Guitars Ltd\Rosco Guitars - Documents\09. Rosco AI\RG String Calculator\rosco_string_engine.json") as f:
    engine = json.load(f)

def calc_tension(uw, scale_length, frequency):
    return round((uw * (2 * scale_length * frequency) ** 2) / 386.4, 1)

# Known pack: 25.5" E Standard 6-string
test_strings = [
    ("E4", "PL009",  "plain"),
    ("B3", "PL0125", "plain"),   # interpolated
    ("G3", "PL0165", "plain"),   # interpolated
    ("D3", "NW026",  "wound"),
    ("A2", "NW036",  "wound"),
    ("E2", "NW049",  "wound"),   # NW049 used for gauge 50
]
expected = [13.1, 14.2, 15.6, 18.4, 19.0, 19.7]

print("Validation — 25.5\" E Standard 6-string")
print(f"{'String':<8} {'Note':<6} {'Gauge':<10} {'Calculated':>12} {'Expected':>10} {'Match':>8}")
print("-" * 60)

uw_all = {**engine["unit_weights"]["plain_steel"],
          **engine["unit_weights"]["nickel_wound"],
          **engine["unit_weights"]["interpolated"]}

# Remap interpolated keys
uw_all["PL0125"] = engine["unit_weights"]["interpolated"]["PL0125_interp"]
uw_all["PL0165"] = engine["unit_weights"]["interpolated"]["PL0165_interp"]

scale = 25.5
freqs = engine["note_frequencies"]

for i, (note, part, stype) in enumerate(test_strings):
    uw = uw_all[part]
    freq = freqs[note]
    t = calc_tension(uw, scale, freq)
    match = "✅" if abs(t - expected[i]) <= 0.2 else "❌"
    print(f"{i+1:<8} {note:<6} {part:<10} {t:>12.1f} {expected[i]:>10.1f} {match:>8}")

print("\nIf all ✅ — engine is validated. Proceed to Step 3.")
```

**Expected output: all 6 strings showing ✅**

If any show ❌, stop and report back to Clayton in Chat before proceeding.

---

## Step 3 — Build `rosco_calculator.html`

Create a single self-contained HTML file. This is Clayton's daily tension calculator — no internet required, opens in any browser.

### Features required:
1. **Tension Calculator tab** — Enter scale length + gauge + note → instant tension readout
2. **Reverse Calculator tab** — Enter scale length + note + target tension → shows which gauge to use
3. **Clean Rosco-branded design** — dark background, red accent (#CC2222), clean typography

### Important implementation notes:
- All unit weight and frequency data must be **embedded directly in the HTML file** — read from `rosco_string_engine.json` at build time and hardcoded in. The file must work with no external dependencies.
- Tension formula: `T = (UW × (2 × L × F)²) / 386.4`
- For the reverse calculator, iterate through available gauges and find the closest match to the target tension, showing the top 3 options
- Round all tension values to 1 decimal place
- Show the D'Addario part number alongside each result

### Design spec:
- Background: `#1a1a1a`
- Card/panel: `#242424`
- Accent red: `#CC2222`
- Text: `#f0f0f0`
- Success green: `#4CAF50`
- Font: system-ui, -apple-system, sans-serif
- Rosco Guitars wordmark in header (text, no image needed)
- Tabs for the two calculator modes
- Results update instantly on input change (no submit button needed)

Save to:
`C:\Users\Claytron\Rosco Guitars Ltd\Rosco Guitars - Documents\09. Rosco AI\RG String Calculator\rosco_calculator.html`

---

## Step 4 — Smoke Test

After both files are created:

1. Open `rosco_calculator.html` in Chrome
2. Test these known values and confirm they match:

| Scale | Gauge | Note | Expected Tension |
|-------|-------|------|-----------------|
| 25.5  | 9     | E4   | 13.1 lbs        |
| 25.5  | 26w   | D3   | 18.4 lbs        |
| 25.5  | 36    | A2   | 19.0 lbs        |
| 27.0  | 9     | E4   | 14.7 lbs        |
| 27.0  | 46    | E2   | 26.3 lbs        |

3. Test reverse calculator: Scale 25.5, Note E4, Target 13.5 lbs → should suggest PL009 or PL0095

Report results back. If all pass, the engine is live and ready for pack generation in the next session.

---

## What NOT to do in this session

- Do not modify any Airtable records
- Do not generate string packs yet — that is the next session after validation
- Do not create any other files beyond the two specified above
- Do not install any npm packages or external dependencies — pure HTML/JS only

---

## Next Session (after validation)

Once Clayton confirms the calculator is working correctly, the next Cowork session will:
1. Use the formula engine to generate all 7-string packs (same tunings as 6-string, extended)
2. Generate 8-string packs
3. Append all packs to `rosco_string_engine.json`
4. Load new packs into Airtable (Custom String Sets + String Packs tables)

Details for that session will come from Clayton via Chat.

---

*Instructions written by Claude in Chat session — March 10, 2026*
*Validated formula confirmed against Airtable 25.5" E Standard data before writing*
