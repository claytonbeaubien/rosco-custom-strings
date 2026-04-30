/**
 * Rosco Custom Strings — Cloudflare Worker
 *
 * Two endpoints, one Worker:
 *
 *   POST /                     — Scale-length lookup (proxies Anthropic).
 *   POST /create-draft-order   — Creates a Shopify Draft Order for a custom
 *                                string pack and returns the invoice URL.
 *
 * Both endpoints share CORS, origin allowlist, and JSON helpers. Secrets
 * (Anthropic key + Shopify client secret) are encrypted Cloudflare secrets
 * so they never appear in the browser bundle.
 *
 * --- Scale lookup (/) ---
 * Request:  { brand: string, model: string, year?: string }
 * Response: { scale_length: number | null, string_count: 4-8 | null, note: string }
 *
 * --- Shopify draft order (/create-draft-order) ---
 * Request:  { pack: {...}, quantity: number }   (see handleCreateDraftOrder)
 * Response: { invoice_url: string, draft_order_id: number }
 *           or { error: string, detail?: string } on failure.
 */

// Browsers allowed to call this Worker. Edit and redeploy when adding a new
// site (e.g. when the calculator embeds on roscoguitars.com).
const ALLOWED_ORIGINS = [
  'https://claytonbeaubien.github.io',
  'https://roscoguitars.com',
  'https://www.roscoguitars.com',
];

// --- Shopify config -----------------------------------------------------
// Hardcoded — single-shop integration, won't change. If you ever migrate
// to a different store, change this value and redeploy.
const SHOPIFY_SHOP_DOMAIN = 'jaubtg-0b.myshopify.com';
// Pin a stable Admin API version. Bump as needed; Shopify supports each
// version for ~12 months. See https://shopify.dev/docs/api/usage/versioning
const SHOPIFY_API_VERSION = '2026-04';

// Anthropic model. Sonnet 4.5 — significantly sharper than Haiku on niche
// instrument questions (e.g. recognizing a Fender Jazz Bass as a 34" long-
// scale bass, not a guitar). Combined with the web_search tool below, Sonnet
// can also handle boutique brands and rare models it doesn't know from
// training (Sago, Strandberg, Aristides, etc.). Per-lookup cost is still
// under a cent for common instruments; ~1-3 cents when web search is used.
const MODEL = 'claude-sonnet-4-5-20250929';

