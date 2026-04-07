# Rosco Custom Strings — Project Context for Cowork/Claude

## What this is
A browser-based custom guitar string pack generator for Rosco Guitars Ltd (Vernon, BC, Canada).
Currently a standalone HTML/JS/Canvas tool. Being formalized into a deployable product.

## Current file structure
- `index.html` — main tool (formerly rosco_pack_generator.html)
- `rosco_string_engine.json` — string data (gauges, tensions, types by scale/tuning/string count)
- `assets/` — logo, fonts (being built out)
- `README.md` — project overview
- `CLAUDE.md` — this file

## Owner
Clayton — Rosco Guitars Ltd
Airtable base: Guitar Shop Management (`appB5AOWKFwyj52WM`)

## Roadmap (in priority order)

### Phase 1 — GitHub Pages (CURRENT)
- Repo name: `rosco-custom-strings`
- Deploy via GitHub Pages for internal access anywhere
- No backend required — pure static site

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
