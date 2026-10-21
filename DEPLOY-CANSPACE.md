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

Click **Create**, then scroll to **Environment variables** and add just these three (**Add Variable**):

| Name | Value |
|---|---|
| `BASE_URL` | `https://pstappraisal.ca` |
| `ADMIN_USER` | `admin` (or any username) |
| `ADMIN_PASSWORD` | a long, strong password |

Everything else (your FIN 320 details, signature, price, Stripe, email and text alerts) is entered later in the
admin portal under **Settings**.

Click **Save**, then **Run NPM Install**, then **Restart**.

## 4. Turn on HTTPS
cPanel → **SSL/TLS Status** → tick `pstappraisal.ca` and `www.pstappraisal.ca` → **Run AutoSSL**.

## 5. Connect Stripe
Stripe Dashboard → **Developers → Webhooks → Add endpoint**
- Endpoint URL: `https://pstappraisal.ca/webhook/stripe`
- Event: `checkout.session.completed`

Copy the **Signing secret** into **Admin → Settings → Stripe payments → Webhook signing secret** and click **Save settings**.

## 5b. Text alerts with voip.ms
Each new paid order sends a text from 604.635.3867 to your mobile. In the voip.ms portal:
1. **DID Numbers → Manage DIDs →** edit 604-635-3867 and turn on **SMS/MMS**.
2. **Main Menu → SOAP and REST/JSON API**: set an **API password**, click **Enable/Disable API** to enable it, and in **Enable IP Addresses** add your CanSpace server's IP address (cPanel shows it as *Shared IP Address* on the right side of the home page; or ask CanSpace support).
3. Enter your voip.ms login email and API password in **Admin → Settings → New order alerts**, save, and click **Send a test text**.

If a text fails, the reason is written to the app's log (cPanel → Setup Node.js App → your app → log file), and the email alert still goes out.

## 6. Fill in Settings
Go to `https://pstappraisal.ca/admin/settings` and fill in your FIN 320 details, upload your signature, and enter your
Stripe, email and voip.ms details. Click **Save settings**, then use **Send a test email** and **Send a test text**.
Changes apply immediately; no restart needed.

## 7. Test it
- Visit https://pstappraisal.ca, place an order with a Stripe test card first if you like (use test keys), check it appears at https://pstappraisal.ca/admin, approve it, and confirm the email arrives.

## If your cPanel has "Application Manager" instead of "Setup Node.js App"
cPanel's own Node.js support (cPanel docs: *How to Install a Node.js Application*) works too. Your host must first install
Node.js (EasyApache 4 packages `ea-nodejs` and `ea-ruby27-mod_passenger` / `ea-apache24-mod_env`) and turn on the
**Application Manager** feature for your account.
1. Copy the code with **Git™ Version Control** (step 2 above).
2. cPanel → **Software → Application Manager → Register Application**:
   Application Name `pstappraisal`, Deployment Domain `pstappraisal.ca`, Base Application URL `/`,
   Application Path `pstappraisal`, Deployment Environment `Production`.
3. Add the three environment variables from step 3 (`BASE_URL`, `ADMIN_USER`, `ADMIN_PASSWORD`) in the same form, then **Deploy**.
4. Click **Ensure dependencies** next to the app to install its packages.
The app's entry file is `app.js` in the repository root, which is what Application Manager expects.

## Updating the site later (automatic)
Every push to GitHub can redeploy the site by itself:
1. cPanel → **Security → Manage API Tokens → Create**. Name it `github-deploy`, no expiry, and copy the token.
2. GitHub → repo **Settings → Secrets and variables → Actions → New repository secret**, three times:
   - `CPANEL_HOST`: your cPanel server name, the part of your cPanel address before `:2083` (e.g. `server123.canspace.ca`)
   - `CPANEL_USER`: your cPanel username (e.g. `kingsto2`)
   - `CPANEL_TOKEN`: the token from step 1
   - optional `CPANEL_REPO_PATH` if your code isn't in `/home2/<username>/apps/pstappraisal`
3. That's it. After each push, GitHub (the **Actions** tab) tells cPanel to pull the code and run `.cpanel.yml`,
   which installs any new packages and restarts the app. You can also run it by hand: **Actions → Deploy to cPanel → Run workflow**.

cPanel still pulls the code itself, so **Update from Remote** must work first (see the Git step above).

**By hand:** cPanel → **Git™ Version Control → Manage → Pull or Deploy → Update from Remote**, then **Deploy HEAD Commit**.

## Backups
Orders are saved in `pstappraisal/data/` and customer photos in `pstappraisal/uploads/`. Include both in your CanSpace backups.
