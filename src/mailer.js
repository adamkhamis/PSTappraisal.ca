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
  const company = process.env.COMPANY_NAME || 'Vehicle Appraisals';
  const d = sub.data;
  const vehicle = [d.year, d.make, d.model].filter(Boolean).join(' ');
  const msg = {
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: sub.email,
    bcc: process.env.MAIL_BCC || undefined,
    subject: `Your vehicle appraisal ${sub.ref} – ${vehicle}`,
    text: `Hi ${sub.name},\n\nYour appraisal for the ${vehicle} (VIN ${d.vin}) is complete.\n` +
      `Appraised value: ${valueText}\n\nYour signed appraisal is attached. Bring it with you when you register the vehicle.\n\n` +
      `Thank you,\n${company}\n`,
    html: `<p>Hi ${esc(sub.name)},</p><p>Your appraisal for the <b>${esc(vehicle)}</b> (VIN ${esc(d.vin)}) is complete.</p>` +
      `<p style="font-size:20px"><b>Appraised value: ${esc(valueText)}</b></p>` +
      `<p>Your signed appraisal is attached. Bring it with you when you register the vehicle.</p><p>Thank you,<br>${esc(company)}</p>`,
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

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = { sendAppraisal, esc };
