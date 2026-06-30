# Worker task: add `POST /add-to-job` to `rosco-scale-lookup`

Adds the **internal** twin of the Shopify flow: the generator (opened from an Airtable
job button at `…/?job=recXXXX`) posts the built pack here, and we write it back onto the
Guitar Jobs record so the Service Report auto-fills and stock deducts.

This goes in the **existing** Worker (`worker/index.js`) alongside `/` and
`/create-draft-order`. Reuse its `jsonResponse`, CORS, and `ALLOWED_ORIGINS` (github.io is
already allowlisted). Then `wrangler deploy`.

## 1. New secret

```
wrangler secret put AIRTABLE_TOKEN
```
Use an Airtable **Personal Access Token** scoped to base `appB5AOWKFwyj52WM` with:
`data.records:read`, `data.records:write`, and **attachment upload** permission.

## 2. Route (add in the dispatcher, before the `/` route)

```js
if (path === '/add-to-job') {
  return handleAddToJob(request, env, origin);
}
```

## 3. Handler (paste near handleCreateDraftOrder)

```js
// ---- Add a built string pack to an Airtable Guitar Job (/add-to-job) ----
const AT_BASE = 'appB5AOWKFwyj52WM';
const AT_JOBS = 'tblk4CXNS4cRWmwJw';
const AT_INV  = 'tblVHXIHxVJIyLnmK';   // String Inventory (Item Name = D'Addario part #)
const AT_F = {
  gauges:  'fldZlrKMP1zomQaIn',  // Installed Gauges   (text, report display)
  tension: 'fldFqf7zOSqsVqXSM',  // Installed Tension  (text)
  parts:   'fldm0P61QszTI7wX4',  // Installed Parts    (text, full record)
  custom:  'fldma6QzMGisAdsav',  // Custom Strings Used (link -> String Inventory; drives deduction)
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
```

## 4. Notes / what the front-end sends

The generator POSTs:
```json
{ "job": "recXXXXXXXXXXXXXX",
  "pack": { "tuning": "...", "scale": 37, "string_count": 5, "instrument": "bass",
            "imageDataUrl": "data:image/png;base64,...",
            "strings": [ { "string_num": 1, "note": "E3", "gauge": "35", "part_number": "XLB035", "tension_lbs": 34.0 }, ... ] } }
```
- `string_num` 1 = highest/thinnest; we sort to low→high for the text fields.
- `part_number` is the **user-selected** part (e.g. `XB130TSL`), already correct for the scale.
- Returns `{ ok: true, job_name, linked }` (linked = how many parts matched inventory).

## 5. Deduction prerequisite

`Custom Strings Used` only links parts that **exist** in String Inventory. A few newer parts
(tapered super-longs `XB125TSL…XB170TSL`, `XLB067`, `XLB130T`, `XLB165T`) aren't in inventory
yet - Cowork/Clayton is adding them at 0 stock so every pack can match. Unmatched parts still
land in the text **Installed Parts** field; they just won't deduct until the record exists.
