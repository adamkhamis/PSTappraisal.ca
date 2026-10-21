// Tells you about each new paid order: an email to NOTIFY_EMAIL and a text to NOTIFY_SMS_TO via voip.ms.
const { sendMail } = require('./mailer');

const BASE_URL = () => (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
const money = (n) => '$' + Number(n || 0).toLocaleString('en-CA');

async function sendSms(text, mustSend = false) {
  const { VOIPMS_API_USERNAME: user, VOIPMS_API_PASSWORD: pass, VOIPMS_DID: did, NOTIFY_SMS_TO: to } = process.env;
  if (!user || !pass || !did || !to) {
    if (mustSend) throw new Error('Fill in the voip.ms login email, API password and both phone numbers first.');
    return console.log('[sms] voip.ms not configured, skipped:', text);
  }
  const url = new URL('https://voip.ms/api/v1/rest.php');
  // voip.ms numbers are 10 digits with no punctuation; SMS is limited to 160 characters.
  const params = { api_username: user, api_password: pass, method: 'sendSMS', did: did.replace(/\D/g, '').slice(-10), dst: to.replace(/\D/g, '').slice(-10), message: text.slice(0, 160) };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (body.status !== 'success') throw new Error(`voip.ms: ${body.status || res.status}`);
}

async function notifyNewOrder(sub) {
  const d = sub.data;
  const vehicle = [d.year, d.make, d.model].filter(Boolean).join(' ');
  const link = `${BASE_URL()}/admin/sub/${sub.id}`;
  const when = d.registered === 'yes' ? `Already registered ${d.registered_date} (FIN 355/MV)` : 'Not registered yet';
  const jobs = [];

  if (process.env.NOTIFY_EMAIL) {
    jobs.push(sendMail({
      to: process.env.NOTIFY_EMAIL,
      subject: `New appraisal order ${sub.ref}: ${vehicle}, paid ${money(d.purchase_price)}`,
      text: `New paid order ${sub.ref}\n\n${sub.name} · ${sub.email} · ${d.phone}\n${vehicle} · ${Number(d.odometer).toLocaleString()} ${d.odometer_unit || 'km'} · ${d.condition}\n` +
        `Price paid: ${money(d.purchase_price)}   Black Book: ${d.black_book ? money(d.black_book) : 'not given'}\n${when}\n\nReview and confirm the appraisal:\n${link}\n`,
      html: `<p><b>New paid order ${sub.ref}</b></p>
        <p>${esc(sub.name)} · ${esc(sub.email)} · ${esc(d.phone)}<br>${esc(vehicle)} · ${Number(d.odometer).toLocaleString()} ${esc(d.odometer_unit || 'km')} · ${esc(d.condition)}<br>
        Price paid: <b>${money(d.purchase_price)}</b> · Black Book: <b>${d.black_book ? money(d.black_book) : 'not given'}</b><br>${esc(when)}</p>
        <p><a href="${link}" style="display:inline-block;background:#1456a8;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Review &amp; confirm appraisal</a></p>
        <p style="color:#666;font-size:13px">${link}</p>`,
    }, `notify-${sub.ref}`).catch((e) => console.error('[notify] email failed:', e.message)));
  }

  jobs.push(sendSms(`New appraisal ${sub.ref}: ${vehicle}, paid ${money(d.purchase_price)}. Confirm: ${link}`)
    .catch((e) => console.error('[notify] SMS failed:', e.message)));

  await Promise.all(jobs);
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = { notifyNewOrder, sendSms };