const SYSTEM_PROMPT = `You are a guitar and bass specification lookup tool. You ONLY answer questions about guitar/bass scale lengths.

CRITICAL OUTPUT FORMAT: The first character of your response must be { and the last character must be }. Output the JSON object and nothing else — no markdown formatting, no code fences (\`\`\`), no preamble like "Here is the answer:", no trailing explanation. Just the raw JSON object.

IF YOU AREN'T SURE about the scale length from your training data, USE THE web_search TOOL to look it up before answering. Boutique brands (Sago, Strandberg, Aristides, Padalka, Skervesen, etc.), small builders, and rare/discontinued models often need a web search. Don't return null until you've tried searching the web.

Given a brand, model, and optional year, respond with EXACTLY ONE JSON object:

{"scale_length": <number_or_null>, "string_count": <integer_or_null>, "note": "<short sentence>"}

Rules:
- First, decide whether the instrument is a guitar or a bass based on the model name. Bass models include "Bass", "Jazz Bass", "Precision Bass / P-Bass", "Stingray", "Thunderbird", "Rickenbacker 4xxx", "BB", "SR", "Grabber", "Ripper", "Hofner", etc.
- scale_length: a real number in inches. Typical ranges:
  - Guitar: 24.0 – 28.625 (most common: 24.75 Gibson, 25.0 PRS, 25.5 Fender)
  - Baritone guitar: 26.5 – 30.0
  - Bass: 30 short-scale, 32 medium-scale, 34 long-scale (most common), 35 super-long, 36 extra-long
  - Use null if you cannot identify the model or aren't reasonably confident.
- string_count: integer — must be one of 4, 5, 6, 7, or 8. Use null if the instrument has a different count (e.g. 12-string acoustic, 6-string bass) or you're uncertain. Default assumptions: most guitars = 6, most basses = 4. Models with "5", "V", "7", "8" in the name usually indicate that count.
- note: ONE short sentence about the instrument, under 180 characters. If scale_length is null, write a friendly and lightly playful "couldn't find it" message — luthier humor is welcome but keep it brief and original.

Examples:
{"scale_length": 25.5, "string_count": 6, "note": "Standard Fender guitar scale, used on Strats and Teles."}
{"scale_length": 24.75, "string_count": 6, "note": "Classic Gibson scale, slightly shorter than Fender."}
{"scale_length": 25.0, "string_count": 6, "note": "PRS uses a 25-inch scale — between Gibson and Fender."}
{"scale_length": 26.5, "string_count": 7, "note": "Common 7-string extended scale, shared with many baritones."}
{"scale_length": 28.625, "string_count": 8, "note": "Standard Ibanez 8-string scale length."}
{"scale_length": 34.0, "string_count": 4, "note": "Standard Fender long-scale bass — Precision and Jazz both use it."}
{"scale_length": 34.0, "string_count": 4, "note": "Music Man StingRay long-scale bass, 34 inches."}
{"scale_length": 34.0, "string_count": 4, "note": "Gibson Grabber, 34-inch scale 4-string bass from the mid-70s."}
{"scale_length": 34.0, "string_count": 5, "note": "Five-string Jazz Bass — same scale as the four, with an added low B."}
{"scale_length": 35.0, "string_count": 5, "note": "Super-long scale, common on 5-string basses for tighter low B."}
{"scale_length": 33.25, "string_count": 4, "note": "Rickenbacker bass scale — slightly shorter than Fender's 34."}
{"scale_length": 30.0, "string_count": 4, "note": "Short-scale bass, like a Fender Mustang Bass or Hofner violin bass."}
{"scale_length": null, "string_count": null, "note": "Stumped on that one — even our resident luthier shrugged. Try a different spelling or pick a scale manually."}
{"scale_length": null, "string_count": null, "note": "Couldn't pin that one down. Maybe a typo, maybe a one-off custom — manual pick from the list works just fine."}

Refuse any non-instrument request by returning {"scale_length": null, "string_count": null, "note": "Not a guitar or bass lookup."}.`;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    // CORS preflight — must respond before the origin check kicks in.
    if (request.method === 'OPTIONS') {
      return preflightResponse(origin);
    }

    // Origin allowlist (production browsers only)
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return jsonResponse({ error: 'Forbidden origin.' }, 403, origin);
    }

    // POST only beyond this point
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'POST requests only.' }, 405, origin);
    }

    // Route dispatch
    if (path === '/create-draft-order') {
      return handleCreateDraftOrder(request, env, origin);
    }
    if (path === '/') {
      return handleScaleLookup(request, env, origin);
    }
    return jsonResponse({ error: 'Not found.' }, 404, origin);
  },
};

// ---- Scale lookup ------------------------------------------------------

