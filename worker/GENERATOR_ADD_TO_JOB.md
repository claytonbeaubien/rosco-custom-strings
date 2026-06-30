# Generator change: "Add to Job" mode (pairs with `/add-to-job` Worker endpoint)

Two small edits to **`index.html`** (root of the repo, the generator). When the page is
opened from an Airtable job button (`…/?job=recXXXX`) it hides the public "Buy this Pack"
button, shows an "Add to Job" button, and POSTs the built pack to the Worker. Public
visitors (no `?job=`) see no change.

All referenced functions already exist in `index.html` (`currentPack`, `refScale`,
`isBassInstrument`, `scaleForString`, `bassRecommendedPart`, `detectTuningName`,
`stringCount`, `showModal`, `WORKER_BASE_URL`).

## Edit 1 - the action button (find this exact line)

```html
      <button class="btn-buy" onclick="onBuyClick()" type="button">Buy this Pack</button>
```

Replace with:

```html
      <button class="btn-buy" id="buy-btn" onclick="onBuyClick()" type="button">Buy this Pack</button>
      <button class="btn-buy" id="add-to-job-btn" onclick="onAddToJobClick()" type="button" style="display:none;background:#159385;color:#fff">Add to Job</button>
      <span id="add-to-job-status" style="display:none;font-size:12px;font-weight:700;margin-left:8px"></span>
```

## Edit 2 - the JS (insert this block immediately **before** `function onBuyClick() {`)

```js
// ── Internal "Add to Job" mode - opened from an Airtable job button (?job=recXXX) ──
const JOB_ID = (() => { const j = new URLSearchParams(location.search).get('job'); return /^rec[A-Za-z0-9]{14}$/.test(j || '') ? j : null; })();
function snapshotPackForJob(){
  if(!currentPack) return null;
  const scale = refScale();
  const overrideName = (document.getElementById('tuning-name-input')?.value || '').trim();
  const tuningDisplay = overrideName || (typeof detectTuningName === 'function' ? detectTuningName() : '') || currentPack.tuning || 'Custom';
  const canvas = document.getElementById('label-canvas');
  let imageDataUrl = ''; try { imageDataUrl = canvas.toDataURL('image/png'); } catch(_){}
  const total = currentPack.strings.length;
  const strings = currentPack.strings.map(s => ({
    string_num: s.string_num,
    note: s.note,
    gauge: String(s.gauge),
    type: s.type || '',
    part_number: isBassInstrument() ? (s.part || bassRecommendedPart(s.gauge, scaleForString(s.string_num, total))) : null,
    tension_lbs: typeof s.tension_lbs === 'number' ? Math.round(s.tension_lbs * 10) / 10 : null,
  }));
  return { tuning: tuningDisplay, scale, string_count: stringCount, instrument: isBassInstrument() ? 'bass' : 'guitar', strings, imageDataUrl };
}
async function onAddToJobClick(){
  if(!JOB_ID) return;
  if(!currentPack){ showModal('No pack loaded', 'Build a pack first, then add it to the job.', false); return; }
  const btn = document.getElementById('add-to-job-btn');
  const status = document.getElementById('add-to-job-status');
  const pack = snapshotPackForJob();
  if(!pack){ showModal('No pack', 'Build a pack first.', false); return; }
  btn.disabled = true; btn.textContent = 'Adding…';
  let res, data;
  try {
    res = await fetch(`${WORKER_BASE_URL}/add-to-job`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ job: JOB_ID, pack }) });
    data = await res.json().catch(() => ({}));
  } catch(e) {
    btn.disabled = false; btn.textContent = 'Add to Job';
    status.style.display = ''; status.style.color = '#c0392b'; status.textContent = "Couldn't reach the server - try again.";
    return;
  }
  if(!res.ok || !data.ok){
    btn.disabled = false; btn.textContent = 'Add to Job';
    status.style.display = ''; status.style.color = '#c0392b'; status.textContent = (data && data.error) || ('Error ' + res.status);
    return;
  }
  btn.disabled = false; btn.textContent = '✓ Added to Job';
  status.style.display = ''; status.style.color = '#159385'; status.textContent = 'Saved to ' + (data.job_name || 'the job') + ' - you can close this tab.';
}
document.addEventListener('DOMContentLoaded', () => {
  if(JOB_ID){
    const buy = document.getElementById('buy-btn'); if(buy) buy.style.display = 'none';
    const atj = document.getElementById('add-to-job-btn'); if(atj) atj.style.display = '';
    document.title = 'Add to Job - Rosco Strings';
  }
});
```

That's it - no other changes. A pre-built copy of the finished `index.html` also exists if a
diff is preferred (Cowork has it); these two edits produce the same result.
