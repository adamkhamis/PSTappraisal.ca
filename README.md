# PST Appraisal BC

A website for BC private-sale vehicle PST appraisals. Customers fill in the vehicle details, upload photos and pay with Stripe. You review each order in `/admin`, approve or change the value in one click, and the client gets the PDF appraisal by email.

## Run it locally
```bash
npm install
cp .env.example .env      # then edit it
npm start                 # http://localhost:3000   admin: http://localhost:3000/admin
```
Without Stripe keys, orders are marked paid with no charge (test mode). Without SMTP settings, emails and PDFs are saved to `output/` instead of being sent.

## How it works
1. The customer fills in the form at `/` and uploads at least 4 photos.
2. The customer pays through Stripe Checkout (CAD, price set by `PRICE_CENTS`).
3. Stripe confirms the payment and the order appears in **Admin → Ready to review**.
4. Type the appraised value (it starts at the purchase price) and click **Approve & email**. You can do this right from the list, or open the order to see photos, add notes and **Preview PDF** first.
5. The PDF(s) are built and emailed to the client. You get a BCC if `MAIL_BCC` is set, and the order moves to **Sent**, where you can re-send it.

## Stripe setup
- Put your secret key in `STRIPE_SECRET_KEY`.
- In Dashboard → Developers → Webhooks, add `https://pstappraisal.ca/webhook/stripe` for the `checkout.session.completed` event, then put its signing secret in `STRIPE_WEBHOOK_SECRET`.
- Payment is also confirmed when the customer returns from Stripe, so the webhook is a backup.

## Filling the official FIN 320 form
BC's appraisal form is **FIN 320, Motor Vehicle Appraisal** (gov.bc.ca → Taxes → PST → Forms).
1. Save it as `templates/official-form.pdf`.
2. Run `npm run fields` to list its fillable field names.
3. Copy `templates/field-map.example.json` to `templates/field-map.json` and map each PDF field to a data key.

After that, every approval attaches the filled FIN 320 as well as the branded certificate. If the form needs a handwritten signature, put a PNG of your signature at `SIGNATURE_IMAGE`.

## Going live
- **CanSpace (cPanel):** follow [DEPLOY-CANSPACE.md](DEPLOY-CANSPACE.md).
- Any other Node 18+ host works too. Keep `data/` and `uploads/` on a persistent disk, set `BASE_URL` to your real domain, and use HTTPS.