async function handleScaleLookup(request, env, origin) {
  // Parse and validate body
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { scale_length: null, note: 'Invalid request body.' },
      400,
      origin
    );
  }

  const brand = String(body.brand ?? '').trim().slice(0, 60);
  const model = String(body.model ?? '').trim().slice(0, 80);
  const year = String(body.year ?? '').trim().slice(0, 8);

  if (!brand || !model) {
    return jsonResponse(
      { scale_length: null, note: 'Brand and model are required.' },
      400,
      origin
    );
  }

  // Reject obvious junk / injection bait. Plain text + the few punctuation
  // characters that show up in real guitar names (apostrophe, hyphen,
  // ampersand, parens, period, slash).
  const safeChars = /^[\w\s\-'./()&]+$/;
  if (
    !safeChars.test(brand) ||
    !safeChars.test(model) ||
    (year && !/^[\d\s\-]+$/.test(year))
  ) {
    return jsonResponse(
      { scale_length: null, note: "Couldn't make sense of that — try plain letters and numbers." },
      200,
      origin
    );
  }

  const desc = year ? `${year} ${brand} ${model}` : `${brand} ${model}`;

  // Call Anthropic
  let apiData;
  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        // 1500 — leaves room for web search results to land in context
        // before the final answer. The model itself decides whether to
        // search; for well-known instruments it skips search entirely.
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: `What is the scale length of a ${desc}?` },
        ],
        // Anthropic's server-side web search tool. Claude will search
        // the web when its training data isn't enough — e.g. boutique or
        // niche instruments. Capped at 2 searches per call to bound cost.
        tools: [
          { type: 'web_search_20250305', name: 'web_search', max_uses: 2 },
        ],
      }),
    });

    if (!apiRes.ok) {
      return jsonResponse(
        { scale_length: null, note: 'Lookup hiccup — try again or pick manually.' },
        200,
        origin
      );
    }

    apiData = await apiRes.json();
  } catch (err) {
    return jsonResponse(
      { scale_length: null, note: 'Lookup failed — pick a scale manually.' },
      200,
      origin
    );
  }

  // Find the last text block in the response. With web_search enabled, the
  // content array may contain tool_use / web_search_tool_result blocks
  // before the final text — those are Claude's intermediate searching.
  // We only want the final answer.
  const blocks = Array.isArray(apiData?.content) ? apiData.content : [];
  let text = '';
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i]?.type === 'text' && typeof blocks[i].text === 'string') {
      text = blocks[i].text.trim();
      break;
    }
  }
  let parsed;
  let attempt = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    parsed = JSON.parse(attempt);
  } catch {
    const m = attempt.match(/\{[\s\S]*\}/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch { /* fall through */ }
    }
  }
  if (!parsed) {
    return jsonResponse(
      { scale_length: null, note: 'Got a confusing answer — try again or pick manually.' },
      200,
      origin
    );
  }

  // Validate values before returning to the browser
  let scale_length = null;
  if (
    typeof parsed.scale_length === 'number' &&
    parsed.scale_length >= 22 &&
    parsed.scale_length <= 40
  ) {
    scale_length = Math.round(parsed.scale_length * 100) / 100;
  }
  let string_count = null;
  if (
    Number.isInteger(parsed.string_count) &&
    [4, 5, 6, 7, 8].includes(parsed.string_count)
  ) {
    string_count = parsed.string_count;
  }
  const note = (typeof parsed.note === 'string' ? parsed.note : '').slice(0, 240);

  return jsonResponse({ scale_length, string_count, note }, 200, origin);
}

// ---- Shopify draft order ----------------------------------------------

/**
 * Creates a Shopify Draft Order with a single custom line item priced at
 * the calculated total, and Pack details attached as line-item properties
 * so they show up on the order in Shopify admin and on the customer's
 * receipt. Returns the invoice_url which the browser redirects to for
 * checkout (Shopify-hosted, collects shipping address + payment).
 *
 * Auth: OAuth 2.0 client_credentials grant against the Dev-Dashboard app's
 * client_id / client_secret. Returns a token good for ~24h. We just request
 * a fresh token per draft order — adds one round trip but keeps the code
 * simple and avoids cache-invalidation bugs. (If we ever see meaningful
 * traffic, add KV-backed token caching here.)
 */
