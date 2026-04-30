# Shopify Checkout — Punch List

*Last updated: April 30, 2026*

Where we left off: the custom-pack → Shopify checkout flow is **working end-to-end** in code. A draft order gets created with the exact pack price, shipping/tax calculated, line-item properties showing tuning/scale/gauges/notes/types. Tested with an 8-string Drop E pack — landed cleanly on Shopify checkout at $32.00 + shipping + tax.

---

## 1. Deploy what's currently on disk (do this first)

These changes are sitting in the working tree, not yet live.

- [ ] **Redeploy the Worker.** Cloudflare → Workers & Pages → `rosco-scale-lookup` → Edit Code → paste the entire updated `worker/index.js` → Deploy.
  - Latest changes: form-encoded OAuth (auth fix), arrow `→` swap to "to" (rendering fix), and `grams` weight estimator on the line item (so real-time Canada Post rates will quote correctly when you turn them on).
- [ ] **Commit + push `index.html` and `worker/index.js`** via GitHub Desktop.
  - Suggested messages:
    - `feat(worker): add /create-draft-order endpoint with Shopify Draft Orders + line-item weight`
    - `feat(buy): replace 'coming soon' with summary modal + Shopify checkout flow`

---

## 2. Shopify configuration (no code, all in your admin)

### Shipping zones
- [ ] **Settings → Shipping and delivery → General shipping rates** — review or create:
  - **Canada** — flat $5.00 standard (covers most string-pack envelopes via lettermail / oversized lettermail). Optionally add an expedited tier if customers ask.
  - **United States** — flat $12.00 (Tracked Packet USA up to ~250g lands here).
  - **International** — $25.00, OR disable until you decide.
  - **Free shipping over $X** — optional. Most single-pack orders won't hit it; useful as an "add another pack" lever.

### Shopify Shipping (Canada Post discounts + label printing)
- [ ] **Settings → Shipping and delivery → Shopify Shipping → Set up.** Free, gives discounted Canada Post rates at the order screen and lets you print labels right inside Shopify.
- [ ] Compare against your existing Canada Post business account on a real order — keep using whichever's cheaper for that shipment.

### Local pickup (Falkland)
- [ ] **Settings → Shipping and delivery → Local pickup → Set up** on your Falkland location.
  - Pickup instructions: `"I'll text you when ready. Pickup hours: weekdays 10–6, weekends by appointment."`
  - Estimated time: `"Usually ready same day."`
  - Cost: free.

### Local delivery (Falkland → Kelowna run, first Sunday of the month)
- [ ] **Settings → Shipping and delivery → Local delivery → Set up.**
  - Radius: ~80 km from Falkland (catches Vernon, reaches into Kelowna).
  - Rate: flat $5–10.
  - Name: `"Personal delivery — first Sunday of the month (Falkland → Kelowna)"`
  - Description: `"I drive to Kelowna the first Sunday of each month. Order by the Friday before to make that run; otherwise next month. I'll text you to coordinate handoff."`

### Test mode
- [ ] **Settings → Payments → Manage** (next to your active provider) → enable **Test mode**. Or add **Bogus Gateway** as a payment method for testing.
- [ ] **Reminder:** turn test mode OFF before going live to real customers.

---

## 3. Run a test order end-to-end

Once shipping + test mode are configured:

- [ ] Open the live calculator (or GitHub Pages preview).
- [ ] Build any pack, hit **Buy this Pack**, hit **Proceed to Checkout**.
- [ ] Enter your own shipping address (or a fake one).
- [ ] Select a shipping method — verify the rate looks right for the pack weight.
- [ ] Pay with test card `1` (or `4242 4242 4242 4242`) — any future expiry, any CVV.
- [ ] Order should land in **Shopify admin → Orders** within seconds.
- [ ] Click into the order — verify the line-item properties show the right tuning, scale, gauges, notes, types.
- [ ] Click **Print packing slip** — print it; confirm it has everything you need to pull strings from inventory.
- [ ] Click **Buy shipping label** (if Shopify Shipping is set up) — quote Canada Post, pick a rate, print the label.
- [ ] Click **Mark as fulfilled** — verify customer gets tracking email.
- [ ] **Archive the test order** so it doesn't clutter the dashboard.

Things to watch for / note for follow-up:
- [ ] Is the packing slip useful as-is, or do we need to add the pack image / extra info to it?
- [ ] How long does the whole flow actually take per order?
- [ ] Any friction points (where you fumble or have to double-check something)?

---

## 4. Go live

After test order goes smoothly:

- [ ] Turn off test mode in Shopify payments.
- [ ] Place one real order against yourself with a real card just to confirm the live payment path. Refund yourself afterward.
- [ ] Tell the world. Probably worth a post / Instagram story / email blast — the calculator going from "coming soon" to "click here to order custom strings" is a real product launch.

---

## 5. Future code work (separate sessions, doesn't block launch)

In rough priority order:

- [ ] **Make.com → Airtable inventory deduction.** Shopify "Order Created" webhook → Make → parse line-item properties → decrement Airtable D'Addario singles inventory by gauge. Tracked as task #5 in our session.
- [ ] **Pack image on the packing slip.** Right now the canvas image only lives in the customer's modal — not on the order. We could add it as an order-level metafield so it shows on packing slips and order detail pages.
- [ ] **Update `worker/README.md`** to document the new `/create-draft-order` endpoint and the two new env vars (`SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`).
- [ ] **Job/customer linking in Airtable.** Phase 2 from `PROJECT_STATUS.md` — "Save Pack" button that logs the string set into the Guitar Shop Management base, optionally linked to an active job.
- [ ] **UX polish** based on whatever you observe with the first few real customers.

---

## Reference: Worker + secrets

- Worker URL: `https://rosco-scale-lookup.clayton-18a.workers.dev/`
- Endpoint added: `POST /create-draft-order`
- Cloudflare env vars set:
  - `ANTHROPIC_API_KEY` (Secret) — existing
  - `SHOPIFY_CLIENT_ID` (Text) — Dev Dashboard custom app Client ID
  - `SHOPIFY_CLIENT_SECRET` (Secret) — Dev Dashboard custom app Client Secret
- Hardcoded in `worker/index.js`:
  - `SHOPIFY_SHOP_DOMAIN = 'jaubtg-0b.myshopify.com'`
  - `SHOPIFY_API_VERSION = '2026-04'`

## Reference: Shopify app

- App name: **Rosco Custom Pack Tool** (in Dev Dashboard)
- Active version: `rosco-custom-pack-tool-1`
- Scopes: `write_draft_orders`, `read_draft_orders`, `write_orders`, `read_products`
- Installed on: `jaubtg-0b.myshopify.com` (Rosco Guitars Shop)
