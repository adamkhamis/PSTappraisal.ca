const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PDFDocument, PDFName, StandardFonts, rgb, pushGraphicsState, popGraphicsState, concatTransformationMatrix, drawObject } = require('@cantoo/pdf-lib');

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
    registered_date: d.registered_date || '',
    pst_paid: d.pst_paid ? money(d.pst_paid) : '',
    appraiser_name: process.env.APPRAISER_NAME || '',
    appraiser_license: process.env.APPRAISER_LICENSE || '',
    company_name: process.env.COMPANY_NAME || '',
    company_address: process.env.COMPANY_ADDRESS || [process.env.COMPANY_STREET, process.env.COMPANY_CITY, process.env.COMPANY_PROVINCE, process.env.COMPANY_POSTAL].filter(Boolean).join(', '),
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
    `its expected retail value in a private sale as of ${f.date} is ${f.appraised_value}, based on its condition, mileage and the information provided.`;
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

// ---------- Official BC forms (templates/official-form.pdf = FIN 320, templates/fin-355mv.pdf = FIN 355/MV) ----------
// The government PDFs are protected but allow form filling. We fill the fields and save them with the same
// restrictions (printing, filling and comments allowed; editing and copying not), so they stay the official form.
const PERMISSIONS = { printing: 'highResolution', modifying: false, copying: false, annotating: true, fillingForms: true, contentAccessibility: true, documentAssembly: false };

