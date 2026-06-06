/**
 * Rosco Custom Strings — Cloudflare Worker
 *
 * Two endpoints, one Worker:
 *
 *   POST /                     — Scale-length lookup (proxies Anthropic).
 *   POST /create-draft-order   — Creates a Shopify Draft Order for a custom
 *                                string pack and returns the invoice URL.
 *   POST /add-to-job           — Writes a built pack back onto an Airtable
 *                                Guitar Job (internal twin of the Shopify
 *                                flow) so the Service Report auto-fills and
 *                                String Inventory deducts.
 *
 * All endpoints share CORS, origin allowlist, and JSON helpers. Secrets
 * (Anthropic key + Shopify client secret + Airtable token) are encrypted
 * Cloudflare secrets so they never appear in the browser bundle.
 *
 * --- Scale lookup (/) ---
 * Request:  { brand: string, model: string, year?: string }
 * Response: { scale_length: number | null, string_count: 4-8 | null, note: string }
 *
 * --- Shopify draft order (/create-draft-order) ---
 * Request:  { pack: {...}, quantity: number }   (see handleCreateDraftOrder)
 * Response: { invoice_url: string, draft_order_id: number }
 *           or { error: string, detail?: string } on failure.
 *
 * --- Airtable add-to-job (/add-to-job) ---
 * Request:  { job: "recXXXX", pack: {...} }   (see handleAddToJob)
 * Response: { ok: true, job_name: string, linked: number }
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

// Variant ID of the "Custom String Pack" Shopify product. NOT currently
// wired into the line item below — see comment there for why. Kept here
// so we don't lose track of the variant we created (in case we revisit
// the thumbnail-via-variant approach using a different price strategy).
// gid form: gid://shopify/ProductVariant/51857357439272
// eslint-disable-next-line no-unused-vars
const CUSTOM_PACK_VARIANT_ID = 51857357439272;

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
    if (path === '/add-to-job') {
      return handleAddToJob(request, env, origin);
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

// ---- Shopify Files: upload pack label image ---------------------------

/**
 * Uploads the calculator's rendered label canvas (a base64 PNG data URL
 * captured at click-time) to Shopify Files and returns the public CDN URL.
 *
 * Flow (three GraphQL Admin API calls):
 *   1. `stagedUploadsCreate` — Shopify hands back a one-time Google Cloud
 *      Storage URL + form parameters to upload the bytes to.
 *   2. POST the binary to that staged URL as multipart/form-data.
 *   3. `fileCreate` — Shopify imports the staged file into the merchant's
 *      Files library. The response usually carries `image.url` immediately
 *      (Shopify pre-processes small PNGs fast); if not, poll once or twice.
 *
 * Returns null on any failure — the calling code treats the image as
 * optional so a failed upload doesn't block the order from being created.
 * If null, the Shopify order just won't carry the `Pack Label` property.
 */
