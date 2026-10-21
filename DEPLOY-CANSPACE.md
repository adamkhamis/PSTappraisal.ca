# Putting PSTappraisal.ca live on CanSpace

This runs the full site (payments, photo uploads, admin, emails) on your CanSpace cPanel hosting.
Allow about 30 minutes. You'll click through cPanel; nothing needs a command line.

## Before you start
- Log in to cPanel at CanSpace (Client area → your hosting → **Login to cPanel**).
- Search cPanel for **"Setup Node.js App"**. If you can't find it, ask CanSpace support:
  *"Can you enable Node.js (version 18 or newer) on my hosting so I can run a Node app?"*
- Make sure **PSTappraisal.ca** points to this hosting (if you bought the domain at CanSpace it usually already does).

## 1. Create the support email
cPanel → **Email Accounts** → **Create**: `support@pstappraisal.ca`, choose a strong password.
Then click **Connect Devices** next to it and note the **Outgoing server** (usually `mail.pstappraisal.ca`) and **SMTP port** (465).

## 2. Copy the code from GitHub
cPanel → **Git™ Version Control** → **Create**
- Clone a repository: **on**
- Clone URL: `https://github.com/adamkhamis/PSTappraisal.ca.git`
- Repository path: `pstappraisal` (keep it *outside* `public_html`)
- Repository name: `pstappraisal` → **Create**

> If you've made the GitHub repo private, cPanel needs an SSH deploy key first. Ask CanSpace support or keep the repo public.

## 3. Create the Node.js app
cPanel → **Setup Node.js App** → **Create Application**
| Setting | Value |
|---|---|
| Node.js version | The newest available (18 or higher) |
| Application mode | Production |
| Application root | `pstappraisal` |
| Application URL | `pstappraisal.ca` |
| Application startup file | `src/server.js` |

Click **Create**, then scroll to **Environment variables** and add each of these (**Add Variable**):

| Name | Value |
|---|---|
| `BASE_URL` | `https://pstappraisal.ca` |
| `ADMIN_USER` | `admin` (or any username) |
| `ADMIN_PASSWORD` | a long, strong password |
| `PRICE_CENTS` | `7000` |
| `TAX_PERCENT` | `5` (or `0` if you're not registered for GST) |
| `TAX_NAME` | `GST` |
| `TAX_NUMBER` | your GST number, if you have one |
| `STRIPE_SECRET_KEY` | from Stripe → Developers → API keys (`sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | from step 5 (`whsec_…`) |
| `SMTP_HOST` | `mail.pstappraisal.ca` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `support@pstappraisal.ca` |
| `SMTP_PASS` | the email password from step 1 |
| `MAIL_FROM` | `PST Appraisal BC <support@pstappraisal.ca>` |
| `MAIL_BCC` | `support@pstappraisal.ca` |
| `COMPANY_NAME` | `PST Appraisal BC` |
| `COMPANY_STREET` | `PMB 56117, 915 E Cordova St` |
| `COMPANY_CITY` | `Vancouver` |
| `COMPANY_PROVINCE` | `BC` |
| `COMPANY_POSTAL` | `V6A 4B8` |
| `BUSINESS_NUMBER` | CRA business number (optional) |
| `PST_NUMBER` | BC PST number (optional) |
| `COMPANY_PHONE` | `604.635.3867` |
| `APPRAISER_NAME` | your name |
| `APPRAISER_LICENSE` | your dealer registration / appraiser number |

Click **Save**, then **Run NPM Install**, then **Restart**.

## 4. Turn on HTTPS
cPanel → **SSL/TLS Status** → tick `pstappraisal.ca` and `www.pstappraisal.ca` → **Run AutoSSL**.

## 5. Connect Stripe
Stripe Dashboard → **Developers → Webhooks → Add endpoint**
- Endpoint URL: `https://pstappraisal.ca/webhook/stripe`
- Event: `checkout.session.completed`

Copy the **Signing secret** into `STRIPE_WEBHOOK_SECRET` (step 3) and **Restart** the app.

## 6. Add your signature
cPanel → **File Manager** → `pstappraisal/templates/` → upload your signature as `signature.png` (a transparent PNG works best),
then add the variable `SIGNATURE_IMAGE` = `templates/signature.png` and **Restart**. It's stamped on the FIN 320 and the certificate.
The FIN 320 and FIN 355/MV forms are already included in `templates/`.

## 7. Test it
- Visit https://pstappraisal.ca, place an order with a Stripe test card first if you like (use test keys), check it appears at https://pstappraisal.ca/admin, approve it, and confirm the email arrives.

## Updating the site later
When new changes are pushed to GitHub:
1. cPanel → **Git™ Version Control** → **Manage** → **Pull or Deploy** → **Update from Remote**
2. cPanel → **Setup Node.js App** → **Restart**

## Backups
Orders are saved in `pstappraisal/data/` and customer photos in `pstappraisal/uploads/`. Include both in your CanSpace backups.
