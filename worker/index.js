/**
 * Rosco Scale Lookup — Cloudflare Worker
 *
 * Proxies guitar scale-length lookups to Anthropic's API. Holds the API key
 * as an encrypted Cloudflare secret so it never leaves the browser. Endpoint
 * is called by the "Don't know your scale length? Find it for me" panel in
 * the Rosco Custom Strings calculator.
 *
 * Endpoint: POST /
 * Request:  { brand: string, model: string, year?: string }
 * Response: { scale_length: number | null, note: string }
 *
 * scale_length is null when Claude isn't reasonably confident; the browser
 * shows the friendly note from Claude in that case and leaves the customer
 * to pick manually.
 */

// Browsers allowed to call this Worker. Edit and redeploy when adding a new
// site (e.g. when the calculator embeds on roscoguitars.com).
const ALLOWED_ORIGINS = [
  'https://claytonbeaubien.github.io',
  'https://roscoguitars.com',
  'https://www.roscoguitars.com',
];

// Anthropic model. Sonnet 4.5 — significantly sharper than Haiku on niche
// instrument questions (e.g. recognizing a Fender Jazz Bass as a 34" long-
// scale bass, not a guitar). Per-lookup cost is still under a cent.
const MODEL = 'claude-sonnet-4-5-20250929';

const SYSTEM_PROMPT = `You are a guitar and bass specification lookup tool. You ONLY answer questions about guitar/bass scale lengths.

Given a brand, model, and optional year, respond with EXACTLY ONE JSON object — no other text, no markdown, no code fences:

{"scale_length": <number_or_null>, "note": "<short sentence>"}

Rules:
- First, decide whether the instrument is a guitar or a bass based on the model name. Bass models include "Bass", "Jazz Bass", "Precision Bass / P-Bass", "Stingray", "Thunderbird", "Rickenbacker 4xxx", "BB", "SR", etc.
- scale_length: a real number in inches. Typical ranges:
  - Guitar: 24.0 – 28.625 (most common: 24.75 Gibson, 25.0 PRS, 25.5 Fender)
  - Baritone guitar: 26.5 – 30.0
  - Bass: 30 short-scale, 32 medium-scale, 34 long-scale (most common), 35 super-long, 36 extra-long
  - Use null if you cannot identify the model or aren't reasonably confident.
- note: ONE short sentence about the instrument, under 180 characters. If scale_length is null, write a friendly and lightly playful "couldn't find it" message — luthier humor is welcome but keep it brief and original.

Examples:
{"scale_length": 25.5, "note": "Standard Fender guitar scale, used on Strats and Teles."}
{"scale_length": 24.75, "note": "Classic Gibson scale, slightly shorter than Fender."}
{"scale_length": 25.0, "note": "PRS uses a 25-inch scale — between Gibson and Fender."}
{"scale_length": 27.0, "note": "Common extended scale for 7-string and baritone guitars."}
{"scale_length": 28.625, "note": "Standard Ibanez 8-string scale length."}
{"scale_length": 34.0, "note": "Standard Fender long-scale bass — Precision and Jazz both use it."}
{"scale_length": 34.0, "note": "Music Man StingRay long-scale bass, 34 inches like most modern basses."}
{"scale_length": 35.0, "note": "Super-long scale, common on 5-string basses for tighter low B."}
{"scale_length": 33.25, "note": "Rickenbacker bass scale — slightly shorter than Fender's 34."}
{"scale_length": 30.0, "note": "Short-scale bass, like a Fender Mustang Bass or Hofner violin bass."}
{"scale_length": null, "note": "Stumped on that one — even our resident luthier shrugged. Try a different spelling or pick a scale manually."}
{"scale_length": null, "note": "Couldn't pin that one down. Maybe a typo, maybe a one-off custom — manual pick from the list works just fine."}

Refuse any non-instrument request by returning {"scale_length": null, "note": "Not a guitar or bass lookup."}.`;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // CORS preflight — must respond before the origin check kicks in.
    if (request.method === 'OPTIONS') {
      return preflightResponse(origin);
    }

    // Origin allowlist (production browsers only)
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return jsonResponse(
        { scale_length: null, note: 'Forbidden origin.' },
        403,
        origin
      );
    }

    // POST only beyond this point
    if (request.method !== 'POST') {
      return jsonResponse(
        { scale_length: null, note: 'POST requests only.' },
        405,
        origin
      );
    }

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
          max_tokens: 200,
          system: SYSTEM_PROMPT,
          messages: [
            { role: 'user', content: `What is the scale length of a ${desc}?` },
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

    // Parse Claude's reply
    const text = (apiData?.content?.[0]?.text || '').trim();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
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
    const note = (typeof parsed.note === 'string' ? parsed.note : '').slice(0, 240);

    return jsonResponse({ scale_length, note }, 200, origin);
  },
};

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
