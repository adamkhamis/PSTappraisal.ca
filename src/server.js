require('dotenv').config();
const settings = require('./settings');
settings.load(); // business settings saved in Admin → Settings
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const db = require('./db');
const { buildCertificate, buildFin320, buildFin355, refundEstimate, FIN_CONDITION, money, UPLOADS } = require('./pdf');
const { sendAppraisal, sendContact, esc } = require('./mailer');
const { renderPage, PAGES, sitemapXml, robotsTxt } = require('./pages');
const UPLOAD_GROUPS = require('./uploads');
const { toNumber } = require('./num');
const { pricing, priceVars } = require('./pricing');
const { notifyNewOrder } = require('./notify');

// Marks an order paid and, the first time only, emails and texts you about it.
function paid(ref) {
  const sub = db.markPaid(ref);
  if (sub) notifyNewOrder(sub).catch((e) => console.error('[notify]', e.message));
}

const PORT = process.env.PORT || 3000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
// Stripe client for the current secret key; null = test mode (orders skip payment).
let stripeCache = { key: null, client: null };
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY || '';
  if (stripeCache.key !== key) stripeCache = { key, client: key ? require('stripe')(key) : null };
  return stripeCache.client;
}
if (!getStripe()) console.warn('[stripe] No Stripe secret key — TEST MODE: submissions are marked paid without charging.');

const app = express();