async function handleCreateDraftOrder(request, env, origin) {
  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request body.' }, 400, origin);
  }

  // Validate pack
  const pack = body?.pack;
  if (!pack || typeof pack !== 'object') {
    return jsonResponse({ error: 'Missing pack.' }, 400, origin);
  }
  if (!Array.isArray(pack.strings) || pack.strings.length === 0) {
    return jsonResponse({ error: 'Pack has no strings.' }, 400, origin);
  }
  // Sanity-check price. Cap at $1000 to prevent absurd / malicious values
  // from being submitted to Shopify (real packs are $20–$80 range).
  if (typeof pack.price !== 'number' || pack.price <= 0 || pack.price > 1000) {
    return jsonResponse({ error: 'Invalid pack price.' }, 400, origin);
  }
  const qty = Math.max(1, Math.min(20, parseInt(body.quantity, 10) || 1));

  // Verify env vars are configured (otherwise calls will fail in confusing
  // ways downstream — fail fast with a clear error instead).
  if (!env.SHOPIFY_CLIENT_ID || !env.SHOPIFY_CLIENT_SECRET) {
    return jsonResponse(
      { error: 'Worker misconfigured: missing Shopify credentials.' },
      500,
      origin
    );
  }

  // 1. Get a short-lived access token (client_credentials grant).
  let accessToken;
  try {
    // Standard OAuth 2.0 client_credentials grant — body must be
    // application/x-www-form-urlencoded, not JSON. Shopify's token
    // endpoint follows RFC 6749.
    const tokenForm = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.SHOPIFY_CLIENT_ID,
      client_secret: env.SHOPIFY_CLIENT_SECRET,
    });
    const tokenRes = await fetch(
      `https://${SHOPIFY_SHOP_DOMAIN}/admin/oauth/access_token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: tokenForm.toString(),
      }
    );
    if (!tokenRes.ok) {
      // Pass through Shopify's actual error body so we can see what's wrong.
      const detail = `[${tokenRes.status}] ` + (await tokenRes.text()).slice(0, 400);
      return jsonResponse(
        { error: 'Shopify auth failed.', detail },
        502,
        origin
      );
    }
    const tokenData = await tokenRes.json();
    accessToken = tokenData.access_token;
    if (!accessToken) {
      return jsonResponse({ error: 'Shopify auth: no token returned.' }, 502, origin);
    }
  } catch (err) {
    return jsonResponse(
      { error: 'Shopify auth error.', detail: String(err).slice(0, 200) },
      502,
      origin
    );
  }

  // 2. Build line-item properties from the pack spec. These show up under
  // the line item in the Shopify order and on the customer's receipt.
  const gaugeList = pack.strings
    .map((s) => s.gauge_display || (typeof s.gauge === 'number'
      ? `.${String(Math.round(s.gauge * 1000)).padStart(3, '0')}`
      : '?'))
    .join(' / ');
  const noteList = pack.strings
    .map((s) => s.note || '')
    .filter(Boolean)
    .join(' ');
  const typeList = pack.strings
    .map((s) => s.type || '')
    .filter(Boolean)
    .join(' / ');

  const properties = [
    { name: 'Tuning', value: String(pack.tuning || '—') },
    { name: 'Scale Length', value: pack.scale ? `${pack.scale}"` : '—' },
    { name: 'String Count', value: String(pack.string_count || pack.strings.length) },
    { name: 'Gauges (low → high)', value: gaugeList || '—' },
  ];
  if (noteList) properties.push({ name: 'Notes (low → high)', value: noteList });
  if (typeList) properties.push({ name: 'String Types', value: typeList });

  const title = String(
    pack.title || `Custom String Pack — ${pack.tuning || ''} ${pack.scale ? pack.scale + '"' : ''}`
  ).trim().slice(0, 200);

  const draftPayload = {
    draft_order: {
      line_items: [
        {
          title,
          price: pack.price.toFixed(2),
          quantity: qty,
          taxable: true,
          requires_shipping: true,
          properties,
        },
      ],
      tags: 'custom-pack-tool',
      note: 'Generated by the Rosco Custom Pack Generator.',
      use_customer_default_address: false,
    },
  };

  // 3. Create the draft order.
  let draftRes;
  try {
    draftRes = await fetch(
      `https://${SHOPIFY_SHOP_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/draft_orders.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify(draftPayload),
      }
    );
  } catch (err) {
    return jsonResponse(
      { error: 'Draft order request failed.', detail: String(err).slice(0, 200) },
      502,
      origin
    );
  }

  if (!draftRes.ok) {
    const detail = (await draftRes.text()).slice(0, 500);
    return jsonResponse(
      { error: 'Shopify rejected the draft order.', detail },
      502,
      origin
    );
  }

  const draftData = await draftRes.json();
  const invoiceUrl = draftData?.draft_order?.invoice_url;
  const draftOrderId = draftData?.draft_order?.id;
  if (!invoiceUrl) {
    return jsonResponse(
      { error: 'No invoice URL returned by Shopify.' },
      502,
      origin
    );
  }

  return jsonResponse(
    { invoice_url: invoiceUrl, draft_order_id: draftOrderId },
    200,
    origin
  );
}

// ---- helpers ----

function corsHeaders(origin) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
  if (ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

function preflightResponse(origin) {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin),
  });
}
