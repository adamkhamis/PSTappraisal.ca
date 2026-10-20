require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const db = require('./db');
const { buildCertificate, buildOfficialForm, money, UPLOADS } = require('./pdf');
const { sendAppraisal, esc } = require('./mailer');

const PORT = process.env.PORT || 3000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const PRICE_CENTS = Number(process.env.PRICE_CENTS || 9900);
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
if (!stripe) console.warn('[stripe] STRIPE_SECRET_KEY not set — TEST MODE: submissions are marked paid without charging.');

const app = express();

// ---------- Stripe webhook (needs raw body, so it goes before express.json) ----------
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  if (!stripe) return res.sendStatus(400);
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).send(`Webhook error: ${e.message}`);
  }
  if (event.type === 'checkout.session.completed' && event.data.object.payment_status === 'paid') {
    db.markPaid(event.data.object.client_reference_id);
  }
  res.json({ received: true });
});

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/config', (req, res) => res.json({ price: money(PRICE_CENTS / 100).replace('.00', '') }));

// ---------- Customer submission ----------
fs.mkdirSync(UPLOADS, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

const REQUIRED = ['name', 'email', 'phone', 'address', 'city', 'postal', 'vin', 'year', 'make', 'model', 'odometer', 'purchase_price', 'sale_date', 'condition'];

app.post('/api/submit', upload.array('photos', 20), async (req, res) => {
  const b = req.body;
  const missing = REQUIRED.filter((k) => !String(b[k] || '').trim());
  if (missing.length) return res.status(400).json({ error: 'Please fill in: ' + missing.join(', ') });
  if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(b.vin.trim())) return res.status(400).json({ error: 'VIN must be 17 characters (no I, O or Q).' });
  if ((req.files || []).length < 4) return res.status(400).json({ error: 'Please upload at least 4 photos.' });
  if (!b.agree) return res.status(400).json({ error: 'Please confirm the declaration.' });

  const { name, email, agree, ...data } = b;
  data.province = 'BC';
  data.issues = [].concat(b.issues || []);
  const sub = db.create({ name: name.trim(), email: email.trim(), data, photos: req.files.map((f) => f.filename) });

  if (!stripe) {
    db.markPaid(sub.ref);
    return res.json({ url: `/success.html?ref=${sub.ref}` });
  }
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
          unit_amount: PRICE_CENTS,
          product_data: { name: 'PST Vehicle Appraisal', description: `${data.year} ${data.make} ${data.model} – VIN ${data.vin}` },
        },
      }],
      automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === 'true' },
      success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/pay/${sub.ref}?cancelled=1`,
    });
    db.setStripeSession(sub.id, session.id);
    res.json({ url: session.url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not start payment. Please try again.' });
  }
});

// Resume payment if they cancelled out of Stripe
app.get('/pay/:ref', async (req, res) => {
  const sub = db.byRef(req.params.ref);
  if (!sub || !stripe) return res.redirect('/');
  if (sub.status !== 'awaiting_payment') return res.redirect(`/success.html?ref=${sub.ref}`);
  const session = await stripe.checkout.sessions.retrieve(sub.stripe_session_id);
  if (session.status === 'open') return res.redirect(session.url);
  res.redirect('/?expired=1');
});

// Confirms payment on return from Stripe too (so it works even before the webhook is set up)
app.get('/success', async (req, res) => {
  if (!stripe || !req.query.session_id) return res.redirect('/');
  try {
    const session = await stripe.checkout.sessions.retrieve(String(req.query.session_id));
    if (session.payment_status === 'paid') db.markPaid(session.client_reference_id);
    res.redirect(`/success.html?ref=${encodeURIComponent(session.client_reference_id)}`);
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
app.use('/admin', adminAuth);
app.use('/admin/photos', express.static(UPLOADS));

const vehicle = (d) => [d.year, d.make, d.model, d.trim].filter(Boolean).join(' ');
const STATUS_LABEL = { paid: 'Ready to review', completed: 'Sent', awaiting_payment: 'Awaiting payment' };

function layout(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)}</title><link rel="stylesheet" href="/style.css"></head>
  <body class="admin"><header class="admin-bar"><a href="/admin"><b>${esc(process.env.COMPANY_NAME || 'PST Appraisals')}</b> · Admin</a></header>
  <main class="wrap">${body}</main></body></html>`;
}