// ---------- Stripe webhook (needs raw body, so it goes before express.json) ----------
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.sendStatus(400);
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).send(`Webhook error: ${e.message}`);
  }
  if (event.type === 'checkout.session.completed' && event.data.object.payment_status === 'paid') {
    paid(event.data.object.client_reference_id);
  }
  res.json({ received: true });
});

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- Public pages (site/pages/*.html, e.g. /faq, /how-it-works) ----------
app.get(['/', ...PAGES.filter((p) => p !== 'index').map((p) => '/' + p)], (req, res) => {
  res.send(renderPage(req.path === '/' ? 'index' : req.path.slice(1), priceVars()));
});

app.get('/sitemap.xml', (req, res) => res.type('application/xml').send(sitemapXml()));
app.get('/robots.txt', (req, res) => res.type('text/plain').send(robotsTxt()));

app.post('/api/contact', express.json(), async (req, res) => {
  const { name, email, ref, message } = req.body || {};
  if (!name || !/^\S+@\S+\.\S+$/.test(email || '') || !message) return res.status(400).json({ error: 'Please enter your name, a valid email and a message.' });
  try {
    await sendContact({ name: String(name).slice(0, 200), email: String(email).slice(0, 200), ref: String(ref || '').slice(0, 40), message: String(message).slice(0, 5000) });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Couldn't send your message. Please email Support@PSTAppraisal.ca instead." });
  }
});

// ---------- Customer submission ----------
fs.mkdirSync(UPLOADS, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 60 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype) || file.mimetype === 'application/pdf'),
});

const REQUIRED = ['name', 'email', 'phone', 'address', 'city', 'postal', 'vin', 'year', 'make', 'model', 'odometer', 'purchase_price', 'sale_date', 'condition'];

app.post('/api/submit', upload.fields(UPLOAD_GROUPS.map((g) => ({ name: g.key, maxCount: g.max }))), async (req, res) => {
  const b = req.body;
  const missing = REQUIRED.filter((k) => !String(b[k] || '').trim());
  if (missing.length) return res.status(400).json({ error: 'Please fill in: ' + missing.join(', ') });
  if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(b.vin.trim())) return res.status(400).json({ error: 'VIN must be 17 characters (no I, O or Q).' });
  const files = req.files || {};
  const missingUploads = UPLOAD_GROUPS.filter((g) => g.required && !(files[g.key] || []).length).map((g) => g.label);
  if (missingUploads.length) return res.status(400).json({ error: 'Please add: ' + missingUploads.join('; ') + '.' });
  const vehiclePhotos = (files.vehicle || []).length;
  if (vehiclePhotos < 4) return res.status(400).json({ error: 'Please add at least 4 vehicle photos: front, back, a side and the odometer.' });
  if (!b.agree) return res.status(400).json({ error: 'Please confirm the declaration.' });
  if (b.registered === 'yes' && !b.registered_date) return res.status(400).json({ error: 'Please enter the date you registered the vehicle.' });

  const { name, email, agree, ...data } = b;
  data.province = 'BC';
  // Store numbers plainly, whatever way they were typed ("150,000 km" → 150000, "$8,200.00" → 8200).
  for (const [k, label] of [['odometer', 'odometer reading'], ['purchase_price', 'purchase price'], ['black_book', 'Black Book value'], ['pst_paid', 'PST paid']]) {
    if (data[k] === undefined || String(data[k]).trim() === '') { delete data[k]; continue; }
    const n = toNumber(data[k]);
    if (!(n >= 0)) return res.status(400).json({ error: `Please enter the ${label} as a number.` });
    data[k] = String(n);
  }
  if (data.registered !== 'yes') { delete data.registered_date; delete data.pst_paid; } // only for already-registered vehicles
  data.issues = [].concat(b.issues || []);
  const sub = db.create({ name: name.trim(), email: email.trim(), data, photos: UPLOAD_GROUPS.flatMap((g) => (files[g.key] || []).map((f) => ({ file: f.filename, group: g.key, name: f.originalname, pdf: f.mimetype === 'application/pdf' }))) });

  const stripe = getStripe();
  if (!stripe) {
    paid(sub.ref);
    return res.json({ url: `/thank-you?ref=${sub.ref}` });
  }
  const p = pricing();
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: sub.email,
      client_reference_id: sub.ref,
      metadata: { ref: sub.ref },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'cad',
          unit_amount: p.cents,
          product_data: { name: 'FIN 320 PST Vehicle Appraisal', description: `${data.year} ${data.make} ${data.model} – VIN ${data.vin}` },
        },
      }].concat(p.taxes.map((t) => ({
        quantity: 1,
        price_data: { currency: 'cad', unit_amount: t.cents, product_data: { name: `${t.name} (${t.pct}%)`, description: t.number ? `${t.name} #${t.number}` : undefined } },
      }))),
      success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/start?cancelled=1`,
    });
    db.setStripeSession(sub.id, session.id);
    res.json({ url: session.url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not start payment. Please try again.' });
  }
});

app.get('/before-or-after', (req, res) => res.redirect(301, '/ways-to-use-it'));

// Resume payment if they cancelled out of Stripe
app.get('/pay/:ref', async (req, res) => {
  const sub = db.byRef(req.params.ref);
  const stripe = getStripe();
  if (!sub || !stripe) return res.redirect('/');
  if (sub.status !== 'awaiting_payment') return res.redirect(`/thank-you?ref=${sub.ref}`);
  const session = await stripe.checkout.sessions.retrieve(sub.stripe_session_id);
  if (session.status === 'open') return res.redirect(session.url);
  res.redirect('/start');
});

// Confirms payment on return from Stripe too (so it works even before the webhook is set up)
app.get('/success', async (req, res) => {
  const stripe = getStripe();
  if (!stripe || !req.query.session_id) return res.redirect('/');
  try {
    const session = await stripe.checkout.sessions.retrieve(String(req.query.session_id));
    if (session.payment_status === 'paid') paid(session.client_reference_id);
    res.redirect(`/thank-you?ref=${encodeURIComponent(session.client_reference_id)}`);
  } catch {
    res.redirect('/');
  }
});

// ---------- Admin ----------
function adminAuth(req, res, next) {
  const [user, pass] = Buffer.from((req.headers.authorization || '').split(' ')[1] || '', 'base64').toString().split(':');
  const ok = (a, b) => a && b && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  if (process.env.ADMIN_PASSWORD && ok(user, process.env.ADMIN_USER || 'admin') && ok(pass, process.env.ADMIN_PASSWORD)) return next();
  res.set('WWW-Authenticate', 'Basic realm="Admin"').status(401).send('Login required (set ADMIN_PASSWORD in .env)');
}
app.use('/admin', (req, res, next) => { res.set('X-Robots-Tag', 'noindex, nofollow'); next(); }, adminAuth);
app.use('/admin/photos', express.static(UPLOADS));

const vehicle = (d) => [d.year, d.make, d.model, d.trim].filter(Boolean).join(' ');
// Groups an order's uploads by box; orders from before the boxes existed have plain filenames.
function uploadGroups(photos) {
  const list = photos.map((p) => (typeof p === 'string' ? { file: p, group: 'vehicle', name: p, pdf: /\.pdf$/i.test(p) } : p))
    .map((p) => (p.group === 'vin' ? { ...p, group: 'vinphoto' } : p)); // renamed box
  return UPLOAD_GROUPS.map((g) => ({ label: g.label, items: list.filter((p) => p.group === g.key) })).filter((g) => g.items.length);
}
const regLabel = (d) => d.registered === 'yes'
  ? `<span class="badge after">After registering · ${esc(d.registered_date)}</span>`
  : '<span class="badge before">Before registering</span>';
const STATUS_LABEL = { paid: 'Ready to review', completed: 'Sent', awaiting_payment: 'Awaiting payment' };

function layout(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)}</title><link rel="stylesheet" href="/style.css"></head>
  <body class="admin"><header class="admin-bar"><a href="/admin"><b>${esc(process.env.COMPANY_NAME || 'PST Appraisal BC')}</b> · Admin</a><nav><a href="/admin">Orders</a><a href="/admin/settings">Settings</a></nav></header>
  <main class="wrap">${body}</main></body></html>`;
}

function approveForm(sub, compact) {
  const d = sub.data;
  const value = sub.appraised_value ?? d.purchase_price;
  return `<form method="post" action="/admin/sub/${sub.id}/approve" class="${compact ? 'inline-approve' : 'approve'}"
     onsubmit="return confirmSend(this, ${toNumber(d.purchase_price) || 0})">
    <label>Appraised value ($)<input name="value" type="text" inputmode="decimal" required value="${esc(value)}"></label>
    ${compact ? '' : `<label>Condition on FIN 320<select name="condition">${['Good', 'Fair', 'Poor'].map((c) => `<option ${c === (sub.fin_condition || FIN_CONDITION[d.condition]) ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <label>Appraiser comments (printed on the FIN 320 and certificate)<textarea name="notes" rows="3">${esc(sub.appraiser_notes || '')}</textarea></label>`}
    <div class="btns">
      ${compact ? '' : `<button formaction="/admin/sub/${sub.id}/preview" formtarget="_blank" formnovalidate class="secondary" type="submit">Preview PDF</button>`}
      <button type="submit">${sub.status === 'completed' ? 'Re-send' : 'Approve & email'}</button>
    </div>
  </form>`;
}

const confirmScript = `<script>
function confirmSend(f, price) {
  var v = parseFloat(String(f.value.value).replace(/[^\d.]/g, ''));
  if (price && v < price && !confirm('Appraised value is BELOW the declared purchase price. PST is charged on the greater of the two, so this will not lower the client\\'s tax. Send anyway?')) return false;
  return confirm('Generate the appraisal at $' + v.toLocaleString() + ' and email it to the client?');
}</script>`;

app.get('/admin', (req, res) => {
  const status = STATUS_LABEL[req.query.status] ? req.query.status : 'paid';
  const counts = db.counts();
  const rows = db.list(status);
  const tabs = Object.entries(STATUS_LABEL).map(([k, l]) =>
    `<a class="tab ${k === status ? 'on' : ''}" href="/admin?status=${k}">${l} <span>${counts[k]}</span></a>`).join('');
  const flash = req.query.sent ? `<p class="flash">Appraisal ${esc(req.query.sent)} emailed to the client.</p>` : '';
  const table = rows.length ? `<table><thead><tr><th>Ref</th><th>Submitted</th><th>Client</th><th>Vehicle</th><th>Odometer</th><th>Paid price</th><th>${status === 'completed' ? 'Appraised' : 'Approve'}</th></tr></thead><tbody>
    ${rows.map((s) => `<tr>
      <td><a href="/admin/sub/${s.id}">${esc(s.ref)}</a></td>
      <td>${esc(s.created_at.slice(0, 16))}</td>
      <td>${esc(s.name)}<br><small>${esc(s.email)}</small></td>
      <td><a href="/admin/sub/${s.id}">${esc(vehicle(s.data))}</a><br><small>${esc(s.data.condition)} · ${s.photos.length} files</small><br>${regLabel(s.data)}</td>
      <td>${esc(toNumber(s.data.odometer).toLocaleString())} ${esc(s.data.odometer_unit || 'km')}</td>
      <td>${money(s.data.purchase_price)}</td>
      <td>${status === 'paid' ? approveForm(s, true) : status === 'completed' ? money(s.appraised_value) : '—'}</td>
    </tr>`).join('')}</tbody></table>` : '<p class="empty">Nothing here.</p>';
  res.send(layout('Admin', `${flash}<nav class="tabs">${tabs}</nav>${table}${confirmScript}`));
});

app.get('/admin/sub/:id', (req, res) => {
  const s = db.byId(req.params.id);
  if (!s) return res.sendStatus(404);
  const d = s.data;
  const row = (l, v) => `<div><dt>${l}</dt><dd>${esc(v) || '—'}</dd></div>`;
  res.send(layout(s.ref, `
    <p><a href="/admin?status=${s.status}">← Back</a></p>
    <h1>${esc(vehicle(d))} <span class="badge ${s.status}">${STATUS_LABEL[s.status]}</span></h1>
    <p class="muted">${esc(s.ref)} · submitted ${esc(s.created_at)}${s.paid_at ? ' · paid ' + esc(s.paid_at) : ''}${s.completed_at ? ' · sent ' + esc(s.completed_at) : ''}</p>
    <div class="detail">
      <section>
        <h2>Vehicle</h2><dl>
          ${row('VIN', d.vin?.toUpperCase())}${row('Odometer', `${toNumber(d.odometer).toLocaleString()} ${d.odometer_unit || 'km'}`)}
          ${row('Colour', d.colour)}${row('Plate', d.plate)}${row('Condition', d.condition)}
          ${row('Reported issues', d.issues.join(', '))}</dl>
        <p class="desc">${esc(d.description)}</p>
        <h2>Sale</h2><p>${regLabel(d)}</p><dl>
          ${row('Purchase price', money(d.purchase_price))}${row('Black Book value quoted', d.black_book ? money(d.black_book) : '')}
          ${row('Date of sale', d.sale_date)}${d.registered === 'yes' ? row('PST paid', d.pst_paid ? money(d.pst_paid) : '') : ''}</dl>
        <h2>Client</h2><dl>
          ${row('Name', s.name)}${row('Email', s.email)}${row('Phone', d.phone)}
          ${row('Address', [d.address, d.city, 'BC', d.postal].filter(Boolean).join(', '))}</dl>
      </section>
      <section>
        <h2>Appraisal</h2>
        ${s.status === 'awaiting_payment' ? '<p class="warn">Not paid yet.</p>' : approveForm(s, false)}
        ${d.registered === 'yes' ? `<p class="muted">Already registered: the FIN 355/MV refund application ${fs.existsSync(path.join(__dirname, '..', 'templates', 'fin-355mv.pdf')) ? `will be filled in and attached (estimated refund ${money(refundEstimate(s, s.appraised_value ?? d.purchase_price))}).` : '<b class="warn">won\'t be attached. Upload it to templates/fin-355mv.pdf.</b>'}</p>` : ''}
      </section>
    </div>
    <h2>Photos and documents (${s.photos.length})</h2>
    ${uploadGroups(s.photos).map(({ label, items }) => `<h3 class="up-h">${esc(label)} <small>(${items.length})</small></h3>
    <div class="photos">${items.map((p) => p.pdf
      ? `<a class="pdf-tile" href="/admin/photos/${esc(p.file)}" target="_blank"><b>PDF</b><span>${esc(p.name)}</span></a>`
      : `<a href="/admin/photos/${esc(p.file)}" target="_blank"><img src="/admin/photos/${esc(p.file)}" alt="${esc(p.name)}" loading="lazy"></a>`).join('')}</div>`).join('')}
    ${confirmScript}`));
});

async function buildAttachments(sub, value, notes, condition) {
  const files = [];
  const fin320 = await buildFin320(sub, value, notes, condition);
  if (fin320) files.push({ filename: `FIN320-Motor-Vehicle-Appraisal-${sub.ref}.pdf`, content: fin320 });
  else console.warn('[forms] templates/official-form.pdf (FIN 320) is missing');
  files.push({ filename: `Appraisal-Certificate-${sub.ref}.pdf`, content: await buildCertificate(sub, value, notes) });
  if (sub.data.registered === 'yes') {
    const fin355 = await buildFin355(sub, value);
    if (fin355) files.push({ filename: `FIN355MV-PST-Refund-Application-${sub.ref}.pdf`, content: fin355 });
    else console.warn(`[forms] ${sub.ref} already registered, but templates/fin-355mv.pdf is missing`);
  }
  return files;
}

app.post('/admin/sub/:id/preview', async (req, res) => {
  const s = db.byId(req.params.id);
  if (!s) return res.sendStatus(404);
  const value = toNumber(req.body.value) || 0;
  const [first] = await buildAttachments(s, value, req.body.notes, req.body.condition);
  res.type('pdf').set('Content-Disposition', `inline; filename="${first.filename}"`).send(first.content);
});

app.post('/admin/sub/:id/approve', async (req, res) => {
  const s = db.byId(req.params.id);
  if (!s || s.status === 'awaiting_payment') return res.status(400).send('Submission not found or not paid.');
  const value = toNumber(req.body.value);
  if (!(value > 0)) return res.status(400).send('Enter a valid appraised value.');
  const notes = req.body.notes ?? s.appraiser_notes ?? '';
  try {
    await sendAppraisal(s, money(value), await buildAttachments(s, value, notes, req.body.condition), s.data.registered === 'yes' ? refundEstimate(s, value) : 0);
  } catch (e) {
    console.error(e);
    return res.status(500).send(layout('Error', `<p class="warn">Email failed: ${esc(e.message)}</p><p><a href="/admin/sub/${s.id}">Back</a></p>`));
  }
  db.markCompleted(s.id, value, notes, req.body.condition);
  res.redirect(`/admin?sent=${s.ref}`);
});

// ---------- Admin → Settings ----------
const { sendMail } = require('./mailer');
const { sendSms } = require('./notify');
const signatureUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { fs.mkdirSync(settings.dir, { recursive: true }); cb(null, settings.dir); },
    filename: (req, file, cb) => cb(null, 'signature' + (file.mimetype === 'image/png' ? '.png' : '.jpg')),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ['image/png', 'image/jpeg'].includes(file.mimetype)),
});

function settingsPage(flash = '') {
  const e = process.env;
  const field = (f) => {
    const id = 'set-' + f.key;
    const help = f.help ? `<small>${f.help.replace('{BASE_URL}', esc(BASE_URL))}</small>` : '';
    if (f.type === 'secret') {
      const isSet = Boolean(e[f.key]);
      return `<label for="${id}"><span>${esc(f.label)} <span class="pill ${isSet ? 'on' : ''}">${isSet ? 'Saved' : 'Not set'}</span></span>
        <input id="${id}" name="${f.key}" type="password" autocomplete="new-password" placeholder="${isSet ? 'Leave blank to keep the saved one' : ''}">${help}
        ${isSet ? `<span class="clear"><input type="checkbox" name="clear_${f.key}" id="clear-${f.key}"><label for="clear-${f.key}">Remove</label></span>` : ''}</label>`;
    }
    const value = f.type === 'money' ? (Number(e[f.key] || 0) / 100).toFixed(2) : (e[f.key] || '');
    const type = f.type === 'money' || f.type === 'number' ? 'number' : f.type === 'email' ? 'text' : 'text';
    return `<label for="${id}">${esc(f.label)}<input id="${id}" name="${f.key}" type="${type}" ${f.type === 'money' ? 'step="0.01" min="0"' : ''} value="${esc(value)}" placeholder="${esc(f.placeholder || '')}">${help}</label>`;
  };
  const sig = e.SIGNATURE_IMAGE && fs.existsSync(path.resolve(e.SIGNATURE_IMAGE));
  return layout('Settings', `
    <h1>Settings</h1>
    <p class="muted">Changes take effect as soon as you save. No restart needed.</p>
    ${flash}
    <form method="post" action="/admin/settings" enctype="multipart/form-data" class="settings">
      ${settings.GROUPS.map((g) => `<section class="set-group"><h2>${esc(g.title)}</h2>${g.note ? `<p class="muted">${esc(g.note)}</p>` : ''}
        <div class="set-grid">${g.fields.map(field).join('')}</div>
        ${g.title === 'Your details on the FIN 320' ? `<div class="sig-row"><label for="sig">Signature (stamped on the FIN 320 and certificate)
          <input id="sig" name="signature" type="file" accept="image/png,image/jpeg"><small>A PNG with a transparent background looks best.</small></label>
          ${sig ? `<img src="/admin/settings/signature?${Date.now()}" alt="Saved signature" class="sig-preview">` : '<span class="pill">No signature yet</span>'}</div>` : ''}
      </section>`).join('')}
      <div class="set-actions"><button type="submit">Save settings</button></div>
    </form>
    <section class="set-group"><h2>Sample forms</h2>
      <p class="muted">See the forms filled in with your saved details and an example customer. Save your changes first. Nothing is sent.</p>
      <div class="row-btns">
        <a class="btn-link" href="/admin/settings/sample/fin-320" target="_blank">Sample FIN 320</a>
        <a class="btn-link" href="/admin/settings/sample/fin-355mv" target="_blank">Sample FIN 355/MV</a>
        <a class="btn-link" href="/admin/settings/sample/certificate" target="_blank">Sample certificate</a>
      </div>
    </section>
    <section class="set-group"><h2>Test alerts</h2>
      <p class="muted">Save first, then check your email and text alerts work.</p>
      <form method="post" action="/admin/settings/test" class="row-btns">
        <button name="what" value="email" class="secondary">Send a test email to ${esc(e.NOTIFY_EMAIL || 'the alert address')}</button>
        <button name="what" value="sms" class="secondary">Send a test text to ${esc(e.NOTIFY_SMS_TO || 'your mobile')}</button>
      </form>
    </section>
    <p class="muted">Site address, admin username and admin password are set on the server (BASE_URL, ADMIN_USER, ADMIN_PASSWORD).</p>`);
}

app.get('/admin/settings', (req, res) => {
  const msg = { saved: 'Settings saved.', email: 'Test email sent. Check your inbox.', sms: 'Test text sent.' }[req.query.ok];
  res.send(settingsPage(msg ? `<p class="flash">${msg}</p>` : req.query.err ? `<p class="warn">${esc(req.query.err)}</p>` : ''));
});

app.post('/admin/settings', signatureUpload.single('signature'), (req, res) => {
  const changes = {};
  for (const f of settings.FIELDS) {
    if (!(f.key in req.body)) continue;
    let v = String(req.body[f.key]).trim();
    if (f.type === 'secret') {
      if (req.body['clear_' + f.key]) changes[f.key] = null;
      else if (v) changes[f.key] = v; // blank = keep the saved one
      continue;
    }
    if (f.type === 'money') v = v ? String(Math.round(toNumber(v) * 100)) : '';
    changes[f.key] = v;
  }
  if (req.file) changes.SIGNATURE_IMAGE = req.file.path;
  settings.save(changes);
  res.redirect('/admin/settings?ok=saved');
});

app.get('/admin/settings/signature', (req, res) => {
  const p = process.env.SIGNATURE_IMAGE && path.resolve(process.env.SIGNATURE_IMAGE);
  if (!p || !fs.existsSync(p)) return res.sendStatus(404);
  res.sendFile(p);
});

// Sample forms filled with your saved settings and an example customer, so you can check them before a real order.
const SAMPLE_ORDER = {
  id: 0, ref: 'VA-SAMPLE', name: 'Example Customer', email: 'customer@example.com',
  data: {
    phone: '604-555-0123', address: '123 Example St', city: 'Surrey', postal: 'V3T 1A1', registered: 'yes', registered_date: new Date().toISOString().slice(0, 10),
    vin: '2HGFC2F59JH512345', year: '2018', make: 'Honda', model: 'Civic', trim: 'LX', colour: 'Black', odometer: '236400', odometer_unit: 'km',
    purchase_price: '8200', black_book: '13900', sale_date: new Date().toISOString().slice(0, 10), condition: 'Fair',
    issues: ['High kilometres', 'Warning lights on'],
  },
  photos: [],
};
app.get('/admin/settings/sample/:form', async (req, res) => {
  const notes = 'Sample comments: check-engine light on, catalytic converter quoted at $1,800.';
  const build = { 'fin-320': () => buildFin320(SAMPLE_ORDER, 8200, notes, 'Fair'), 'fin-355mv': () => buildFin355(SAMPLE_ORDER, 8200), certificate: () => buildCertificate(SAMPLE_ORDER, 8200, notes) }[req.params.form];
  if (!build) return res.sendStatus(404);
  const pdf = await build();
  if (!pdf) return res.status(404).send('That form template is missing from templates/.');
  res.type('pdf').set('Content-Disposition', `inline; filename="SAMPLE-${req.params.form}.pdf"`).send(pdf);
});

app.post('/admin/settings/test', async (req, res) => {
  try {
    if (req.body.what === 'sms') {
      await sendSms(`Test text from ${process.env.COMPANY_NAME || 'PST Appraisal BC'}. Order alerts will arrive like this.`, true);
    } else {
      if (!process.env.NOTIFY_EMAIL) throw new Error('Enter an address under "Email new orders to" first.');
      await sendMail({ to: process.env.NOTIFY_EMAIL, subject: 'Test email from your appraisal site', text: 'Your email settings work. New order alerts and appraisals will be sent from this account.' }, 'test-email');
    }
    res.redirect('/admin/settings?ok=' + (req.body.what === 'sms' ? 'sms' : 'email'));
  } catch (e) {
    res.redirect('/admin/settings?err=' + encodeURIComponent('Test failed: ' + e.message));
  }
});

app.listen(PORT, () => console.log(`Running at ${BASE_URL}  (admin: ${BASE_URL}/admin)`));
