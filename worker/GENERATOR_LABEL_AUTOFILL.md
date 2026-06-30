# Generator update: auto-fill Label Info (Name / Guitar / Band) from the job

Small follow-on to the job pre-fill. When the generator is opened from a job, also pre-fill
the **Label Info** card so the printed pack label is personalized automatically:

- **Name**  ← client name (already passed as `&cl`)
- **Guitar** ← make + model (already passed as `&gt`)
- **Band**  ← client's band name (new `&bn` param)

One `index.html` edit + one new line on the Airtable button formula. Public visitors (no
`?job=`) are unaffected, and any empty value is left blank.

Label Info input IDs (note: historically mislabeled): Name = `name-input`,
Guitar = `band-input`, Band = `band2-input`.

---

## Edit - extend `applyJobConfigFromURL()` (find this exact block)

```js
      if(opt){ sel.value = opt.value; }
    }
  }
  onConfigChange();
```

Replace with:

```js
      if(opt){ sel.value = opt.value; }
    }
  }
  // 4) Label info - Name (client), Guitar (make-model), Band (client's band).
  const setLabel = (id, v) => { const el = document.getElementById(id); if(el && v){ el.value = v; } };
  setLabel('name-input',  (p.get('cl') || '').trim());
  setLabel('band-input',  (p.get('gt') || '').trim());
  setLabel('band2-input', (p.get('bn') || '').trim());
  onConfigChange();
```

That's the only code change - it reuses the `cl`/`gt` params already in the URL and adds `bn`.

---

## Airtable - add one line to the Build String Pack button formula

Add the final `&bn=` line:

```
"https://claytonbeaubien.github.io/rosco-custom-strings/?job=" & RECORD_ID()
& "&jn=" & ENCODE_URL_COMPONENT({Job #} & "")
& "&cl=" & ENCODE_URL_COMPONENT({Client Name Text} & "")
& "&gt=" & ENCODE_URL_COMPONENT({Make - Model (from Guitar)} & "")
& "&sc=" & ENCODE_URL_COMPONENT({Scale Length} & "")
& "&tn=" & ENCODE_URL_COMPONENT({Tuning} & "")
& "&bn=" & ENCODE_URL_COMPONENT({Band Name (from Client)} & "")
```

After both are in, open a job's Build String Pack - Name, Guitar, and Band fill in on the
label automatically.
