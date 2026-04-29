# Rosco Scale Lookup Worker

Cloudflare Worker that proxies guitar scale-length lookups to the Anthropic
API. Holds the Anthropic API key as an encrypted Cloudflare secret so it
never has to leave the browser bundle.

Live at: `https://rosco-scale-lookup.clayton-18a.workers.dev/`

## What it does

The "Don't know your scale length? Find it for me" panel in the Rosco
Custom Strings calculator POSTs `{brand, model, year}` here. The Worker
validates the input, asks Claude Haiku 4.5 for the scale length, validates
the response, and returns `{scale_length, note}` to the browser. If Claude
isn't sure, `scale_length` comes back `null` and the browser shows the
friendly "couldn't find it" note instead of guessing.

## Deploying changes

You need to push new code to the Worker any time `index.js` changes. Two
ways to do it:

### Option A — Cloudflare dashboard (no install required)

1. Open the Worker in the Cloudflare dashboard
   ([Workers & Pages → rosco-scale-lookup](https://dash.cloudflare.com))
2. Click **Edit Code**
3. Paste the entire contents of `worker/index.js` from this repo
4. Click **Deploy**

That's it. Takes about 30 seconds.

### Option B — Wrangler CLI (if you'll be redeploying repeatedly)

One-time setup:

```bash
npm install -g wrangler
cd worker
wrangler login        # opens a browser to authenticate, once
```

Then any time you change `index.js`:

```bash
cd worker
wrangler deploy
```

The CLI uses `wrangler.toml` in this folder for the worker name and config.

## Configuration

The Worker reads one secret from `env`:

| Name | Type | Purpose |
|------|------|---------|
| `ANTHROPIC_API_KEY` | Secret | Server-side key for the Anthropic API |

Set via dashboard: Worker → **Settings** → **Variables and Secrets** → **Add**
→ Type: **Secret**.

Or via CLI: `wrangler secret put ANTHROPIC_API_KEY` (paste the key when
prompted).

## Allowed origins

The Worker only accepts requests from origins in the `ALLOWED_ORIGINS`
array at the top of `index.js`. Currently:

- `https://claytonbeaubien.github.io` (current public site)
- `https://roscoguitars.com` (planned customer-facing host)
- `https://www.roscoguitars.com`

Add new origins by editing the array and redeploying.

## Switching the model

Edit the `MODEL` constant at the top of `index.js` and redeploy. Currently
`claude-haiku-4-5-20251001` — fast, cheap, accurate enough for "what's the
scale length of a Stratocaster". If you want richer answers for unusual
models, switch to `claude-sonnet-4-6` (a few times more expensive but
roughly equivalent reasoning quality on this task).

## Cost reality check

Each call uses ~200 input tokens + ~50 output tokens. At Haiku 4.5 prices
that's roughly **\$0.0005 per lookup**. A thousand lookups = ~50¢. Even
if this gets popular it's negligible. With a KV cache (a follow-up) it
gets even cheaper since common guitars are looked up over and over.
