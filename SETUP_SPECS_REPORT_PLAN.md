# Setup Specs - Nut Height Update + Service Report Layout
*Plan doc. Created 2026-06-23. Owner: Clayton (via Leo).*

Covers two changes that flow through the same path (custom string pack tool -> Airtable job -> Service Report PDF):

1. A small update to the **nut slot height** targets in the generator.
2. A decision on how to **fill the empty space** on the Strings & Setup block of the service report, and how to frame the numbers so they read as targets, not guarantees.

Source of truth for the live numbers is `SETUP_SPECS` in `index.html` (transcribed from "Rosco Guitars Setup Spec Sheet - Feb 2026.pdf"). Nut and action specs are matched to the actual chosen gauge via the `range` buckets, so a value change is a clean swap inside that object.

---

## 1. Nut slot height update

### Why
Method on the card is correct: capo at the 3rd fret, measure the residual clearance over the 1st fret. That method gives small numbers (.004 to .012"). Frank Ford's reference for the same method is "about .005" as the practical low end, graduated higher toward the bass.

The current treble values sit right at or below that floor: high E .004", B .005". On a light pack (9.5-49) those plain strings are the most likely to buzz open, and .004" leaves almost no margin. They are not wrong, they are just the aggressive end of the range. For a default that has to behave across many guitars and playing styles, the everyday target should be low but safe.

Decision: ship a **Standard (default)** preset that floors the plains at .006" and graduates up to .010" on the low E, and keep the **current numbers as a "Low" preset** for light-touch players who want the lowest clean action.

### Standard preset (new default) - drop-in for `SETUP_SPECS.nutSlot.guitar`
Capo @ 3, measure @ 1. Gauge ranges unchanged, only `in`/`mm` updated.

```js
guitar: [
  { strNum: 1, range: [0.009, 0.011], in: 0.006, mm: 0.15 },
  { strNum: 2, range: [0.011, 0.014], in: 0.006, mm: 0.15 },
  { strNum: 3, range: [0.016, 0.018], in: 0.007, mm: 0.18, note: 'plain' },
  { strNum: 4, range: [0.024, 0.026], in: 0.008, mm: 0.20 },
  { strNum: 5, range: [0.032, 0.036], in: 0.009, mm: 0.23 },
  { strNum: 6, range: [0.042, 0.046], in: 0.010, mm: 0.25 },
  { strNum: 7, range: [0.056, 0.060], in: 0.011, mm: 0.28 },
  { strNum: 8, range: [0.068, 0.074], in: 0.012, mm: 0.30 },
],
```

Change vs current: every row up by .001 to .002". Strings 1 and 2 share .006" because both are plain trebles sitting at the buzz floor.

| String | Gauge bucket | Current | New (Standard) |
|---|---|---|---|
| 1 high E | .009-.011 | .004" | **.006"** |
| 2 B | .011-.014 | .005" | **.006"** |
| 3 G (plain) | .016-.018 | .006" | **.007"** |
| 4 D | .024-.026 | .007" | **.008"** |
| 5 A | .032-.036 | .008" | **.009"** |
| 6 low E | .042-.046 | .009" | **.010"** |
| 7 | .056-.060 | .010" | **.011"** |
| 8 | .068-.074 | .011" | **.012"** |

### Low preset (= current values, keep as the alternate)
.004" high E up to .011" on string 6. This is the existing block. Keep it documented (commented block or a future toggle) so light-touch jobs can use it deliberately rather than as the default.

Floors I would not publish below, for either preset: **.005" on any plain string, .007" on any wound.**

### Not touched
Bass, acoustic, and classical nut rows are unchanged. They were not part of this review and should get the same target-vs-floor pass on their own before any edit. Action, relief, intonation, and pickup height values all stay as-is (they checked out against Fender factory specs).

---

## 2. Service report - filling the empty space

### Decision
Fill it with the **actual numbers, framed as targets** for Action and Nut slot per string, a single Relief value, a free-text Setup notes line, and the order-of-operations as a light footer. Not checkmarks (a printed number is itself the proof the step was done, so a check is redundant), and the order-of-ops tip is an accent, not the headline (it is identical on every report).

### The targets framing (this is the important part)
The generator computes these from the pack, so they are recommended specs, not measurements being promised. Label them that way and the "I can't always hit them exactly" problem disappears, because the sheet never claims as-measured. This is standard practice: Fender's own published action/relief/pickup numbers are explicitly "starting points... can be adjusted," not guarantees.

Three pieces of copy:

- **Block header / subtitle:** `Setup targets for this pack` (or keep "SETUP SPECS FOR THIS PACK" and add the subtitle below it).
- **Qualifier line** (small, under the grid): `Target specs for this pack. Final setup tailored to the instrument.`
- **Setup notes** (free-text line, usually blank): `Setup notes:` ____. This is where the rare guitar that can't be dialled in gets documented, e.g. "Low-E action limited by fret wear at 9-12, recommend level and crown." That turns a number you couldn't hit into a documented reason and a soft upsell, instead of a printed miss.

### Layout
Reuse the existing Note / Gauge / Tension column grid and add:

```
Note      E    A    D    G    B    E
Gauge    .049 .036 .026 .017 .013 .095
Tension  18.4 18.3 17.7 15.9 14.8 14.1
Action   .070 .065 .063 .063 .063 .060   (@ 12th, open)
Nut slot .010 .009 .008 .007 .006 .006   (capo @ 3, @ 1st)
```

Then one line beneath the grid for the neck-wide value and the footer:

- Left: `Relief .006" @ 6th` (single value, it is one neck measurement, not per-string - do not give it six columns).
- Right (light footer): `Set in order: 1 Relief · 2 Nut slots · 3 Action · 4 Intonation · 5 Pickups`

This records the real job, keeps the existing grid rhythm, gets the "enjoy each step" order tip in, and the qualifier + notes line cover the cases where the guitar won't fully cooperate.

---

## 3. Data flow: tool -> Airtable -> report

The generator already has every number (the `SETUP_SPECS` lookup runs per chosen gauge). The remaining work is carrying it to the job record and onto the PDF.

**Tool -> Airtable.** When a pack is saved/linked to a job (Phase 2 of the strings tool, the planned "Save Pack" button), write the setup targets onto the job. Cleanest is to store the per-string action and nut values plus the single relief value. Two options:
- A compact JSON blob field on the job (whole spec in one field, easy to template from), or
- Discrete fields if you want them filterable/reportable.
Plus one free-text **Setup notes** field for the per-job exceptions line.

> Field names are not specified here on purpose. `AIRTABLE_SCHEMA.md` is flagged stale, so the exact `String Sets` / job fields need a live schema check before anything is wired. Do not invent field names.

**Airtable -> report.** The Service Report PDF automation (Make scenario `5290180`, currently in build) renders the premium report. The Strings & Setup block is where the new Action / Nut / Relief rows + qualifier + notes + footer get templated in. Per the standing rule, **capture the scenario blueprint before editing it**, and it is already on the active list to switch destination to SharePoint, add the strings tension table, and add the Outlook draft step, so this layout change should ride along with that work rather than as a separate pass.

---

## 4. Implementation hand-off (for Bender, in Claude Code)

This is Cowork, so the repo edits and the Make change happen in Claude Code, not here. Suggested order:

1. **`index.html` - nut values.** Swap `SETUP_SPECS.nutSlot.guitar` `in`/`mm` to the Standard preset above. Keep the current values as a commented "Low preset" block directly above it. Single-file, low risk. (Guitar rows only. Bass/acoustic/classical untouched.)
2. **`index.html` - report/print template.** Add the targets header/subtitle, the qualifier line, the `Setup notes:` line, and the order-of-ops footer to the Strings & Setup block of the print/PDF output. Confirm Relief renders as a single value, not a per-string row.
3. **Regenerate** and eyeball one real pack (e.g. the J209 Husscaster pack) to confirm spacing.
4. **Make 5290180** - capture blueprint first, then template the same block into the PDF render. Fold into the existing report-automation work, do not spin a separate scenario.
5. Commit on the worktree branch, push, PR per the project's `CLAUDE.md` flow.

Expected diff: a handful of changed `in`/`mm` numbers in one object, plus a new template block in the print section. No data-structure or engine changes. `rosco_string_engine.json` is not touched.
