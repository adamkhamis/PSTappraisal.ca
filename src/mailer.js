const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const OUTPUT = path.join(__dirname, '..', 'output');

const transport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

async function sendAppraisal(sub, valueText, attachments, refund = 0) {
  const company = process.env.COMPANY_NAME || 'PST Appraisal BC';
  const d = sub.data;
  const vehicle = [d.year, d.make, d.model].filter(Boolean).join(' ');
  const nextStep = d.registered === 'yes'
    ? 'Next step: you registered on ' + d.registered_date + '. We\'ve also attached the PST refund application (FIN 355/MV), filled in with your details' +
      (refund ? ` and an estimated refund of $${refund.toLocaleString('en-CA', { minimumFractionDigits: 2 })}. Check that amount against the PST shown on your Transfer/Tax form` : '') +
      '. Sign and date Part F, then mail it with copies of your Transfer/Tax form (APV9T), proof that you paid for the vehicle (for example a bank statement or cancelled cheque), this FIN 320 and your photo ID to: Ministry of Finance, Refund Section, Consumer Taxation Programs Branch, PO Box 9628 Stn Prov Govt, Victoria BC V8W 9N6. It must arrive within 30 days of the date you registered.'
    : 'Next step: bring this appraisal, the signed Transfer/Tax form (APV9T) and ID to any Autoplan broker when you register. PST is worked out on the higher of your purchase price and the appraised value.';
  const msg = {
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: sub.email,
    bcc: process.env.MAIL_BCC || undefined,
    subject: `Your vehicle appraisal ${sub.ref} – ${vehicle}`,
    text: `Hi ${sub.name},\n\nYour appraisal for the ${vehicle} (VIN ${d.vin}) is complete.\n` +
      `Appraised value: ${valueText}\n\nYour signed appraisal is attached.\n\n${nextStep}\n\n` +
      `Questions? Reply to this email, write to Support@PSTAppraisal.ca or call 604.635.3867.\n\nThank you,\n${company}\nPSTappraisal.ca\n`,
    html: `<p>Hi ${esc(sub.name)},</p><p>Your appraisal for the <b>${esc(vehicle)}</b> (VIN ${esc(d.vin)}) is complete.</p>` +
      `<p style="font-size:20px"><b>Appraised value: ${esc(valueText)}</b></p>` +
      `<p>Your signed appraisal is attached.</p><p>${esc(nextStep)}</p><p>Questions? Reply to this email, write to <a href="mailto:Support@PSTAppraisal.ca">Support@PSTAppraisal.ca</a> or call 604.635.3867.</p><p>Thank you,<br>${esc(company)}<br>PSTappraisal.ca</p>`,
    attachments,
  };

  if (!transport) {
    // No SMTP configured: save to /output so you can check what would have been sent.
    fs.mkdirSync(OUTPUT, { recursive: true });
    for (const a of attachments) fs.writeFileSync(path.join(OUTPUT, a.filename), a.content);
    fs.writeFileSync(path.join(OUTPUT, `${sub.ref}-email.txt`), `To: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text}`);
    console.log(`[mail] SMTP not configured — saved email + PDFs for ${sub.ref} to output/`);
    return;
  }
  await transport.sendMail(msg);
}

async function sendContact({ name, email, ref, message }) {
  const msg = {
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: process.env.CONTACT_TO || process.env.MAIL_BCC || process.env.SMTP_USER,
    replyTo: email,
    subject: `Website message from ${name}${ref ? ' (' + ref + ')' : ''}`,
    text: `From: ${name} <${email}>\nOrder ref: ${ref || '—'}\n\n${message}`,
  };
  if (!transport) {
    fs.mkdirSync(OUTPUT, { recursive: true });
    fs.writeFileSync(path.join(OUTPUT, `contact-${Date.now()}.txt`), `To: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text}`);
    console.log('[mail] SMTP not configured — saved contact message to output/');
    return;
  }
  await transport.sendMail(msg);
}

// Generic send, used for owner notifications. Without SMTP the message is saved to output/<saveAs>.txt.
async function sendMail(msg, saveAs) {
  const full = { from: process.env.MAIL_FROM || process.env.SMTP_USER, ...msg };
  if (!transport) {
    fs.mkdirSync(OUTPUT, { recursive: true });
    fs.writeFileSync(path.join(OUTPUT, `${saveAs || Date.now()}.txt`), `To: ${full.to}\nSubject: ${full.subject}\n\n${full.text}`);
    console.log(`[mail] SMTP not configured — saved "${full.subject}" to output/`);
    return;
  }
  await transport.sendMail(full);
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = { sendAppraisal, sendContact, sendMail, esc };
