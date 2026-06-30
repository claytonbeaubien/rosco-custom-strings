# Rosco Custom Strings - Project Context for Cowork/Claude

## What this is
A browser-based custom guitar string pack generator for Rosco Guitars Ltd (Vernon, BC, Canada).
Currently a standalone HTML/JS/Canvas tool. Being formalized into a deployable product.

## Current file structure
- `index.html` - main tool (formerly rosco_pack_generator.html)
- `rosco_string_engine.json` - string data (gauges, tensions, types by scale/tuning/string count)
- `daddario_catalogue.json` - D'Addario single-string pricing catalogue
- `build_catalogue.py` - generates `daddario_catalogue.json` from the source xlsx
- `worker/` - Cloudflare Worker that proxies the scale-length lookup (Anthropic key lives there as encrypted secret, never in browser code). See `worker/README.md`.
- `assets/` - logo, fonts (being built out)
- `Rosco_Tuning_Reference.pdf` - printable customer-facing tuning reference (all supported tunings)
- `README.md` - project overview
- `CLAUDE.md` - this file

## Rules - ALWAYS follow

### Tuning reference PDF stays in sync with the pack builder
**Whenever a new tuning is added to (or removed from) `index.html`, the `Rosco_Tuning_Reference.pdf` MUST be regenerated.** This PDF is published on roscoguitars.com as a free download and the matching Notion page ("Rosco Tuning Reference - All Supported Tunings", id `34c69b46-94dd-81ff-906b-c552c2387e66`) also needs the new rows.

Checklist when tunings change:
1. Update `PACKS` in `index.html` (all scale lengths for that tuning).
2. Update the right `TUNING_ORDER*` constant so the dropdown picks it up - `TUNING_ORDER` (6/7-string), `TUNING_ORDER_8` (8-string), `TUNING_ORDER_BASS4` (4-string bass), or `TUNING_ORDER_BASS5` (5-string bass).
3. Update the `SECTIONS` list in `build_tuning_pdf.py` (in the repo root) - add the tuning name to the right instrument section, in the order it should appear in the customer-facing PDF.
4. Rebuild the PDF: `python3 build_tuning_pdf.py` (from the repo root). It reads PACKS directly from `index.html`, so as long as the tuning is in PACKS and listed in `SECTIONS`, the notes column auto-populates. Output: `Rosco_Tuning_Reference.pdf` next to the script.
5. Update the Notion page (same content - new row in the instrument's table, bump count in the intro).
6. Present the regenerated PDF to Clayton with a `computer://` link.

Do this proactively whenever the change is made - don't wait for Clayton to ask.

### Workflow: Claude commits + pushes; Clayton reviews on the PR page
Sessions run in a per-session git worktree under `.claude/worktrees/<name>/` on branch `claude/<name>` (Claude Desktop creates this automatically at session start). Claude edits, commits, and pushes that branch. Clayton reviews the diff on the GitHub PR page and merges when satisfied.

1. Claude edits files freely. Multiple edits per logical task are fine.
2. When a coherent chunk is done, Claude stages, commits (conventional commit style: `feat:`, `fix:`, `chore:`, `docs:`, etc.), and pushes the worktree branch. Each commit message ends with the standard `Co-Authored-By: Claude …` footer.
3. Claude gives Clayton a direct PR URL: `https://github.com/claytonbeaubien/rosco-custom-strings/pull/new/claude/<branch>`. Clayton reviews on github.com and merges.
4. For Worker code in `worker/`, after the PR merges Clayton additionally redeploys via the Cloudflare dashboard or `wrangler deploy`.

After the PR merges, cleanup (Claude can do this from any worktree of the repo, or Clayton can run it locally):
```
git worktree remove .claude/worktrees/<name>
git branch -D claude/<name>
git push origin --delete claude/<name>
```
Also delete the matching entry from `C:\Users\Claytron\AppData\Roaming\Claude\git-worktrees.json` (close Claude Desktop first when editing that file).

Why this changed: earlier sessions ran in the Cowork bash sandbox with a FUSE limitation that left `.git/index.lock` files behind, so Clayton committed via GitHub Desktop and Claude didn't touch git. Windows Claude Desktop with worktree isolation doesn't hit that issue, and the worktree makes GitHub Desktop's view of `main` blind to in-progress changes - pushing the worktree branch and reviewing on the PR page is now the clean flow.

Note: GitHub Desktop's "Automatically fetch updated changes" stays OFF for this repo.

## Owner
Clayton - Rosco Guitars Ltd
Airtable base: Guitar Shop Management (`appB5AOWKFwyj52WM`)

## Roadmap (in priority order)

### Phase 1 - GitHub Pages (CURRENT)
- Repo name: `rosco-custom-strings`
- Deploy via GitHub Pages for internal access anywhere
- Static site for the calculator itself
- Cloudflare Worker (`worker/`) for the scale-length lookup so the
  Anthropic API key stays out of the browser. Worker URL:
  `https://rosco-scale-lookup.clayton-18a.workers.dev/`. Key is held as
  an encrypted Cloudflare secret. To deploy Worker changes, see
  `worker/README.md` (dashboard paste OR `wrangler deploy`).

### Phase 2 - Airtable Integration
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

### Phase 3 - Customer Facing (RoscoGuitars.com)
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
