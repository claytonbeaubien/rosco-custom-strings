# Generator update: move job banner to the top + pre-fill scale / tuning / string count

Builds on the already-shipped job banner. Three edits to **`index.html`** (repo root) plus
one Airtable button formula tweak. No Worker changes.

What changes for a tech opening **Build String Pack** from a job:
1. The "Building pack for…" banner moves to the **top** of the page (under the header,
   above the price row) instead of the bottom.
2. The generator opens with the guitar's **string count, scale length, and tuning already
   selected** - pulled from the job's `Scale Length` and `Tuning` fields. (Public visitors
   with no `?job=` see no change.)

The job's `Tuning` value arrives as `"Drop C - 6"` (name + string count), and `Scale Length`
as `"24.75"` / `"25"` etc. The generator parses count + name from the tuning string and
matches the scale to the nearest dropdown option, so no new Airtable fields are needed.

---

## Edit 1 - move the banner element above `.main` (find this exact block)

```html
<div class="main">

  <!-- Internal job-mode banner - shows which Airtable job this pack is for (?job=…&jn=…&cl=…&gt=…) -->
  <div id="job-banner" style="display:none"></div>
```

Replace with:

```html
<!-- Internal job-mode banner - shows which Airtable job this pack is for (?job=…&jn=…&cl=…&gt=…). Placed above .main so the CSS grid doesn't push it to the bottom. -->
<div id="job-banner" style="display:none"></div>

<div class="main">
```

## Edit 2 - restyle the banner for the new top placement (find this exact line)

```js
      banner.style.cssText = 'background:#e7f5f3;border:1px solid #9ed4cd;color:#0f6f64;border-radius:10px;padding:10px 14px;margin:0 0 16px;font-weight:600;font-size:14px;text-align:center';
```

Replace with:

```js
      banner.style.cssText = 'max-width:1132px;width:calc(100% - 32px);margin:18px auto 0;padding:12px 18px;box-sizing:border-box;background:#e7f5f3;border:1px solid #9ed4cd;color:#0f6f64;border-radius:10px;font-weight:600;font-size:15px;text-align:center';
```

## Edit 3a - add the pre-fill function (find this exact line)

```js
const JOB_ID = (() => { const j = new URLSearchParams(location.search).get('job'); return /^rec[A-Za-z0-9]{14}$/.test(j || '') ? j : null; })();
```

Insert this **immediately after** that line:

```js
// Pre-select string count + scale + tuning from the Airtable job. The Build String
// Pack button passes &sc=<scale> and &tn=<tuning>, where tuning is "Name - N"
// (N = string count), e.g. "Drop C - 6". Called once from init() after the default
// pack is set, so it overrides the defaults with the guitar's actual setup. Anything
// that doesn't match a known option is skipped gracefully.
function applyJobConfigFromURL(){
  if(!JOB_ID) return;
  const p = new URLSearchParams(location.search);
  const scRaw = (p.get('sc') || '').trim();
  const tnRaw = (p.get('tn') || '').trim();
  if(!scRaw && !tnRaw) return;
  let tuningName = tnRaw, count = null;
  const m = tnRaw.match(/^(.*?)\s*-\s*(\d+)\s*$/);
  if(m){ tuningName = m[1].trim(); count = parseInt(m[2], 10); }
  // 1) String count first - it rebuilds the scale options and the tuning list.
  if([4,5,6,7,8].includes(count) && count !== stringCount){
    setStringCount(count);
  }
  // 2) Scale - match the closest dropdown option by number ("25" -> "25.0").
  if(scRaw){
    const target = parseFloat(scRaw.replace(/[^0-9.]/g, ''));
    const sel = document.getElementById('scale-sel');
    if(!isNaN(target) && sel){
      let best = null, bestDiff = Infinity;
      [...sel.options].forEach(o => { const v = parseFloat(o.value); const d = Math.abs(v - target); if(d < bestDiff){ bestDiff = d; best = o.value; } });
      if(best != null && bestDiff <= 0.3){ sel.value = best; }
    }
  }
  // 3) Tuning - exact name match within the current string-count's list.
  if(tuningName){
    const sel = document.getElementById('tuning-sel');
    if(sel){
      const opt = [...sel.options].find(o => o.value.toLowerCase() === tuningName.toLowerCase());
      if(opt){ sel.value = opt.value; }
    }
  }
  onConfigChange();
  updateScaleNavBtns();
  updateTuningNavBtns();
}
```

## Edit 3b - call it from init() (find this exact block)

```js
  setStringCount(stringCount);
  buildQR();
```

Replace with:

```js
  setStringCount(stringCount);
  applyJobConfigFromURL();
  buildQR();
```

(There is only one `setStringCount(stringCount);` immediately followed by `buildQR();` - it's inside `async function init()`.)

---

## Airtable - update the Build String Pack button formula

Append two params (`&sc=` scale, `&tn=` tuning) so the generator receives them:

```
"https://claytonbeaubien.github.io/rosco-custom-strings/?job=" & RECORD_ID()
& "&jn=" & ENCODE_URL_COMPONENT({Job #} & "")
& "&cl=" & ENCODE_URL_COMPONENT({Client Name Text} & "")
& "&gt=" & ENCODE_URL_COMPONENT({Make - Model (from Guitar)} & "")
& "&sc=" & ENCODE_URL_COMPONENT({Scale Length} & "")
& "&tn=" & ENCODE_URL_COMPONENT({Tuning} & "")
```

That's it - three index.html edits + the button formula.
