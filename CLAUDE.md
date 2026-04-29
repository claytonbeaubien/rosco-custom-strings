# Rosco Custom Strings — Project Context for Cowork/Claude

## What this is
A browser-based custom guitar string pack generator for Rosco Guitars Ltd (Vernon, BC, Canada).
Currently a standalone HTML/JS/Canvas tool. Being formalized into a deployable product.

## Current file structure
- `index.html` — main tool (formerly rosco_pack_generator.html)
- `rosco_string_engine.json` — string data (gauges, tensions, types by scale/tuning/string count)
- `daddario_catalogue.json` — D'Addario single-string pricing catalogue
- `build_catalogue.py` — generates `daddario_catalogue.json` from the source xlsx
- `worker/` — Cloudflare Worker that proxies the scale-length lookup (Anthropic key lives there as encrypted secret, never in browser code). See `worker/README.md`.
- `assets/` — logo, fonts (being built out)
- `Rosco_Tuning_Reference.pdf` — printable customer-facing tuning reference (all supported tunings)
- `README.md` — project overview
- `CLAUDE.md` — this file

## Rules — ALWAYS follow

### Tuning reference PDF stays in sync with the pack builder
**Whenever a new tuning is added to (or removed from) `index.html`, the `Rosco_Tuning_Reference.pdf` MUST be regenerated.** This PDF is published on roscoguitars.com as a free download and the matching Notion page ("Rosco Tuning Reference — All Supported Tunings", id `34c69b46-94dd-81ff-906b-c552c2387e66`) also needs the new rows.

Checklist when tunings change:
1. Update `PACKS` in `index.html` (all scale lengths for that tuning).
2. Update `TUNING_ORDER` (6/7-string) or `TUNING_ORDER_8` (8-string) so the dropdown picks it up.
3. Update the `SECTIONS` list in `/sessions/festive-loving-turing/build_tuning_pdf.py` — add/remove the `(tuning_name, [notes low→high])` tuple for the right instrument section, and bump the count in the section's subtitle/blurb.
4. Rebuild the PDF: `python3 /sessions/festive-loving-turing/build_tuning_pdf.py` → writes `/sessions/festive-loving-turing/mnt/rosco-custom-strings/Rosco_Tuning_Reference.pdf`.
5. Update the Notion page (same content — new row in the instrument's table, bump count in the intro).
6. Present the regenerated PDF to Clayton with a `computer://` link.

Do this proactively whenever the change is made — don't wait for Clayton to ask.

### Workflow: Claude edits, Clayton commits
Claude edits files freely but **does NOT run `git commit`**. The Cowork bash sandbox can't reliably delete files in `.git/` (FUSE mount limitation), which means git lock files (`.git/index.lock`) accumulate and break commits in flight. After several attempts to work around this, the cleanest pattern is:

1. Claude edits files. Multiple edits in one task are fine.
2. Claude tells Clayton when changes are ready to commit, and provides a suggested conventional-commit-style message (e.g. `feat: …`, `fix: …`, `style: …`, `chore: …`).
3. Clayton reviews the diffs in GitHub Desktop and commits + pushes from there. The "review step" doubles as a safety net (GitHub Desktop has caught a few silent file-truncation bugs from the sandbox-side write tools).
4. For Worker code in `worker/`, Clayton additionally redeploys via the Cloudflare dashboard or `wrangler deploy` after pushing.

If a session runs into a stale `.git/index.lock`, Clayton clears it from PowerShell:
```
Remove-Item C:\Users\Claytron\RoscoAI\rosco_projects\rosco-custom-strings\.git\index.lock -Force
```
(close GitHub Desktop first if it's open; its auto-fetcher has been the most likely culprit for recreating the lock).

Note: GitHub Desktop's "Automatically fetch updated changes" is OFF for this repo — leave it off. Manual Fetch via the button works fine and avoids the lock-race issue.

## Owner
Clayton — Rosco Guitars Ltd
Airtable base: Guitar Shop Management (`appB5AOWKFwyj52WM`)

## Roadmap (in priority order)

### Phase 1 — GitHub Pages (CURRENT)
- Repo name: `rosco-custom-strings`
- Deploy via GitHub Pages for internal access anywhere
- Static site for the calculator itself
- Cloudflare Worker (`worker/`) for the scale-length lookup so the
  Anthropic API key stays out of the browser. Worker URL:
  `https://rosco-scale-lookup.clayton-18a.workers.dev/`. Key is held as
  an encrypted Cloudflare secret. To deploy Worker changes, see
  `worker/README.md` (dashboard paste OR `wrangler deploy`).

### Phase 2 — Airtable Integration
Goal: "Save Pack" button in the tool that logs the string set to Airtable.

Planned Airtable table: `String Sets` (to be created)
Fields will include:
- Pack name
- String count
- Scale length
- Tuning
- Per-string: note, gauge, type, tension
- Linked record: Job/Work Order
- Label image (base64 or URL)
- Date created

The tool should include a job selector dropdown that pulls active jobs from the
Guitar Shop Management base and lets Clayton link the pack to a job before saving.

API calls will be made directly from the browser (no backend).
Airtable API key handling: use a Cloudflare Worker proxy to keep the key hidden
once this is public-facing. For internal GitHub Pages use, key can be stored in
a local config file excluded from git via .gitignore.

### Phase 3 — Customer Facing (RoscoGuitars.com)
- Embed tool on website so customers can build their own sets
- Customer submits set → triggers order flow
- Shopify integration for string pack purchases
- Inventory deduction in Airtable on order

## String data notes
- `rosco_string_engine.json` uses match key pattern: `{scale×100}-{Tuning}-{string count}`
- Known quirks: string 3 plain/wound threshold rule, trailing zero stripping in gauge display
- D'Addario XL Nickel Wound / Plain Steel as default string brand

## Do not touch
- Any archived calculator files
- `rosco_string_engine.json` data structure unless explicitly instructed
