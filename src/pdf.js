const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const UPLOADS = path.join(__dirname, '..', 'uploads');
const TEMPLATES = path.join(__dirname, '..', 'templates');

const money = (n) => '$' + Number(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Everything a PDF (ours or an official template) might need, flattened to strings.
function fieldValues(sub, value, notes) {
  const d = sub.data;
  return {
    ref: sub.ref,
    date: new Date().toLocaleDateString('en-CA'),
    buyer_name: sub.name,
    buyer_email: sub.email,
    buyer_phone: d.phone || '',
    buyer_address: [d.address, d.city, d.province, d.postal].filter(Boolean).join(', '),
    seller_name: d.seller_name || '',
    sale_date: d.sale_date || '',
    purchase_price: d.purchase_price ? money(d.purchase_price) : '',
    vin: (d.vin || '').toUpperCase(),
    year: d.year || '',
    make: d.make || '',
    model: d.model || '',
    trim: d.trim || '',
    colour: d.colour || '',
    odometer: d.odometer ? `${Number(d.odometer).toLocaleString('en-CA')} ${d.odometer_unit || 'km'}` : '',
    plate: d.plate || '',
    condition: d.condition || '',
    appraised_value: money(value),
    appraised_value_number: Number(value).toFixed(2),
    appraiser_notes: notes || '',
    appraiser_name: process.env.APPRAISER_NAME || '',
    appraiser_license: process.env.APPRAISER_LICENSE || '',
    company_name: process.env.COMPANY_NAME || '',
    company_address: process.env.COMPANY_ADDRESS || '',
    company_phone: process.env.COMPANY_PHONE || '',
  };
}

function wrap(text, font, size, maxWidth) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const test = line ? line + ' ' + word : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) { lines.push(line); line = word; } else line = test;
    }
    lines.push(line);
  }
  return lines;
}

