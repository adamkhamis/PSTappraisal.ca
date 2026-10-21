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

## Official forms
`templates/official-form.pdf` (FIN 320) and `templates/fin-355mv.pdf` (FIN 355/MV) are the BC government forms. On approval:
- the FIN 320 is filled in with your business details (from `.env`), the purchaser, vehicle, appraised value, condition and comments, and stamped with your signature if `SIGNATURE_IMAGE` is set;
- clients who already registered also get the FIN 355/MV, pre-filled with their details and an estimated refund (refund reason 5), for them to check and sign.

The filled forms keep the government's original restrictions (printing, form filling and comments allowed). If the province releases a new version, replace the PDF and check the field names with `npm run fields` or `npm run fields -- fin-355mv.pdf`.

## Preview on GitHub Pages
The `docs/` folder is a static copy of the public pages for previewing. Turn it on in GitHub under **Settings → Pages → Deploy from a branch → main / docs**. Rebuild it after changing pages with `npm run build:preview`. Ordering and the contact form only work on the full site.

## Going live
- **CanSpace (cPanel):** follow [DEPLOY-CANSPACE.md](DEPLOY-CANSPACE.md).
- Any other Node 18+ host works too. Keep `data/` and `uploads/` on a persistent disk, set `BASE_URL` to your real domain, and use HTTPS.