const ymd = (d) => (d ? String(d).replace(/-/g, '/') : '');
const amount = (n) => Number(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pstRate = (v) => (v >= 125000 ? 0.2 : 0.12); // BC private-sale passenger vehicle rates
// FIN 320 only offers Good / Fair / Poor
const FIN_CONDITION = { Excellent: 'Good', Good: 'Good', Fair: 'Fair', Poor: 'Poor', 'Not running': 'Poor' };
const CONDITION_BOX = { Good: '1', Fair: '2', Poor: '3' };

function company() {
  const e = process.env;
  return {
    business: e.COMPANY_NAME || '', dealerNumber: e.APPRAISER_LICENSE || '', businessNumber: e.BUSINESS_NUMBER || '',
    pstNumber: e.PST_NUMBER || '', contact: e.APPRAISER_NAME || '', street: e.COMPANY_STREET || '', city: e.COMPANY_CITY || '',
    province: e.COMPANY_PROVINCE || 'BC', postal: e.COMPANY_POSTAL || '', phone: e.COMPANY_PHONE || '',
  };
}

// Estimated refund: PST paid at registration minus PST on the higher of the price and the appraised value.
function refundEstimate(sub, value) {
  const d = sub.data, price = Number(d.purchase_price) || 0, bb = Number(d.black_book) || 0;
  const paid = Number(d.pst_paid) || (bb > price ? bb * pstRate(bb) : 0);
  const taxable = Math.max(price, value);
  const due = taxable * pstRate(taxable);
  return paid > due ? Math.round((paid - due) * 100) / 100 : 0;
}

async function loadForm(file) {
  const formPath = path.join(TEMPLATES, file);
  if (!fs.existsSync(formPath)) return null;
  return PDFDocument.load(fs.readFileSync(formPath), { password: '' });
}

function fill(form, values) {
  for (const [name, val] of Object.entries(values)) {
    if (val === undefined || val === null || val === '') continue;
    try { form.getTextField(name).setText(String(val)); } catch (e) { console.warn(`[forms] field ${name}: ${e.message}`); }
  }
}

async function save(doc) {
  doc.encrypt({ ownerPassword: crypto.randomBytes(24).toString('hex'), userPassword: '', permissions: PERMISSIONS });
  return Buffer.from(await doc.save());
}

// Adds the appraiser's signature image as a stamp (a comment-type mark, which the form allows).
async function addSignature(doc, page, rect) {
  const sigPath = process.env.SIGNATURE_IMAGE && path.resolve(process.env.SIGNATURE_IMAGE);
  if (!sigPath || !fs.existsSync(sigPath)) return;
  const bytes = fs.readFileSync(sigPath);
  const img = /\.png$/i.test(sigPath) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  const { width, height } = img.scaleToFit(rect.w, rect.h);
  const ctx = doc.context;
  const ap = ctx.formXObject(
    [pushGraphicsState(), concatTransformationMatrix(width, 0, 0, height, 0, 0), drawObject('Sig'), popGraphicsState()],
    { BBox: [0, 0, width, height], Resources: { XObject: { Sig: img.ref } } },
  );
  const annot = ctx.register(ctx.obj({
    Type: 'Annot', Subtype: 'Stamp', Name: 'Signature', F: 4, Contents: 'Appraiser signature',
    Rect: [rect.x, rect.y, rect.x + width, rect.y + height], AP: { N: ctx.register(ap) },
  }));
  page.node.addAnnot(annot);
}

async function buildFin320(sub, value, notes, condition) {
  const doc = await loadForm('official-form.pdf');
  if (!doc) return null;
  const d = sub.data, c = company(), today = ymd(new Date().toLocaleDateString('en-CA'));
  const issues = [].concat(d.issues || []).filter(Boolean);
  const comments = [notes, issues.length ? 'Reported: ' + issues.join(', ') + '.' : ''].filter(Boolean).join(' ');
  const form = doc.getForm();
  fill(form, {
    'txtDealer/AppraiserName': c.business, txtDealerNumber: c.dealerNumber, txtBusinessNumber: c.businessNumber, txtPSTNumber: c.pstNumber,
    txtContactName: c.contact, txtMailAddress: c.street, txtCity: c.city, txtProvA: c.province, txtCountry: 'Canada',
    txtPostalCode: c.postal, txtContactPhone: c.phone,
    txtPurchaserName: sub.name, txtPurchaserMailAddress: d.address, txtPurchaserCity: d.city, txtProvB: 'BC', txtCountry2: 'Canada',
    txtPurchaserPostalCode: d.postal, txtPurchaserContactPhone: d.phone,
    txtYear: d.year, txtMake: d.make, txtModel: d.model, txtTrim: d.trim, txtVIN: (d.vin || '').toUpperCase(),
    txtAppraisalDate: today, txtAppraisedValue: amount(value),
    txtOdometer: d.odometer ? `${Number(d.odometer).toLocaleString('en-CA')} ${d.odometer_unit || 'km'}` : '',
    txtAppraiserComments: comments, txtAppraiserName: c.contact, txtDateSigned: today,
  });
  const box = CONDITION_BOX[condition || FIN_CONDITION[d.condition]];
  if (box) {
    // optCondition is one field with three boxes (/1 Good, /2 Fair, /3 Poor); tick one, clear the others.
    const field = form.getCheckBox('optCondition').acroField;
    const on = PDFName.of(box);
    field.dict.set(PDFName.of('V'), on);
    for (const w of field.getWidgets()) w.setAppearanceState(String(w.getOnValue()) === '/' + box ? on : PDFName.of('Off'));
  }
  await addSignature(doc, doc.getPages()[0], { x: 40, y: 20, w: 200, h: 30 });
  return save(doc);
}

async function buildFin355(sub, value) {
  const doc = await loadForm('fin-355mv.pdf');
  if (!doc) return null;
  const d = sub.data, refund = refundEstimate(sub, value);
  fill(doc.getForm(), {
    txtFullLegalName: sub.name, txtMailAddress: d.address, txtCity: d.city, txtProvA: 'BC', txtPostalCode: d.postal,
    txtContactName: sub.name, txtContactPhone: d.phone,
    txtAmount: refund ? amount(refund) : '', txtClaimPeriodTo: ymd(d.registered_date),
    txtVIN: (d.vin || '').toUpperCase(), txtMakeModel: [d.make, d.model].filter(Boolean).join(' '), txtYear: d.year,
    txtPurchasePrice: d.purchase_price ? amount(d.purchase_price) : '',
    txtTaxAmount5: refund ? amount(refund) : '', // refund reason 5: paid PST on Black Book, FIN 320 obtained
    txtSigningAuth: sub.name,
  });
  return save(doc);
}

async function listFormFields(file = 'official-form.pdf') {
  const doc = await loadForm(file);
  return doc.getForm().getFields().map((f) => `${f.getName()}  (${f.constructor.name})`);
}

module.exports = { buildCertificate, buildFin320, buildFin355, refundEstimate, FIN_CONDITION, listFormFields, fieldValues, money, UPLOADS };