// Our own branded appraisal certificate.
async function buildCertificate(sub, value, notes) {
  const f = fieldValues(sub, value, notes);
  const d = sub.data;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.12, 0.14, 0.18), muted = rgb(0.42, 0.45, 0.5), accent = rgb(0.1, 0.33, 0.62);
  const M = 50, W = 612 - M * 2;
  let y = 742;

  const text = (s, x, yy, opts = {}) => page.drawText(String(s), { x, y: yy, size: 10, font, color: ink, ...opts });
  const rule = () => { page.drawLine({ start: { x: M, y }, end: { x: 612 - M, y }, thickness: 0.6, color: rgb(0.8, 0.82, 0.85) }); };

  text(f.company_name, M, y, { font: bold, size: 16, color: accent });
  text(`Ref ${f.ref}`, 612 - M - bold.widthOfTextAtSize(`Ref ${f.ref}`, 10), y + 4, { font: bold });
  text(`Issued ${f.date}`, 612 - M - font.widthOfTextAtSize(`Issued ${f.date}`, 9), y - 10, { size: 9, color: muted });
  y -= 15;
  text([f.company_address, f.company_phone].filter(Boolean).join('  ·  '), M, y, { size: 9, color: muted });
  y -= 30;
  text('VEHICLE APPRAISAL CERTIFICATE', M, y, { font: bold, size: 18 });
  y -= 18; rule(); y -= 22;

  const section = (title, rows) => {
    text(title.toUpperCase(), M, y, { font: bold, size: 9, color: accent });
    y -= 16;
    const colW = W / 2;
    rows.forEach(([label, val], i) => {
      const x = M + (i % 2) * colW;
      text(label, x, y, { size: 8, color: muted });
      text(val || '—', x, y - 12, { font: bold, size: 10 });
      if (i % 2 === 1 || i === rows.length - 1) y -= 30;
    });
    y -= 4;
  };

  section('Vehicle', [
    ['Year / Make / Model', [f.year, f.make, f.model, f.trim].filter(Boolean).join(' ')],
    ['VIN', f.vin],
    ['Odometer', f.odometer],
    ['Colour', f.colour],
    ['Plate', f.plate],
    ['Overall condition', f.condition],
  ]);
  section('Transaction', [
    ['Owner / Buyer', f.buyer_name],
    ['Seller', f.seller_name],
    ['Address', f.buyer_address],
    ['Date of sale', f.sale_date],
    ['Declared purchase price', f.purchase_price],
  ]);

  const issues = [];
  if (d.issues) issues.push('Reported issues: ' + [].concat(d.issues).join(', '));
  if (d.description) issues.push('Owner description: ' + d.description);
  if (notes) issues.push('Appraiser notes: ' + notes);
  if (issues.length) {
    text('CONDITION', M, y, { font: bold, size: 9, color: accent });
    y -= 14;
    for (const line of wrap(issues.join('\n'), font, 9.5, W).slice(0, 14)) { text(line, M, y, { size: 9.5 }); y -= 13; }
    y -= 10;
  }

  // Value box
  page.drawRectangle({ x: M, y: y - 58, width: W, height: 58, color: rgb(0.94, 0.96, 0.99), borderColor: accent, borderWidth: 1 });
  text('APPRAISED VALUE', M + 16, y - 22, { font: bold, size: 9, color: accent });
  text(f.appraised_value + ' CAD', M + 16, y - 46, { font: bold, size: 22 });
  y -= 82;

  const decl = `I certify that I have appraised the vehicle described above and that, in my professional opinion, ` +
    `its fair market value as of ${f.date} is ${f.appraised_value}, based on its condition, mileage and the information provided.`;
  for (const line of wrap(decl, font, 9.5, W)) { text(line, M, y, { size: 9.5 }); y -= 13; }

  // Signature block pinned near bottom
  const sigY = 110;
  const sigPath = process.env.SIGNATURE_IMAGE && path.resolve(process.env.SIGNATURE_IMAGE);
  if (sigPath && fs.existsSync(sigPath)) {
    const bytes = fs.readFileSync(sigPath);
    const img = /\.png$/i.test(sigPath) ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const s = img.scaleToFit(160, 45);
    page.drawImage(img, { x: M, y: sigY + 4, width: s.width, height: s.height });
  }
  page.drawLine({ start: { x: M, y: sigY }, end: { x: M + 220, y: sigY }, thickness: 0.8, color: ink });
  text(f.appraiser_name || 'Appraiser', M, sigY - 14, { font: bold });
  if (f.appraiser_license) text(`Dealer Reg. / Appraiser #: ${f.appraiser_license}`, M, sigY - 27, { size: 9, color: muted });
  page.drawLine({ start: { x: 340, y: sigY }, end: { x: 562, y: sigY }, thickness: 0.8, color: ink });
  text(f.date, 340, sigY + 6);
  text('Date', 340, sigY - 14, { font: bold });

  text(`${f.company_name} · Certificate ${f.ref}`, M, 40, { size: 8, color: muted });
  return Buffer.from(await pdf.save());
}

// Optional: fill an official fillable PDF (e.g. your province's appraisal form) if you drop one in /templates.
// templates/field-map.json maps PDF field names -> keys from fieldValues(), e.g. { "VIN": "vin" }.
async function buildOfficialForm(sub, value, notes) {
  const formPath = path.join(TEMPLATES, 'official-form.pdf');
  const mapPath = path.join(TEMPLATES, 'field-map.json');
  if (!fs.existsSync(formPath) || !fs.existsSync(mapPath)) return null;
  delete require.cache[mapPath];
  const f = fieldValues(sub, value, notes);
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  delete map._README;
  const pdf = await PDFDocument.load(fs.readFileSync(formPath));
  const form = pdf.getForm();
  for (const [pdfField, key] of Object.entries(map)) {
    try {
      const fld = form.getField(pdfField);
      if (fld.constructor.name === 'PDFCheckBox') { if (f[key]) fld.check(); }
      else fld.setText(String(f[key] ?? key)); // unknown key = literal text
    } catch (e) { console.warn(`Field "${pdfField}" not found in official form`); }
  }
  if (process.env.FLATTEN_OFFICIAL_FORM !== 'false') form.flatten();
  return Buffer.from(await pdf.save());
}

async function listFormFields() {
  const formPath = path.join(TEMPLATES, 'official-form.pdf');
  const pdf = await PDFDocument.load(fs.readFileSync(formPath));
  return pdf.getForm().getFields().map((f) => `${f.getName()}  (${f.constructor.name})`);
}

module.exports = { buildCertificate, buildOfficialForm, listFormFields, fieldValues, money, UPLOADS };