function approveForm(sub, compact) {
  const d = sub.data;
  const value = sub.appraised_value ?? d.purchase_price;
  return `<form method="post" action="/admin/sub/${sub.id}/approve" class="${compact ? 'inline-approve' : 'approve'}"
     onsubmit="return confirmSend(this, ${Number(d.purchase_price) || 0})">
    <label>Appraised value ($)<input name="value" type="number" step="0.01" min="0" required value="${esc(value)}"></label>
    ${compact ? '' : `<label>Appraiser notes (printed on certificate)<textarea name="notes" rows="3">${esc(sub.appraiser_notes || '')}</textarea></label>`}
    <div class="btns">
      ${compact ? '' : `<button formaction="/admin/sub/${sub.id}/preview" formtarget="_blank" formnovalidate class="secondary" type="submit">Preview PDF</button>`}
      <button type="submit">${sub.status === 'completed' ? 'Re-send' : 'Approve & email'}</button>
    </div>
  </form>`;
}

const confirmScript = `<script>
function confirmSend(f, price) {
  var v = parseFloat(f.value.value);
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
      <td><a href="/admin/sub/${s.id}">${esc(vehicle(s.data))}</a><br><small>${esc(s.data.condition)} · ${s.photos.length} photos</small></td>
      <td>${esc(Number(s.data.odometer).toLocaleString())} ${esc(s.data.odometer_unit || 'km')}</td>
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
          ${row('VIN', d.vin?.toUpperCase())}${row('Odometer', `${Number(d.odometer).toLocaleString()} ${d.odometer_unit || 'km'}`)}
          ${row('Colour', d.colour)}${row('Plate', d.plate)}${row('Condition', d.condition)}
          ${row('Reported issues', d.issues.join(', '))}</dl>
        <p class="desc">${esc(d.description)}</p>
        <h2>Sale</h2><dl>
          ${row('Purchase price', money(d.purchase_price))}${row('Black Book value quoted', d.black_book ? money(d.black_book) : '')}
          ${row('Date of sale', d.sale_date)}${row('Seller', d.seller_name)}</dl>
        <h2>Client</h2><dl>
          ${row('Name', s.name)}${row('Email', s.email)}${row('Phone', d.phone)}
          ${row('Address', [d.address, d.city, 'BC', d.postal].filter(Boolean).join(', '))}</dl>
      </section>
      <section>
        <h2>Appraisal</h2>
        ${s.status === 'awaiting_payment' ? '<p class="warn">Not paid yet.</p>' : approveForm(s, false)}
      </section>
    </div>
    <h2>Photos (${s.photos.length})</h2>
    <div class="photos">${s.photos.map((p) => `<a href="/admin/photos/${esc(p)}" target="_blank"><img src="/admin/photos/${esc(p)}" loading="lazy"></a>`).join('')}</div>
    ${confirmScript}`));
});

async function buildAttachments(sub, value, notes) {
  const files = [{ filename: `Appraisal-${sub.ref}.pdf`, content: await buildCertificate(sub, value, notes) }];
  const official = await buildOfficialForm(sub, value, notes);
  if (official) files.unshift({ filename: `FIN320-Motor-Vehicle-Appraisal-${sub.ref}.pdf`, content: official });
  return files;
}

app.post('/admin/sub/:id/preview', async (req, res) => {
  const s = db.byId(req.params.id);
  if (!s) return res.sendStatus(404);
  const value = Number(req.body.value) || 0;
  const [first] = await buildAttachments(s, value, req.body.notes);
  res.type('pdf').set('Content-Disposition', `inline; filename="${first.filename}"`).send(first.content);
});

app.post('/admin/sub/:id/approve', async (req, res) => {
  const s = db.byId(req.params.id);
  if (!s || s.status === 'awaiting_payment') return res.status(400).send('Submission not found or not paid.');
  const value = Number(req.body.value);
  if (!(value > 0)) return res.status(400).send('Enter a valid appraised value.');
  const notes = req.body.notes ?? s.appraiser_notes ?? '';
  try {
    await sendAppraisal(s, money(value), await buildAttachments(s, value, notes));
  } catch (e) {
    console.error(e);
    return res.status(500).send(layout('Error', `<p class="warn">Email failed: ${esc(e.message)}</p><p><a href="/admin/sub/${s.id}">Back</a></p>`));
  }
  db.markCompleted(s.id, value, notes);
  res.redirect(`/admin?sent=${s.ref}`);
});

app.listen(PORT, () => console.log(`Running at ${BASE_URL}  (admin: ${BASE_URL}/admin)`));
