// Business settings edited in the admin portal (Admin → Settings), saved in data/settings.json.
// Only BASE_URL, ADMIN_USER and ADMIN_PASSWORD have to be set on the server; everything here can also
// come from environment variables, but a value saved in the portal wins.
const fs = require('fs');
const path = require('path');

const FILE = process.env.SETTINGS_PATH || path.join(__dirname, '..', 'data', 'settings.json');

const GROUPS = [
  { title: 'Your details on the FIN 320', note: 'Printed in Part 1 and Part 5 of the FIN 320 and on the appraisal certificate.', fields: [
    { key: 'COMPANY_NAME', label: 'Motor vehicle dealer or appraiser name', default: 'PST Appraisal BC' },
    { key: 'APPRAISER_NAME', label: 'Contact name of appraiser (your name)' },
    { key: 'APPRAISER_LICENSE', label: 'Motor dealer number', help: 'Leave blank if you don\'t have one.' },
    { key: 'BUSINESS_NUMBER', label: 'Business number (CRA)', help: 'Optional.' },
    { key: 'PST_NUMBER', label: 'PST number', help: 'Optional.' },
    { key: 'COMPANY_STREET', label: 'Mailing address', default: 'PMB 56117, 915 E Cordova St' },
    { key: 'COMPANY_CITY', label: 'City', default: 'Vancouver' },
    { key: 'COMPANY_PROVINCE', label: 'Province', default: 'BC' },
    { key: 'COMPANY_POSTAL', label: 'Postal code', default: 'V6A 4B8' },
    { key: 'COMPANY_PHONE', label: 'Contact telephone number', default: '604.635.3867' },
  ] },
  { title: 'Price', fields: [
    { key: 'PRICE_CENTS', label: 'Price before tax ($)', type: 'money', default: '7000' },
    { key: 'TAX_PERCENT', label: 'GST (%)', type: 'number', default: '5', help: 'Set to 0 if you\'re not registered for GST.' },
    { key: 'TAX_NUMBER', label: 'GST number (shown on the receipt)', help: 'Optional.' },
    { key: 'PST_TAX_PERCENT', label: 'PST (%)', type: 'number', default: '7', help: 'BC PST is 7%. Set to 0 to stop charging it. The PST number is entered under your FIN 320 details.' },
    { key: 'TAX_NAME', label: 'Name for the first tax', default: 'GST' },
  ] },
  { title: 'Stripe payments', note: 'Leave the secret key empty to run in test mode: orders skip payment.', fields: [
    { key: 'STRIPE_SECRET_KEY', label: 'Secret key', type: 'secret', help: 'Stripe → Developers → API keys. Starts with sk_live_ (or sk_test_ for testing).' },
    { key: 'STRIPE_WEBHOOK_SECRET', label: 'Webhook signing secret', type: 'secret', help: 'From the webhook for <code>{BASE_URL}/webhook/stripe</code> (event checkout.session.completed). Starts with whsec_.' },
  ] },
  { title: 'Email', note: 'Used to send appraisals to clients and alerts to you. Leave the server empty to save emails on the server instead of sending.', fields: [
    { key: 'SMTP_HOST', label: 'Outgoing mail server', placeholder: 'mail.pstappraisal.ca' },
    { key: 'SMTP_PORT', label: 'Port', type: 'number', default: '465' },
    { key: 'SMTP_USER', label: 'Username', type: 'email', placeholder: 'support@pstappraisal.ca' },
    { key: 'SMTP_PASS', label: 'Password', type: 'secret' },
    { key: 'MAIL_FROM', label: 'Send emails as', default: 'PST Appraisal BC <support@pstappraisal.ca>' },
    { key: 'MAIL_BCC', label: 'Send yourself a copy of every appraisal at', type: 'email', default: 'support@pstappraisal.ca' },
  ] },
  { title: 'New order alerts', fields: [
    { key: 'NOTIFY_EMAIL', label: 'Email new orders to', type: 'email', default: 'adam@khamis.ca' },
    { key: 'NOTIFY_SMS_TO', label: 'Text new orders to', default: '6044185518' },
    { key: 'VOIPMS_DID', label: 'Send texts from (voip.ms number)', default: '6046353867' },
    { key: 'VOIPMS_API_USERNAME', label: 'voip.ms login email', type: 'email' },
    { key: 'VOIPMS_API_PASSWORD', label: 'voip.ms API password', type: 'secret', help: 'voip.ms → Main Menu → SOAP and REST/JSON API. Enable the API and allow this server\'s IP address there.' },
  ] },
];
const FIELDS = GROUPS.flatMap((g) => g.fields);
const KEYS = new Set([...FIELDS.map((f) => f.key), 'SIGNATURE_IMAGE']);

let saved = {};

function load() {
  try { saved = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { saved = {}; }
  apply();
}

// Saved values override environment variables; defaults fill anything still empty.
function apply() {
  for (const f of FIELDS) if (!process.env[f.key] && f.default) process.env[f.key] = f.default;
  for (const [k, v] of Object.entries(saved)) if (KEYS.has(k)) process.env[k] = v;
}

function save(changes) {
  for (const [k, v] of Object.entries(changes)) {
    if (!KEYS.has(k)) continue;
    if (v === null) { delete saved[k]; delete process.env[k]; } else saved[k] = String(v).trim();
  }
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE + '.tmp', JSON.stringify(saved, null, 1));
  fs.renameSync(FILE + '.tmp', FILE);
  apply();
}

module.exports = { GROUPS, FIELDS, load, save, dir: path.dirname(FILE) };
