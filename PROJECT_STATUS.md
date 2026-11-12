# RG String Calculator - Project Status
*Last updated: 2026-11-12*
*This is the single source of truth for the current state of the string tool project.*

---

## Re-order link (2026-11-11, SHIPPED, PR #36, merge 9f6a975)
Service report v2's "Re-order this pack" button/QR now lands on the client's exact pack instead of the default. New public re-order mode in `index.html` (active when `ref` is present and `job` is not): shares the count/scale/tuning/notes/label steps with job mode (function renamed `applyJobConfigFromURL` -> `applyConfigFromURL`, old name kept as an alias). New `&g=` param (gauges low to high) forces each string to the closest stocked gauge after the pack is built, mirroring the picker list per string (bass singles on the lowest wound guitar string); wrong count or any unparseable value falls back to the recommended pack, tensions recalc via `onGaugeChange`. Banner "Your pack from <ref>", normal Buy flow, no Airtable writes. `ref` carried into the checkout snapshot as `reorder_ref`. Worker side SHIPPED too (PR #37, merge 4cf20c1): `handleCreateDraftOrder` reads `reorder_ref` and prefixes the draft-order note with "Re-order of <ref>. " plus a `reorder` tag. **DEPLOYED 2026-11-12** via `wrangler deploy` from here (version 5775db71), so it's fully live - worker responds, next re-order checkout will stamp the note. Deploy mechanic learned: wrangler 4.137.0 is installed globally and Leo can run `wrangler deploy`, but auth needs a periodic `wrangler login` that only Clayton can finish (browser OAuth, approve promptly or it times out); in PowerShell the `wrangler` shim is blocked by execution policy, so call `wrangler.cmd login`. The parked `/evertune-to-job` route was stashed out during this deploy so only the re-order code shipped; it's back as an uncommitted change, still waiting on its own push/deploy. Tested in headless Chromium, all 4 cases pass: (1) the report URL -> 7-string 26.5" B Standard, gauges exactly .070/.050/.034/.026/.018/.014/.011, name Ross Hardy, banner J270, no script errors; (2) same URL + `&job=rec...` behaves exactly as job mode (no forced gauges); (3) wrong-count `g` (6 on a 7-string) falls back to recommended; (4) custom tuning via `nt` loads notes then `g` applies. Default page (no ref/job) unchanged. Only console 404 was the logo image (local serve quirk, resolves on Pages).

## Re-order short link /r/<JOB#> (2026-11-12, LIVE end to end, PR #38 + #39)
So the service report button/QR can point at a short link instead of the long param URL. Two parts, both merged to main:
- **Worker:** new `GET /r/<JOB#>` route (e.g. /r/J270), answered before the origin allowlist + POST-only guards (direct browser/QR hit, no Origin, GET). Validates `^J\d{1,5}$`, looks the job up in Airtable by Job # (`{Job #}=`), reads Scale Length / Tuning / Tuning Notes / Installed Gauges / Client Name Text by field ID. The Tuning field is a lookup of a LINK, so it returns the Tunings record id, not the name: the worker resolves that id to the tuning Name (`fldOm489nJckRYOZR`, e.g. "B Standard - 7", count suffix included) with a second Airtable call. 302s to the tool with `?ref=<JOB#>&sc=&tn=&nt=&g=&cl=` (each encodeURIComponent'd so spaces are %20, empties skipped, no job data in the body, Cache-Control: no-store). Job not found or no Installed Gauges -> 302 to the bare tool. `wrangler.toml` gained the `roscoguitars.com/r/*` route AND `workers_dev = true` (adding a routes block otherwise disables workers.dev, which would break the tool's POST calls).
- **Tool (index.html):** after a full `?ref=...&g=...` link is applied, the params are saved in sessionStorage (key `roscoReorder:<ref>`) and the address bar is trimmed via replaceState to `?ref=<JOB#>`. A reload with only `?ref=` restores the pack from sessionStorage; nothing stored -> normal default, no error. Job mode (?job=) untouched.
- **Deployed** via `wrangler deploy` (version 6125c273). Verified: workers.dev `/r/J270` 302s to the exact long URL (`g=.070%20.050%20.034%20.026%20.018%20.014%20.011`, tn=B%20Standard%20-%207, sc=26.5, cl=Ross%20Hardy); `/r/abc` and `/r/J99999` 302 to the bare tool. Tool tested locally in the browser: full link loads the 7-string 26.5" B Standard pack + trims to ?ref=J270 + stashes params; refresh restores it; bare ?ref with nothing stored falls to the default 6-string Drop C. No JS errors.
- **DECISION 2026-11-12: subdomain** (Clayton's call, over orange-clouding the apex). Why the apex failed: `roscoguitars.com/r/*` was registered and mapped to the worker, but hitting it still got a GHL 404 because worker routes only run on a **Proxied (orange cloud)** DNS record and the apex is **DNS-only (grey cloud)** for the GHL site, so traffic skips Clayton's Cloudflare edge (the CF-RAY on those responses is GHL's own Cloudflare). Fix: swapped the live Cloudflare route via the API to **`go.roscoguitars.com/r/*`** -> rosco-scale-lookup (apex route deleted), and updated `wrangler.toml` to match (PR #39, merge 72c3ef1). No `wrangler deploy` was run (so the parked `/evertune-to-job` working-tree change could not ship); the deployed script is still the /r version from PR #38.
- **LIVE 2026-11-12:** Clayton added the Proxied DNS record for `go` (A -> 192.0.2.1, orange cloud). Verified: `https://go.roscoguitars.com/r/J270` 302s to the exact pack; `/r/abc` + `/r/J99999` fall back to the bare tool. **Report switched:** the Airtable formula field `Report HTML v2` (fldly2SMIBtwTiHRJ) now builds the button href + QR from `https://go.roscoguitars.com/r/<Job #>` instead of the long URL (one `reorder_url` feeds both). Source updated in rosco_systems/reports/Service Report v2 (build_formula.py + formula_v2.txt), backup formula_v2_BEFORE_shortlink_2026-11-12.txt. Confirmed on J270's computed value: button `https://go.roscoguitars.com/r/J270`, QR data `...%2Fr%2FJ270`. The workers.dev `/r/` link also still works. Nothing left on Clayton.

## keep_vars + move to strings.roscoguitars.com (2026-11-12, Leo; LIVE end to end, PR #40 + #41 merged)
Two jobs off Clayton's 11-12 prompt.

**Job 1 - stop deploys wiping worker settings: DONE, PR #40 (merged to main).** `keep_vars = true` in `worker/wrangler.toml` so a `wrangler deploy` can never again clear a dashboard-set Variable. `worker/README.md` config table now lists all four as Secrets (AIRTABLE_TOKEN, ANTHROPIC_API_KEY, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET) with "never add plain vars; use Type: Secret". keep_vars activates on the next `wrangler deploy` (none run this session).

**Job 2 - move to strings.roscoguitars.com: LIVE end to end, PR #41 (merged to main).** CNAME `strings.roscoguitars.com`; worker ALLOWED_ORIGINS gains the subdomain (github.io kept so old links/open tabs work); TOOL_URL (used by /r/<JOB#>) + the print-label labelUrl -> `https://strings.roscoguitars.com/`; slim dark public nav bar in index.html (Rosco logo -> roscoguitars.com + Home / Book a Service / Shop; brand #1a1a1a bar, #2cd5c4 accent), hidden in print mode, internal job mode (new `html.job-mode` flag from ?job=), and iframe embeds; logo src fixed to the tracked `data/Rosco Guitars Logo.png` (the old `Images/` path 404'd and the logo is white, so the bar is dark).

**Rollout 2026-11-12:** Clayton added the Cloudflare DNS record (CNAME `strings` -> `claytonbeaubien.github.io`, grey cloud); it resolves to the GitHub Pages IPs. Merged PR #41; GitHub Pages custom domain = strings.roscoguitars.com with **HTTPS enforced** (cert issued in ~a couple of minutes; the tool served over HTTP during that window so nothing broke). Worker redeployed via `wrangler.cmd deploy` (version 2687bc52-59c6-4e6f-9fbd-9cdfdc08b749), so /r/<JOB#> + the print label point at strings. now. **keep_vars is live** on the deployed config (no vars wiped; all four are Secrets). Note: GitHub now 301s the old github.io project URL to strings. (expected custom-domain behaviour).

**Tests PASSED (live):** `go.roscoguitars.com/r/J270` -> 302 to `strings.roscoguitars.com/?ref=J270&sc=26.5&tn=B%20Standard%20-%207&nt=B%20E%20A%20D%20G%20B%20E&g=.070%20.050%20.034%20.026%20.018%20.014%20.011&cl=Ross%20Hardy`; page builds Ross's 7-string 26.5" B Standard with the J270 banner + top bar, address bar trims to ?ref=J270. `/r/abc` + `/r/J99999` fall back to the bare tool. Buy This Pack from strings. reached Shopify checkout (CAD $25.26), draft #D35 note "Re-order of J270. Generated by the Rosco Custom Pack Generator." + tags custom-pack-tool/reorder - **test draft #D35 deleted.** `claytonbeaubien.github.io/rosco-custom-strings/` 301s to the new domain and serves. `?job=` + `?print=` show no top bar (confirmed live).

**One leftover for Clayton:** an older OPEN draft order **#D34** (same "Re-order of J270" note, $25.26, created ~19:45 UTC today - not from this session, likely an earlier test checkout) is still in Shopify. Say the word and Leo deletes it too.

**Still parked (unchanged):** the `/evertune-to-job` worker route is back as an uncommitted working-tree change, still waiting on its own push/deploy (stashed out of this deploy, same as the /r deploys).

## Incident 2026-11-12: checkout broken after worker deploy (FIXED)
Buy This Pack returned "Worker misconfigured: missing Shopify credentials". SHOPIFY_CLIENT_ID had been a dashboard plain-text var; the 11-12 wrangler deploy wiped it (secrets survived). Clayton re-added it as a Secret in Cloudflare 12:43, checkout confirmed working 12:45. All four worker values are now Secrets. keep_vars + the strings.roscoguitars.com move are now done in code - see the section right above.

## Feel setting: Light / Regular / Heavy (2026-11-11, PLAN, not built)
Clayton asked for a Light / Regular / Heavy switch that nudges the recommended gauges. Leo checked the engine, D'Addario balanced sets and 30 real job gauge records. Finding: clients' as-found sets run +1.2 lb over Rosco targets on the top strings and -2.2 lb under on the low string; the heavy crowd (Drop C on 12-52/12-56/13-56) is +4 to +6 lb on strings 1-4. So Heavy should be tilted (+2.5 top / +1.5 mid / +0.5 low), not a flat +2. Full plan, tables and 5 questions: `FEEL_SETTING_PLAN.md`. Sim to re-run numbers: `tools/feel_sim.js` (node). Next: Clayton answers the 5 questions, then Leo writes the Bender hand-off.

## Worker: /evertune-to-job route (2026-11-02, Leo, NOT DEPLOYED)
worker/index.js gained a route for the EverTune Routing Tool (separate project, RG-EverTune-Tool): `handleEverTuneToJob` writes EverTune measurements, router settings, plan text and tool link onto a Guitar Job. Same AIRTABLE_TOKEN and origin list, nothing else in the Worker changed. Bender commits worker/index.js only and runs `wrangler deploy`; hand-off is RG-EverTune-Tool/BENDER_HANDOFF_AIRTABLE_2026-11-02.md.

## Intake form tunings + strings hand-off (2026-10-22, in progress)
**Problem:** three tuning lists out of sync (GHL ~14, Airtable 56, tool ~78 across counts). Make 2820136 links the guitar by exact Name + # of strings, so "Other" or unknown names link nothing and Clayton fixes the job by hand, then adds the tuning to Airtable and GHL. GHL list had "Drop D" twice.
**Decided (Clayton 10-22):** GHL shows a tuning dropdown per string count (conditional on No. of Strings), all three systems carry the same list. Sharps everywhere, D# Standard (4/6) and A# Standard (5) labelled "/ Eb". Signature names kept alongside generic ones. 5-string named by the low string. GHL labels show notes, Make strips them. "Other Tuning" box already exists in the form (client types notes low to high).
**Master list:** `TUNING_MASTER.md` in this folder (83 tunings: 4=9, 5=12, 6=29, 7=15, 8=18) with the 5 GHL paste lists.
**Done 10-22:** Airtable Drop G - 6 notes fixed (was G D G C F A). 28 tunings added to Airtable (Tunings now 83, matches TUNING_MASTER.md; 8-string A Standard + Double Drop E (High A) tagged CHECK in Genre / Description). Ibanez Artcore relinked to E Standard - 6, `E Standard Low - 6` deleted. D# Standard 4/6 tagged "Also called Eb Standard". Make 2820136 blueprint saved: rosco_systems/make_blueprints/blueprint_2820136_BEFORE_tuning_per_count_2026-10-22.json. GHL AI prompt written: GHL_AI_TUNING_PROMPT.md (5 fields tuning_4_string..tuning_8_string, show/hide on No. of Strings, webhook Custom Data keys tuning_4..tuning_8, old tuning key kept).
**Next:**
1. DONE (see above).
2. GHL fields DONE 10-22 by GHL AI (Steps 1-2): keys are contact.tuning_4string .. contact.tuning_8string (no underscore before "string"), option counts verified 10/13/30/16/19. Webhook Custom Data keys tuning_4..tuning_8 -> {{contact.tuning_Nstring}} handed back to GHL AI. Survey rules (Step 3) = Clayton by hand. Until Make is switched, new submissions won't link a tuning (old Tuning field leaves the form).
3. DONE 10-23. Test 5 PASSED (4-string Other "B E A D" -> created + linked "Custom: B E A D - 4", J280). Lesson: never push a metadata-stripped blueprint via API, Make needs module `expect` metadata to coerce link fields (Leo's stripped push at 01:30 failed with 422 "Value is not an array of record IDs"; fixed by Clayton importing the full v2 file). UI imports reset the schedule to every 15 min, always set back to Immediately. Test tuning Custom: B E A D deleted. Test jobs J276-J280 + guitars (Agile, Aristides, Arist, Balaguer, 2x Arbor) left for Clayton to delete (Leo's delete blocked by permissions). History: Make 2820136 patch LIVE 10-23 (Clayton imported; import flipped schedule to 15 min, Clayton set it back to Immediately). Test 1 PASSED: 6-string Drop C -> guitar Agile - Strat linked Drop C - 6, job J276, no duplicate Tunings record (upsert merged). Test 2 (8-string Other "G G D G C F A D") PARTIAL: guitar Aristides - Strat + J277 created, Other Tuning text saved, but upsert module 46 skipped (2 fewer ops than test 1 = filter blocked, so tuning label came through empty). Webhook bundle (Clayton 10-23): tuning_8 empty, old Tuning = "Other", tuning_6 stale "Drop C" from test 1. Cause: the GHL Service Survey workflow has a Clear Fields step (after the webhook) so repeat clients don't get prefilled answers; the 5 new tuning fields weren't in it. Clear step updated. Test 3 (J278, 8-string Other "E E E E E E E E") same result: bundle shows old Tuning = "Other" (old field's option text) and tuning_8 empty, so the 8-string branch was still showing the OLD Tuning question. Then the survey's per-count show/hide rules vanished (likely deleted with the old Tuning field they referenced). Clayton rebuilding 5 separate rules + Other rule, reload to confirm they stick; if not, clone the survey. Survey restored by Clayton to a pre-break version (new dropdowns + rules, no old Tuning question). Test 4 PASSED: J279 Balaguer 8-string -> F# Standard - 8, Build String Pack opened the tool with the pack built. v2 pushed by Leo via Make API 10-23 01:30 (stripped of editor-only metadata; schedule Immediately; active). Backstop: blueprint_2820136_tuning_per_count_IMPORT_v2_2026-10-23.json (module 41: if the per-count dropdown is empty but Other Tuning has text, treat as Other). Import + set schedule back to Immediately. Test records to delete after: J276/J277/J278/J279 and their guitars (recU3UzAgNVBBXwDW, rec2kGK4Vkjf36VUg, recJBE3h4n7hKKand, rec30DIdX4KSKi641). Manual upsert of the same body via API worked, so merge on Name + # of Stings is fine. Created "Custom: G G D G C F A D - 8" (recbBKtpvWVnuPLW9) and relinked J269 Jackson Dinky 8 to it (was wrongly Drop G - 7). Correction: Airtable search with no match does NOT stop the route (test 2 still made guitar + job), so the old "Other never created the job" claim was wrong.  Was waiting on Clayton to import (too big to push via API): rosco_systems/make_blueprints/blueprint_2820136_tuning_per_count_IMPORT_2026-10-22.json (rollback = ..._BEFORE_tuning_per_count_2026-10-22.json). Survey went live 10-22 (Clayton did Step 3 + webhook keys by hand). What it does: new modules 41-44 (Set Variable) pick the tuning field matching no_of_strings (fallback old `tuning` key), strip the label to the Airtable Name (text before the last " (", then before " /"), take notes from the brackets or from Other Tuning (sanitised to letters, digits, #, spaces). Router 45 route 1 = module 46 Airtable API PATCH upsert on Tunings (merge on Name + # of Stings, typecast, Ignore error handler, filter needs name + notes); route 2 = the original router 3. Searches 25/26 now match on 44.tuning_name. Other = new Tunings record named "Custom: <notes>" for Clayton to rename. Also fixes an old gap: a search with no match stopped the route, so "Other" submissions never created the guitar/job. Needs a test submission (known tuning + Other) after import.
4. **SHIPPED 2026-10-23, PR #35 (merge c1700b8).** Tool dropdowns now match TUNING_MASTER.md exactly (4=9, 5=12, 6=29, 7=15, 8=18). Renames, 5-string dup removals and the 7 new tunings (63 packs, 9 scales each) done; pack notes all sharps; "/ Eb" shown after D# Standard (4, 6) and A# Standard (5) in the dropdown only. &nt= live: used only when the tuning name doesn't match; octave = nearest to the loaded pack's note, flats -> sharps, then gauges rebalance (not just tension recalc, so a custom tuning opens balanced). Bad or wrong-count nt is ignored. Test URL (8-string 26.5", G G D G C F A D) gives G1 G1 D2 G2 C3 F3 A3 D4 at .080/.080/.054/.039/.028w/.018/.0135/.010, all green. Tuning reference PDF regenerated (also picked up Open Slayer, Sonic Youth, D Fifths, bass ladder 40-42, sharps note); Notion page updated (also fixed its wrong 4-string Drop B row). Known: label TUNING box is blank for a custom tuning (existing behaviour; could prefill it from tn). 8-string Drop B / Drop C put a .090 on the low string at about 9-13 lb because the engine never auto-picks the XLB bass singles; pick a .110-.120 by hand. NEXT (Leo): add &nt= to the Build String Pack formula. Original hand-off 10-23: BENDER_HANDOFF_TUNINGS_2026-10-23.md (Clayton passing to Claude Code). After it merges, Leo adds &nt= ENCODE_URL_COMPONENT({Tuning Notes}&"") to the Airtable Build String Pack button formula (fld1QKFM4rJqSXIX6). Original scope: Tool: rename Eb Standard (4) -> D# Standard, Eb Standard (5) -> A# Standard, Drop Eb (8) -> Drop D#; remove 5-string E Standard + D Standard dups; add packs for 6 Drop E, 6 BEADEA, 8 D# Standard / Drop C# / D Standard / Drop C / Drop B; Build String Pack button passes &nt= notes. Regenerate tuning reference PDF.
5. Phase 2: "Book a setup with this pack" button in the public tool opens the service form with hidden fields prefilled (count, scale, tuning, notes, pack spec); Make writes it to a Requested Pack field on the job. Form gets a "Build your pack first" link under Tuning. GHL URL prefill per ghlexperts guide, test first (dropdowns may not prefill).
Clayton to sanity-check 8-string "A Standard" (A D G C F A D G) and "Double Drop E (High A)" (F# C# F# B E A C# A) in the tool before they go to Airtable.
Supersedes backlog item "GHL: paste the 51-tuning list + D Fifths".

## Bass tension review (2026-10-06)
- Clayton: 40 lb feels right on bass in real setups, but the tool flags it. Cause: bass ladder is 32/34/36/38/40 with bands ok 3 / warn 7, so 40 lb on the G reads red, on the D orange.
- Engine math is correct (matches D'Addario published EXL170: G45 42.8, D65 51.3, E100 36.5). The targets are the issue: current ladder sits at D'Addario Super Light balanced level (EXL220BT ~34 lb flat) and builds E std as 40-52-75-100.
- D'Addario's own balanced sets are flat, not progressive: EXL220BT ~34, EXL170BT ~42.5, EXL160BT ~53 lb per string.
- APPROVED by Clayton 2026-10-06, handed to Bender: ROSCO_BASS_TARGETS {1:40, 2:40, 3:41, 4:41, 5:42}, drop anchor 42. E std 34" then builds 45-60-80-105 (= EXL170BT), B std 5 adds .145. Also update the ladder table + band copy in the Tensions section. Change is in `index.html` (~line 1285), Bender push.
- **SHIPPED 2026-10-06.** Targets now 40/40/41/41/42, drop anchor 42, ladder table updated. Bands left at ok 3 / warn 7, so band copy didn't change. Tested in headless Chromium at 34": E std 45/60/80/105 = 42.8/42.9/42.0/40.3 all green; Drop D low .120 = 40.4; 5-string B std adds .145 = 41.4; C std 55/70/100/130. `tensionClass(40, 1)` now green (was red). Checkout snapshot carries XLB part #s and price ($38.50 for E std 4). No tunings changed, so no PDF or Notion rebuild.
- Note: no stock gauge lands right at 40 lb on the G at 34" E std (.042 = 37.1 green, .045 = 42.8 green, .040 = 33.7 orange).

## Strings subscription plan (2026-10-10, parked, not started)
Clayton picked this as the loyalty play for Rosco: strings on subscription is the one recurring product, and the subscriber discount is the loyalty perk. Best idea of the night, no time to build it yet. Promote it through the one-idea-a-week rule when ready.

**The wrinkle:** today's Buy path checks out through a Draft Order (custom line item, no variant, built by the Cloudflare worker). Shopify does not allow selling plans / subscriptions on draft orders, so Subscribe needs its own path. Answers the open question below: subscription is NOT set up, it needs building.

**Plan:**
1. [Clayton, ~30 min] Install the Shopify Subscriptions app (Shopify's own, free, works on Basic). Create selling plans: every 4 / 6 / 8 / 12 weeks, subscriber % off (number TBD).
2. [Clayton] Create real subscription products with fixed variant prices: Custom 6-String Pack, 7, 8, Bass, and a "with bass single" variant. Round current per-gauge pricing to a tier; subscriptions need a stable price.
3. [Bender] Worker gets a second route: build a cart via the Storefront API (variant + selling plan ID + line item properties), return the cart checkoutUrl. Generator's buy modal gets a Subscribe option that hits this route instead of the Draft Order route.
4. [Bender] Custom gauges, tuning and label name travel as line item properties so they print on every renewal order and the Airtable inventory pull can read them.
5. Subscriptions app customer portal covers pause / skip / change interval. Gauge changes = email to Clayton (acceptable, it's a touchpoint).

**Open before build:** subscriber discount %, price tiers per variant, whether renewals should also hit the Airtable inventory flow (likely yes, via the existing order webhook).

Source checked 2026-10-10: Seal Subscriptions FAQ confirms draft orders cannot start subscriptions; shopify.dev/docs/apps/subscriptions for selling plans.

## Latest (2026-10-05)
- **Bass singles on the lowest guitar string.** D'Addario guitar wound singles stop at .090 (NW090). The gauge picker on the lowest wound string of any guitar pack (6/7/8) now also lists XLB bass singles: .095, .100, .105, .107, .110, .120, marked "(bass)". Picker only, the recommendation engine never picks them. XLB chosen because it's the only XL bass line with every gauge (no XB110S/XB110M). Priced at the bass markup (XLB110 = $11.85), part # flows to checkout and Add to Job as XLB###, Type column shows "XLB", new 3mm drill bucket at .095+, String Info copy mentions nut slot + ball end fit.
- Tested in headless Chromium: 8-string Drop E 28", low string .110 = 31.3 lb, priced, part XLB110, survives note change and table rebuild, no console errors.
- **Status:** shipped via PR on branch `claude/bass-singles-low-string`, live on GitHub Pages.
- Open: Clayton to confirm the gauge list (stop at .120? add .125/.130?) and whether to offer it on string 7 too.

## Current State

**Status: 🔄 Phase 3 (Front End) active - Pack Generator is the primary tool. Phase 4 (Store Integration) not started.**

The Pack Generator (`rosco_pack_generator.html`) is now the primary tool. It replaced the earlier calculator (V1) which is archived. The JSON engine exists as a source-of-truth reference; the pack generator has all data embedded.

---

## Working Files

```
rosco_projects\RG String Calculator\
├── rosco_pack_generator.html          ← ✅ PRIMARY TOOL (V2) - open this
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
| `rosco_pack_generator.html` | ✅ **PRIMARY** | The main tool - pack generator / recommender (V2) |
| `data/rosco_string_engine.json` | ✅ Reference | Source-of-truth data engine - 344 packs, unit weights, tension targets |
| `build_history/rosco_calculator_v1_archived.html` | 🗄️ Archived | Old V1 calculator - superseded by pack generator |
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
| 1 | Data Foundation - JSON engine | ✅ Complete (March 10) |
| 2 | Recommender Logic | ✅ Complete (March 10) |
| 3 | Web Tool (HTML front end) | 🔄 In progress - pack generator refinement |
| 4 | Store Integration - Shopify buy/subscribe buttons | ⏳ Not started |

---

## Open Questions for Clayton (Phase 4 blockers)

**Product / Pricing:**
- [ ] Which D'Addario string lines is Rosco sourcing? (EXL? NYXL? Singles?) - affects part number accuracy
- [ ] Individual string pricing for Custom Builder, or only full pre-built packs?
- [ ] Are 7-string and 8-string packs validated by Clayton or just tension-calculated?
- [ ] What happens when someone inputs a scale/tuning with no exact pack match - show nearest or "coming soon"?
- [x] Is Shopify subscription already set up, or does this need to be built? ANSWERED 2026-10-10: needs building, see "Strings subscription plan" above.

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
3. Execute Phase 4 - wire "Buy" / "Subscribe" buttons to Shopify checkout
4. (Long term) Move to web deployment on roscoguitars.com
