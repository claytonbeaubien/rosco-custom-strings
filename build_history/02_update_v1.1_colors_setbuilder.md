# Cowork Instructions: Calculator Update — v1.1
*Update the existing rosco_calculator.html file. Do not rebuild from scratch.*

---

## Files involved

**Edit this file:**
`C:\Users\Claytron\Rosco Guitars Ltd\Rosco Guitars - Documents\09. Rosco AI\RG String Calculator\rosco_calculator.html`

**Logo file (in same folder):**
`Rosco Guitars Logo.png` (or whatever the exact filename is — check the folder)

---

## Change 1 — Brand Colors

Replace the current color scheme with the official Rosco Guitars brand colors:

| Role | Old color | New color |
|------|-----------|-----------|
| Background | `#1a1a1a` | `#1a1a1a` ← keep this, it works |
| Card/panel background | `#242424` | `#242424` ← keep |
| **Primary accent** | `#CC2222` (red) | `#2cd5c4` (Rosco teal) |
| **Secondary / muted** | various reds | `#667085` (Rosco slate) |
| Text primary | `#f0f0f0` | `#ffffff` |
| Text secondary/label | muted white | `#667085` |
| Active tab indicator | red underline | `#2cd5c4` underline |
| Toggle button (active) | red fill | `#2cd5c4` fill with `#1a1a1a` text |
| Toggle button (inactive) | dark | `#2d2d2d` with `#667085` text |
| Progress bar fill | red/green | `#2cd5c4` |
| Target marker on bar | red dot | `#667085` dot |
| "On target" text | green `#4CAF50` | `#2cd5c4` |
| "Off target" text | red | `#667085` |
| Result tension number | white | `#ffffff` |
| Formula display text | muted | `#667085` |

**All instances of `#CC2222` or any red hex → replace with `#2cd5c4`**
**All instances of secondary grey accents → use `#667085`**

---

## Change 2 — Add Rosco Logo to Header

Replace the current text-only header with the actual logo image.

**Current header (approximate):**
```html
<div class="header">
  <span class="brand">ROSCO <span class="accent">GUITARS</span></span>
  <span class="subtitle">STRING TENSION CALCULATOR</span>
</div>
```

**Replace with:**
```html
<div class="header">
  <div class="header-left">
    <img src="Rosco Guitars Logo.png" alt="Rosco Guitars" class="logo-img" />
  </div>
  <div class="header-right">
    <span class="subtitle">STRING TENSION CALCULATOR</span>
  </div>
</div>
```

**Add these CSS rules for the logo:**
```css
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 32px;
  border-bottom: 2px solid #2cd5c4;
}
.logo-img {
  height: 48px;
  width: auto;
  display: block;
  /* If logo has white background, use: filter: brightness(0) invert(1); */
  /* If logo is already on transparent/dark background, no filter needed */
}
.header-right .subtitle {
  color: #667085;
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}
```

> Note: Check if the logo PNG has a transparent background or white background.
> - Transparent background = no filter needed
> - White background = add `filter: brightness(0) invert(1);` to make it show on dark bg
> - If neither works cleanly, use the text fallback: `<span style="color:#ffffff;font-weight:800;font-size:1.4rem;letter-spacing:0.05em;">ROSCO <span style="color:#2cd5c4;">GUITARS</span></span>`

---

## Change 3 — Full String Set View (main feature addition)

Add a **third tab** called "SET BUILDER" between the existing two tabs.

**New tab order:**
1. TENSION CALCULATOR (existing — single string)
2. SET BUILDER (new)
3. REVERSE — FIND GAUGE (existing)

### What the Set Builder tab does:

Displays a full string set as rows — one row per string (6 strings by default). Each row has:
- String number label (1–6, or 1–7, 1–8)
- Note dropdown (same note options as existing calculator)
- String type toggle (PLAIN / WOUND)
- Gauge dropdown (filtered by type — plain gauges for plain, wound gauges for wound)
- Calculated tension display (live, updates instantly)
- Tension status indicator (colored dot: teal = on target ±1.5 lbs, slate = within ±3 lbs, red = outside)
- Rosco target tension shown small below the calculated tension

At the top of the Set Builder, add:
- Scale length dropdown (same options as existing calculator)
- String count selector: 6 / 7 / 8 (buttons — clicking 7 adds row 7, clicking 8 adds rows 7+8)

At the bottom, show:
- **Set summary line:** e.g. `9 / 12.5 / 16.5 / 26w / 36 / 50` — the full gauge set in order
- **Average tension** across all strings
- **Tension range** (lowest to highest)
- A color-coded overall status: "Rosco Balanced ✓" (all strings within ±1.5 lbs of target) or "Review tensions" (any string outside ±3 lbs)

### Default values when tab loads:
Pre-populate with the 25.5" E Standard pack as a starting point:
- Scale: 25.5"
- String count: 6
- Row 1: E4, Plain, gauge 9
- Row 2: B3, Plain, gauge 12.5
- Row 3: G3, Plain, gauge 16.5
- Row 4: D3, Wound, gauge 26w
- Row 5: A2, Wound, gauge 36
- Row 6: E2, Wound, gauge 50

### Rosco target tensions for color coding:
```
String 1: 13.5 lbs target
String 2: 14.5 lbs target
String 3: 15.5 lbs target (16.0 if wound)
String 4: 18.0 lbs target
String 5: 19.0 lbs target
String 6: 20.0 lbs target
String 7: 21.0 lbs target
String 8: 22.0 lbs target
```

### Row layout (CSS):
Each string row should be a horizontal flex row:
```
[String #] [Note dropdown] [PLAIN|WOUND toggle] [Gauge dropdown] → [XX.X lbs] [● status dot]
                                                                      [target: XX.X lbs]
```

Style each row with subtle alternating background or a thin separator line between rows.
Row height should be compact — around 52px per row.

The tension value should be large and bold (`font-size: 1.3rem`, `font-weight: 700`).
The target tension below it should be small and muted (`font-size: 0.7rem`, `color: #667085`).

Status dot colors:
- `#2cd5c4` — within ±1.5 lbs of target (on target)
- `#f0a500` — within ±3.0 lbs of target (close)
- `#e05555` — outside ±3.0 lbs (review)

---

## Change 4 — Minor polish

- Ensure tab labels are uppercase with letter-spacing: `0.1em`
- Ensure all dropdown selects use dark background `#2d2d2d`, teal border on focus `#2cd5c4`
- Add a thin `1px solid #2cd5c4` bottom border to the active tab, remove from inactive
- The formula display at the bottom of the Tension Calculator tab — make it slightly more prominent, use `#667085` color

---

## What NOT to change

- The tension formula and all unit weight data — do not touch
- The existing Tension Calculator tab functionality — only restyle colors, do not change logic
- The existing Reverse Calculator tab functionality — only restyle colors
- The JSON file — not involved in this update

---

## After editing

Open `rosco_calculator.html` in Chrome and verify:
1. Logo appears in header (not broken image)
2. Teal accent color shows throughout (tabs, toggles, progress bar)
3. Set Builder tab loads with 6 pre-populated rows
4. Changing a gauge in Set Builder instantly updates that row's tension
5. Changing string count to 7 adds a 7th row (B1, Wound, 56w as default)
6. Changing string count to 8 adds an 8th row (F#1, Wound, 64w as default)
7. Summary line at bottom shows the gauge set correctly

Report back with a screenshot when done.

---

*Instructions written in Chat — March 10, 2026*
*v1.1 update — color rebrand + Set Builder tab addition*
