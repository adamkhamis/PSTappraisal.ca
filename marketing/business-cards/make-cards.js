// Regenerates the business cards: npm i -D qrcode playwright-core, then node marketing/business-cards/make-cards.js
const { chromium } = require('playwright-core');
const QR = require('qrcode');
const OUT = process.env.OUT || '/home/user/appraisal-app/marketing/business-cards';

(async () => {
  const qr = await QR.toString('https://pstappraisal.ca/pst-calculator', { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0c2a52', light: '#ffffff' } });
  const icon = {
    phone: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2.2V17h16V7.2l-8 5.3z"/></svg>',
    web: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-3a15.6 15.6 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8zM12 4c.8 1.1 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.9 1.9-4zM4.3 14a8.2 8.2 0 0 1 0-4h3.4a16.5 16.5 0 0 0 0 4zm.8 2h3a15.6 15.6 0 0 0 1.4 3.6A8 8 0 0 1 5.1 16zm3-8h-3a8 8 0 0 1 4.4-3.6A15.6 15.6 0 0 0 8.1 8zM12 20c-.8-1.1-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.9-1.9 4zm2.3-6H9.7a14.6 14.6 0 0 1 0-4h4.6a14.6 14.6 0 0 1 0 4zm.2 5.6a15.6 15.6 0 0 0 1.4-3.6h3a8 8 0 0 1-4.4 3.6zm1.8-5.6a16.5 16.5 0 0 0 0-4h3.4a8.2 8.2 0 0 1 0 4z"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 10.4 3.5 2.1-.8 1.3L11 13V7h2z"/></svg>',
  };

  // Page = 3.5" x 2" card + 0.125" bleed on every side. Content stays 0.125" inside the trim (safe area).
  const css = `
  @page { size: 3.75in 2.25in; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Source Sans 3', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .card { width: 3.75in; height: 2.25in; position: relative; overflow: hidden; page-break-after: always; }
  .safe { position: absolute; inset: 0.25in; display: flex; flex-direction: column; }

  /* Front */
  .front { background: radial-gradient(3in 2in at 95% -20%, #1d5fb0 0%, transparent 70%), linear-gradient(155deg, #0a2347, #0f3a73); color: #fff; }
  .logo { display: flex; align-items: center; gap: 5px; font: 800 12pt Archivo, Arial; letter-spacing: -.01em; }
  .mark { background: #fff; color: #1456a8; border-radius: 4px; padding: 1px 5px; font-size: 9.5pt; letter-spacing: .03em; }
  .logo b { color: #8fe0b4; }
  .tag { margin-top: 0.08in; font: 800 14pt/1.05 Archivo, Arial; letter-spacing: -.015em; }
  .tag em { font-style: normal; color: #8fe0b4; }
  .badges { display: flex; gap: 4px; margin-top: 5px; flex-wrap: wrap; }
  .badge { display: inline-flex; align-items: center; gap: 3px; font: 700 6.3pt Archivo, Arial; letter-spacing: .02em; text-transform: uppercase;
           border: 0.6pt solid rgba(143,224,180,.65); color: #d9f5e6; border-radius: 99px; padding: 1.5px 6px 1.5px 4px; }
  .badge svg { width: 6.5pt; height: 6.5pt; fill: #8fe0b4; }
  .art { position: absolute; right: 0.24in; top: 0.24in; width: 1.22in; height: auto; }
  .bottom { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; gap: 8px; }
  .contact { display: grid; gap: 2px; font-size: 7.8pt; font-weight: 600; }
  .contact div { display: flex; align-items: center; gap: 4px; white-space: nowrap; }
  .contact svg { width: 7.5pt; height: 7.5pt; fill: #8fe0b4; flex: none; }
  .legal { text-align: right; font-size: 5.9pt; line-height: 1.3; color: #b9c9e0; }
  .legal b { display: block; color: #fff; font-weight: 700; font-size: 6.4pt; letter-spacing: .02em; }

  /* Back: white left, navy QR panel right */
  .back { background: #fff; color: #122036; display: flex; }
  .back .left { position: relative; flex: 1; }
  .back .left .safe { inset: 0.25in 0.12in 0.25in 0.25in; }
  .back .eyebrow { font: 700 5.6pt Archivo, Arial; letter-spacing: .08em; white-space: nowrap; text-transform: uppercase; color: #1456a8; }
  .back h2 { margin-top: 2px; font: 800 11.2pt/1.06 Archivo, Arial; letter-spacing: -.012em; color: #0c2a52; }
  .back h2 span { color: #0f7a4a; }
  .steps { margin-top: 6px; display: grid; gap: 3px; }
  .steps div { display: flex; align-items: center; gap: 5px; font-size: 7.2pt; line-height: 1.15; }
  .steps i { font: 800 6.3pt Archivo, Arial; font-style: normal; width: 10.5pt; height: 10.5pt; border-radius: 50%; background: #e6eef9; color: #1456a8; display: grid; place-items: center; flex: none; }
  .steps b { font-weight: 700; }
  .example { margin-top: auto; background: #e1f4ea; color: #0b5e39; border-radius: 4px; padding: 3px 6px; font-size: 6.4pt; line-height: 1.25; }
  .example b { font-weight: 800; }
  .back .right { width: 1.32in; background: linear-gradient(170deg, #0f3a73, #0a2347); color: #fff; display: flex; flex-direction: column; align-items: center;
                 justify-content: center; gap: 5px; padding: 0.25in 0.25in 0.25in 0.14in; text-align: center; }
  .back .right .code { width: 0.8in; height: 0.8in; background: #fff; padding: 3px; border-radius: 4px; }
  .back .right .code svg { width: 100%; height: 100%; display: block; }
  .back .right strong { font: 800 7pt/1.15 Archivo, Arial; }
  .back .right small { font-size: 6.2pt; color: #c9d8ee; }`;

  const front = `<div class="card front">
    <svg class="art" viewBox="0 0 120 112" aria-hidden="true">
      <g transform="rotate(6 60 50)">
        <rect x="30" y="4" width="62" height="80" rx="4" fill="#ffffff" fill-opacity=".1" stroke="#ffffff" stroke-opacity=".55" stroke-width="1.4"/>
        <rect x="30" y="4" width="62" height="13" rx="4" fill="#ffffff" fill-opacity=".16"/>
        <text x="61" y="13.5" text-anchor="middle" font-family="Archivo, Arial" font-weight="800" font-size="7" fill="#ffffff">FIN 320</text>
        <g stroke="#ffffff" stroke-opacity=".45" stroke-width="1.6" stroke-linecap="round">
          <line x1="38" y1="26" x2="84" y2="26"/><line x1="38" y1="33" x2="76" y2="33"/><line x1="38" y1="40" x2="82" y2="40"/>
          <line x1="38" y1="47" x2="70" y2="47"/>
        </g>
        <rect x="38" y="54" width="46" height="11" rx="2" fill="#8fe0b4" fill-opacity=".22" stroke="#8fe0b4" stroke-opacity=".7"/>
        <text x="42" y="62" font-family="Archivo, Arial" font-weight="800" font-size="6.6" fill="#8fe0b4">$ 8,200.00</text>
        <path d="M38 76 q5 -6 9 0 t9 0 t9 -2" fill="none" stroke="#ffffff" stroke-opacity=".6" stroke-width="1.3" stroke-linecap="round"/>
      </g>
      <g transform="translate(4 70)">
        <path d="M6 22 h62 a4 4 0 0 0 4 -4 v-5 a4 4 0 0 0 -3 -4 l-11 -3 l-9 -8 a6 6 0 0 0 -4 -1.5 h-20 a6 6 0 0 0 -5 2.5 l-6 7 l-7 2 a4 4 0 0 0 -3 4 v6 a4 4 0 0 0 4 4z"
              fill="#0f3a73" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M22 8 l4.5 -5.5 h13 l7.5 5.5z" fill="#ffffff" fill-opacity=".18" stroke="#ffffff" stroke-opacity=".6" stroke-width="1"/>
        <circle cx="18" cy="22" r="6.5" fill="#0a2347" stroke="#ffffff" stroke-width="1.5"/><circle cx="18" cy="22" r="2.2" fill="#ffffff" fill-opacity=".7"/>
        <circle cx="56" cy="22" r="6.5" fill="#0a2347" stroke="#ffffff" stroke-width="1.5"/><circle cx="56" cy="22" r="2.2" fill="#ffffff" fill-opacity=".7"/>
      </g>
      <g transform="translate(95 76) rotate(-14)">
        <circle r="17" fill="#0f7a4a" fill-opacity=".9" stroke="#8fe0b4" stroke-width="1.4"/>
        <circle r="13.5" fill="none" stroke="#8fe0b4" stroke-width=".7" stroke-dasharray="1.6 1.4"/>
        <path d="M-6 -1.5 l4 4 l8 -8" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        <text y="9" text-anchor="middle" font-family="Archivo, Arial" font-weight="800" font-size="4.6" letter-spacing=".4" fill="#ffffff">APPRAISED</text>
      </g>
    </svg>
    <div class="safe">
    <div class="logo"><span class="mark">PST</span>Appraisal<b>BC</b></div>
    <div class="tag">FIN 320 PST<br><em>Vehicle Appraisals</em></div>
    <div class="badges">
      <span class="badge">${icon.check}Professional vehicle appraiser</span>
      <span class="badge">${icon.clock}Report delivered within 1 hour</span>
    </div>
    <div class="bottom">
      <div class="contact">
        <div>${icon.phone}604.635.3867</div>
        <div>${icon.mail}Support@PSTAppraisal.ca</div>
        <div>${icon.web}PSTappraisal.ca</div>
      </div>
      <div class="legal"><b>1561473 B.C. LTD.</b>PMB 56117, 915 E Cordova St<br>Vancouver, BC V6A 4B8</div>
    </div></div></div>`;

  const back = `<div class="card back">
    <div class="left"><div class="safe">
      <div class="eyebrow">For ICBC registration &amp; PST refunds</div>
      <h2>Paid less than Black Book?<br><span>Don't pay PST on the difference.</span></h2>
      <div class="steps">
        <div><i>1</i><span><b>Send the VIN &amp; photos</b> from your phone</span></div>
        <div><i>2</i><span><b>We appraise</b> its real condition</span></div>
        <div><i>3</i><span><b>Signed FIN 320 emailed</b> within 1 hour</span></div>
      </div>
      <div class="example">e.g. Black Book <b>$13,900</b>, paid <b>$8,200</b><br>→ save up to <b>$684 in PST</b></div>
    </div></div>
    <div class="right">
      <div class="code">${qr}</div>
      <strong>Scan to see<br>your PST saving</strong>
      <small>Already registered?<br>Refund form included.</small>
    </div>
  </div>`;

  const page = (body) => `<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;800&family=Source+Sans+3:wght@400;600;700&display=swap"><style>${css}</style></head><body>${body}</body></html>`;

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  await p.setContent(page(front + back), { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: `${OUT}/PST-Appraisal-business-card-print.pdf`, width: '3.75in', height: '2.25in', printBackground: true, pageRanges: '1-2' });
  // 300 dpi previews of each side, trimmed to the finished 3.5" x 2" size
  const v = await b.newPage({ viewport: { width: 360, height: 216 }, deviceScaleFactor: 300 / 96 });
  for (const [name, html] of [['front', front], ['back', back]]) {
    await v.setContent(page(html), { waitUntil: 'networkidle' }); await v.evaluate(() => document.fonts.ready);
    await v.screenshot({ path: `${OUT}/card-${name}.png`, clip: { x: 12, y: 12, width: 336, height: 192 } });
  }
  await b.close();
})();
