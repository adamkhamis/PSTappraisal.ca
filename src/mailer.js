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

async function sendAppraisal(sub, valueText, attachments) {
  const company = process.env.COMPANY_NAME || 'PST Appraisal BC';
  const d = sub.data;
  const vehicle = [d.year, d.make, d.model].filter(Boolean).join(' ');
  const nextStep = d.registered === 'yes'
    ? 'Next step: you registered on ' + d.registered_date + '. Fill in the PST refund application (FIN 355/MV) from the BC government PST forms page, attach this appraisal, your registration papers and the bill of sale, and send it to the Ministry of Finance within 30 days of registering.'
    : 'Next step: bring this appraisal, your bill of sale, the signed Transfer/Tax form (APV9T) and ID to any Autoplan broker when you register. PST is worked out on the higher of your purchase price and the appraised value.';
  const msg = {
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: sub.email,
    bcc: process.env.MAIL_BCC || undefined,
    subject: `Your vehicle appraisal ${sub.ref} – ${vehicle}`,
    text: `Hi ${sub.name},\n\nYour appraisal for the ${vehicle} (VIN ${d.vin}) is complete.\n` +
      `Appraised value: ${valueText}\n\nYour signed appraisal is attached.\n\n${nextStep}\n\n` +
      `Questions? Reply to this email or write to Support@PSTAppraisal.ca.\n\nThank you,\n${company}\nPSTappraisal.ca\n`,
    html: `<p>Hi ${esc(sub.name)},</p><p>Your appraisal for the <b>${esc(vehicle)}</b> (VIN ${esc(d.vin)}) is complete.</p>` +
      `<p style="font-size:20px"><b>Appraised value: ${esc(valueText)}</b></p>` +
      `<p>Your signed appraisal is attached.</p><p>${esc(nextStep)}</p><p>Questions? Reply to this email or write to <a href="mailto:Support@PSTAppraisal.ca">Support@PSTAppraisal.ca</a>.</p><p>Thank you,<br>${esc(company)}<br>PSTappraisal.ca</p>`,
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

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = { sendAppraisal, sendContact, esc };