async function uploadPackLabelToShopify(base64DataUrl, accessToken) {
  if (typeof base64DataUrl !== 'string' || !base64DataUrl.startsWith('data:image/')) {
    return null;
  }
  const commaIdx = base64DataUrl.indexOf(',');
  if (commaIdx < 0) return null;
  const base64Data = base64DataUrl.slice(commaIdx + 1);

  let binary;
  try {
    binary = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  } catch (_e) {
    return null;
  }
  const fileSize = binary.length;
  // Sanity cap — pack labels are typically 20-80 KB. Anything over 2 MB is
  // suspicious; bail rather than burning a slow upload on bad data.
  if (fileSize === 0 || fileSize > 2 * 1024 * 1024) return null;

  const filename = `custom-pack-label-${Date.now()}.png`;
  const graphqlUrl = `https://${SHOPIFY_SHOP_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const headers = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': accessToken,
  };

  // Step 1 — stagedUploadsCreate. Asks Shopify for a one-time upload URL.
  const stagedQuery = `
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters { name value }
        }
        userErrors { field message }
      }
    }
  `;
  const stagedVars = {
    input: [{
      resource: 'IMAGE',
      filename,
      mimeType: 'image/png',
      httpMethod: 'POST',
      fileSize: String(fileSize),
    }],
  };

  let target;
  try {
    const stagedRes = await fetch(graphqlUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: stagedQuery, variables: stagedVars }),
    });
    const stagedJson = await stagedRes.json();
    target = stagedJson?.data?.stagedUploadsCreate?.stagedTargets?.[0];
    if (!target?.url || !target?.resourceUrl) return null;
  } catch (_e) {
    return null;
  }

  // Step 2 — POST the binary to Shopify's staged URL. Order of form fields
  // matters: Shopify's GCS-backed upload expects `parameters` first, then
  // the file last. (FormData preserves append order.)
  try {
    const formData = new FormData();
    for (const p of target.parameters || []) {
      formData.append(p.name, p.value);
    }
    formData.append('file', new Blob([binary], { type: 'image/png' }), filename);
    const uploadRes = await fetch(target.url, { method: 'POST', body: formData });
    if (!uploadRes.ok) return null;
  } catch (_e) {
    return null;
  }

  // Step 3 — fileCreate. Imports the staged blob as a Shopify File asset.
  const fileQuery = `
    mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          id
          fileStatus
          ... on MediaImage { image { url } }
        }
        userErrors { field message }
      }
    }
  `;
  const fileVars = {
    files: [{
      originalSource: target.resourceUrl,
      contentType: 'IMAGE',
      alt: 'Rosco Custom String Pack label',
    }],
  };

  let fileNode;
  try {
    const fileRes = await fetch(graphqlUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: fileQuery, variables: fileVars }),
    });
    const fileJson = await fileRes.json();
    fileNode = fileJson?.data?.fileCreate?.files?.[0];
    if (!fileNode) return null;
    if (fileNode.image?.url) return fileNode.image.url;
  } catch (_e) {
    return null;
  }

  // Step 3b — poll once or twice for the CDN URL. Shopify's image
  // processing is usually <1s for a 20-80 KB PNG but isn't guaranteed
  // synchronous. We poll up to 4× at 750 ms = ~3s worst case before
  // giving up and letting the order go through without the property.
  if (!fileNode.id) return null;
  const pollQuery = `
    query getFile($id: ID!) {
      node(id: $id) {
        ... on MediaImage {
          id
          fileStatus
          image { url }
        }
      }
    }
  `;
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r, 750));
    try {
      const pollRes = await fetch(graphqlUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: pollQuery, variables: { id: fileNode.id } }),
      });
      const pollJson = await pollRes.json();
      const url = pollJson?.data?.node?.image?.url;
      if (url) return url;
    } catch (_e) {
      // Keep polling — transient errors shouldn't kill the upload.
    }
  }
  return null;
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
  // D'Addario part number per string — used to match Airtable String
  // Inventory exactly when the order is fulfilled. Sent by the calculator
  // as `part_number` on each string (the prod_code that priced it).
  const partList = pack.strings
    .map((s) => s.part_number || '')
    .filter(Boolean)
    .join(' / ');

  const estGrams = estimatePackWeightGrams(pack.strings);
  const properties = [
    { name: 'Tuning', value: String(pack.tuning || '—') },
    { name: 'Scale Length', value: pack.scale ? `${pack.scale}"` : '—' },
    { name: 'String Count', value: String(pack.string_count || pack.strings.length) },
    { name: 'Gauges (low to high)', value: gaugeList || '—' },
  ];
  if (noteList) properties.push({ name: 'Notes (low to high)', value: noteList });
  if (typeList) properties.push({ name: 'String Types', value: typeList });
  // Visible weight as a property — Shopify's per-line-item `grams` field
  // doesn't always carry through on custom line items (no variant), so
  // surfacing the number here lets Clayton type it into the label dialog
  // manually if needed.
  properties.push({ name: 'Weight (est.)', value: `${estGrams} g` });
  // D'Addario part numbers — merchant-only. The underscore prefix hides this
  // from the customer's cart, checkout, and order confirmation (same trick as
  // `_Pack Label` below); it stays visible in the Shopify admin order and is
  // read by the Make.com automation to deduct Airtable String Inventory.
  if (partList) {
    properties.push({ name: '_Part Numbers (low to high)', value: partList });
  }

  // Upload the rendered pack label canvas (PNG) to Shopify Files and add
  // its public CDN URL as a customer-visible `Pack Label` property. This
  // is a best-effort upload: failure (network blip, image too large, etc)
  // returns null and we just skip the property — the order still goes
  // through. Cap added at the helper to avoid wedging checkout on huge
  // images. Cost: 3-4 GraphQL calls + 1 multipart upload ≈ 1-3s per order.
  if (pack.imageDataUrl) {
    try {
      const labelImageUrl = await uploadPackLabelToShopify(pack.imageDataUrl, accessToken);
      if (labelImageUrl) {
        properties.push({ name: 'Pack Label', value: labelImageUrl });
      }
    } catch (_e) {
      // Defensive — helper already swallows its own errors, but belt-and-
      // suspenders: never let an image upload glitch kill the order.
    }
  }

  // Deep-link to the calculator in "print mode" — encodes the pack spec
  // into a URL Clayton can click from the order to render and print the
  // label image. Property name is prefixed with underscore so Shopify
  // hides it from the customer's order confirmation; merchant only.
  try {
    const packSpec = {
      v: 1,
      c: pack.string_count || pack.strings.length,
      s: pack.scale,
      t: pack.tuning || '',
      st: pack.strings.map((s) => ({
        n: s.string_num,
        no: s.note,
        g: s.gauge_display || (typeof s.gauge === 'number' ? String(s.gauge) : s.gauge),
        ty: s.type || 'wound',
        t: s.tension_lbs,
        pn: s.part_number || '',
      })),
      // Label-info text the customer entered — drives the banner.
      n: pack.label_name || '',
      gt: pack.label_guitar || '',
      bn: pack.label_band || '',
    };
    // btoa expects Latin-1; pass through encodeURIComponent + escape to
    // handle any UTF-8 chars in tuning names safely.
    const json = JSON.stringify(packSpec);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    const labelUrl = `https://claytonbeaubien.github.io/rosco-custom-strings/?print=${encodeURIComponent(b64)}`;
    properties.push({ name: '_Pack Label (print)', value: labelUrl });
  } catch (_e) {
    // Non-fatal — order still works without the deep link.
  }

  const title = String(
    pack.title || `Custom String Pack — ${pack.tuning || ''} ${pack.scale ? pack.scale + '"' : ''}`
  ).trim().slice(0, 200);

  const draftPayload = {
    draft_order: {
      line_items: [
        {
          // NOTE: we tried setting `variant_id: CUSTOM_PACK_VARIANT_ID` here
          // to get a branded thumbnail on the line item, but Shopify's
          // REST Draft Order API silently inherits the variant's price
          // ($0.00 on our placeholder variant) and ignores the `price`
          // override below — every order came through at $0. Reverted to a
          // pure custom line item so per-pack pricing works again. The
          // empty image placeholder on the order summary returns until we
          // sort the right pattern (likely: update variant price on the
          // fly via GraphQL `productVariantsBulkUpdate` before creating
          // the draft order, or switch to GraphQL DraftOrderCreate which
          // honors `originalUnitPrice` on variant line items).
          title,
          price: pack.price.toFixed(2),
          quantity: qty,
          taxable: true,
          requires_shipping: true,
          // Weight in grams — drives real-time Canada Post rates and gives
          // Shopify-Shipping label-creation a sensible default if you ever
          // turn that on. Estimator is conservative (rounds up).
          grams: estGrams,
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

// ---- Add a built string pack to an Airtable Guitar Job (/add-to-job) ----
const AT_BASE = 'appB5AOWKFwyj52WM';
const AT_JOBS = 'tblk4CXNS4cRWmwJw';
const AT_INV  = 'tblVHXIHxVJIyLnmK';   // String Inventory (Item Name = D'Addario part #)
const AT_F = {
  gauges:  'fldZlrKMP1zomQaIn',  // Installed Gauges   (text, report display)
  tension: 'fldFqf7zOSqsVqXSM',  // Installed Tension  (text)
  parts:   'fldm0P61QszTI7wX4',  // Installed Parts    (text, full record)
  custom:  'fldma6QzMGisAdsav',  // Custom Strings Used (link -> String Inventory; drives deduction)
  price:   'fldtpvACk9Y6bDs0S',  // Pack Price (currency) -> drives Strings Charge on the invoice
  image:   'fldCkNJZUzgJGHByS',  // Strings Installed (Image) (attachment, report pack image)
};

async function handleAddToJob(request, env, origin) {
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: 'Invalid request body.' }, 400, origin); }
  const job = String(body.job || '');
  const pack = body.pack;
  if (!/^rec[A-Za-z0-9]{14}$/.test(job)) return jsonResponse({ error: 'Bad job id.' }, 400, origin);
  if (!pack || !Array.isArray(pack.strings) || pack.strings.length === 0) return jsonResponse({ error: 'No pack.' }, 400, origin);
  if (!env.AIRTABLE_TOKEN) return jsonResponse({ error: 'Worker missing AIRTABLE_TOKEN.' }, 500, origin);

  const atHeaders = { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' };

  // low -> high == lowest pitch first == highest string_num first
  const ordered = [...pack.strings].sort((a, b) => (b.string_num || 0) - (a.string_num || 0));
  const fmtGauge = (g) => { const n = parseInt(String(g).replace(/[^0-9]/g, ''), 10); return isNaN(n) ? String(g) : '.' + String(n).padStart(3, '0'); };
  const gauges  = ordered.map(s => fmtGauge(s.gauge)).join(' ');
  const tension = ordered.map(s => (s.tension_lbs != null ? s.tension_lbs : '')).join(' ').trim();
  const partsTxt = ordered.map(s => s.part_number || '').join(' ').trim();

  // Match each part number -> String Inventory record (Item Name == part #).
  // Distinct parts only; the Invoice & Deduct automation handles quantity.
  const linkIds = [];
  for (const p of [...new Set(ordered.map(s => s.part_number).filter(Boolean))]) {
    try {
      const url = `https://api.airtable.com/v0/${AT_BASE}/${AT_INV}?maxRecords=1&filterByFormula=` +
        encodeURIComponent(`{Item Name}='${String(p).replace(/'/g, "\\'")}'`);
      const r = await fetch(url, { headers: atHeaders });
      const j = await r.json();
      if (j.records && j.records[0]) linkIds.push(j.records[0].id);
    } catch (_) {}
  }

  // Write the spec back to the job (overwrite). Clear the image so the new one is the only one.
  const fields = {};
  fields[AT_F.gauges]  = gauges;
  fields[AT_F.tension] = tension;
  fields[AT_F.parts]   = partsTxt;
  fields[AT_F.custom]  = linkIds;          // [] clears it if nothing matched
  fields[AT_F.price]   = (typeof pack.price === 'number' && pack.price > 0) ? pack.price : null;  // blank for BYO/unpriced
  if (pack.imageDataUrl) fields[AT_F.image] = []; // clear, re-upload below
  let jobRec;
  try {
    const r = await fetch(`https://api.airtable.com/v0/${AT_BASE}/${AT_JOBS}/${job}`, {
      method: 'PATCH', headers: atHeaders, body: JSON.stringify({ fields }),
    });
    if (!r.ok) return jsonResponse({ error: 'Airtable write failed.', detail: (await r.text()).slice(0, 300) }, 502, origin);
    jobRec = await r.json();
  } catch (e) { return jsonResponse({ error: 'Airtable error.', detail: String(e).slice(0, 200) }, 502, origin); }

  // Upload the pack-label PNG straight to the attachment field (Airtable content API).
  if (typeof pack.imageDataUrl === 'string' && pack.imageDataUrl.startsWith('data:image/')) {
    try {
      const b64 = pack.imageDataUrl.slice(pack.imageDataUrl.indexOf(',') + 1);
      await fetch(`https://content.airtable.com/v0/${AT_BASE}/${job}/${AT_F.image}/uploadAttachment`, {
        method: 'POST', headers: atHeaders,
        body: JSON.stringify({ contentType: 'image/png', file: b64, filename: `custom-pack-${Date.now()}.png` }),
      });
    } catch (_) {}
  }

  const jobName = (jobRec && jobRec.fields && jobRec.fields['Job #']) || '';
  return jsonResponse({ ok: true, job_name: jobName, linked: linkIds.length }, 200, origin);
}

// ---- weight estimation -------------------------------------------------

/**
 * Estimate total shipping weight (in grams) for a string pack so Shopify can
 * quote real-time carrier rates correctly. Uses gauge + type to weight each
 * string, then adds a packaging allowance for the padded envelope, label,
 * insert, and a small margin.
 *
 * Calibrated against real D'Addario set weights (e.g. EXL110 nickel-wound
 * 10-46 ≈ 25g of strings + ~20g packaging; EXL170 bass 45-100 ≈ 100g of
 * strings + ~30g packaging). Rounds slightly up so we err on the carrier's
 * side rather than under-quoting shipping.
 *
 * Coefficients:
 *   PACKAGING_GRAMS = padded envelope + Rosco label + invoice + margin
 *   PLAIN_PER_GAUGE = grams per inch of gauge for plain steel singles
 *                     .010 → ~0.7g  .020 → ~1.3g
 *   WOUND_BASE      = the ball end / wrap-attach mass (constant per string)
 *   WOUND_PER_GAUGE = grams per inch of gauge for wound singles
 *                     .026 → ~6g  .046 → ~14g  .105 → ~36g  .135 → ~47g
 */
function estimatePackWeightGrams(strings) {
  const PACKAGING_GRAMS = 45;
  const PLAIN_PER_GAUGE = 65;
  const WOUND_BASE = 3;
  const WOUND_PER_GAUGE = 380;

  let total = PACKAGING_GRAMS;
  for (const s of (strings || [])) {
    if (!s) continue;
    // Gauges come through from the browser as strings ("60", "39", "28w").
    // Browser stores gauge in inches as a fraction string -> the calc
    // ALSO uses ".XXX" form. Cope with either: parseFloat first; if it
    // looks like an integer >= 5 we have the "60" / "28w" form (mils),
    // convert to inches by /1000.
    const raw = parseFloat(s.gauge);
    if (isNaN(raw)) continue;
    const g = raw >= 5 ? raw / 1000 : raw;
    if (s.type === 'plain') {
      total += Math.max(0.5, g * PLAIN_PER_GAUGE);
    } else {
      total += Math.max(WOUND_BASE, WOUND_BASE + (g - 0.018) * WOUND_PER_GAUGE);
    }
  }
  return Math.round(total);
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
