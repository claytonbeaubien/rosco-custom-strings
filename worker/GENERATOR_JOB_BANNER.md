# Generator change: job-context banner ("Building pack for J### · Client · Guitar")

Two tiny edits to **`index.html`** (root of the repo, the generator). When the page is
opened from the Airtable job button it now also receives `&jn=` (Job #), `&cl=` (client),
and `&gt=` (guitar make-model) in the URL, and shows a teal banner at the top so the tech
knows exactly which job they're building a pack for. Public visitors (no `?job=`) see no change.

No Worker changes. No new functions - this only reads URL params and writes a banner element.

## Edit 1 - add the banner element (find this exact line)

```html
<div class="main">
```

Replace with:

```html
<div class="main">

  <!-- Internal job-mode banner - shows which Airtable job this pack is for (?job=…&jn=…&cl=…&gt=…) -->
  <div id="job-banner" style="display:none"></div>
```

## Edit 2 - populate the banner (find this exact block)

```js
document.addEventListener('DOMContentLoaded', () => {
  if(JOB_ID){
    const buy = document.getElementById('buy-btn'); if(buy) buy.style.display = 'none';
    const atj = document.getElementById('add-to-job-btn'); if(atj) atj.style.display = '';
    document.title = 'Add to Job - Rosco Strings';
  }
});
```

Replace with:

```js
document.addEventListener('DOMContentLoaded', () => {
  if(JOB_ID){
    const buy = document.getElementById('buy-btn'); if(buy) buy.style.display = 'none';
    const atj = document.getElementById('add-to-job-btn'); if(atj) atj.style.display = '';
    document.title = 'Add to Job - Rosco Strings';
    // Job context banner (job #, client, guitar passed via the Airtable button URL)
    const p = new URLSearchParams(location.search);
    const bits = [p.get('jn'), p.get('cl'), p.get('gt')].map(s => (s || '').trim()).filter(Boolean);
    const banner = document.getElementById('job-banner');
    if(banner && bits.length){
      const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      banner.innerHTML = '<span style="text-transform:uppercase;font-size:11px;letter-spacing:.08em;color:#159385;font-weight:700">Building pack for</span>&nbsp;&nbsp;'
        + bits.map(esc).join('&nbsp;&nbsp;<span style="color:#159385">·</span>&nbsp;&nbsp;');
      banner.style.cssText = 'background:#e7f5f3;border:1px solid #9ed4cd;color:#0f6f64;border-radius:10px;padding:10px 14px;margin:0 0 16px;font-weight:600;font-size:14px;text-align:center';
    }
  }
});
```

That's it - two edits, no other changes.
