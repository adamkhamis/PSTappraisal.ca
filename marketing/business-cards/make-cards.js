// Regenerates the business cards: npm i -D qrcode playwright-core, then node marketing/business-cards/make-cards.js
const { chromium } = require('playwright-core');
const QR = require('qrcode');
const OUT = '/home/user/appraisal-app/marketing/business-cards';

(async () => {
  const qr = await QR.toString('https://pstappraisal.ca/pst-calculator', { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0c2a52', light: '#ffffff' } });
  const phone = '<svg viewBox="0 0 24 24"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>';
  const mail = '<svg viewBox="0 0 24 24"><path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2.2V17h16V7.2l-8 5.3z"/><path d="M4 7l8 5.3L20 7" fill="none"/></svg>';
  const web = '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-3a15.6 15.6 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8zM12 4c.8 1.1 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.9 1.9-4zM4.3 14a8.2 8.2 0 0 1 0-4h3.4a16.5 16.5 0 0 0 0 4zm.8 2h3a15.6 15.6 0 0 0 1.4 3.6A8 8 0 0 1 5.1 16zm3-8h-3a8 8 0 0 1 4.4-3.6A15.6 15.6 0 0 0 8.1 8zM12 20c-.8-1.1-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.9-1.9 4zm2.3-6H9.7a14.6 14.6 0 0 1 0-4h4.6a14.6 14.6 0 0 1 0 4zm.2 5.6a15.6 15.6 0 0 0 1.4-3.6h3a8 8 0 0 1-4.4 3.6zm1.8-5.6a16.5 16.5 0 0 0 0-4h3.4a8.2 8.2 0 0 1 0 4z"/></svg>';

  // Page = 3.5" x 2" card + 0.125" bleed on every side. Content stays 0.125" inside the trim (safe area).
  const css = `
  @page { size: 3.75in 2.25in; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Source Sans 3', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .card { width: 3.75in; height: 2.25in; position: relative; overflow: hidden; page-break-after: always; }
  .safe { position: absolute; inset: 0.25in; display: flex; flex-direction: column; }
  .front { background: radial-gradient(3in 2in at 95% -20%, #1d5fb0 0%, transparent 70%), linear-gradient(155deg, #0a2347, #0f3a73); color: #fff; }
  .logo { display: flex; align-items: center; gap: 5px; font: 800 13pt Archivo, Arial; letter-spacing: -.01em; }
  .mark { background: #fff; color: #1456a8; border-radius: 4px; padding: 1px 5px; font-size: 10.5pt; letter-spacing: .03em; }
  .logo b { color: #8fe0b4; }
  .tag { margin-top: 0.12in; font: 800 15pt/1.08 Archivo, Arial; letter-spacing: -.015em; }
  .tag em { font-style: normal; color: #8fe0b4; }
  .sub { margin-top: 3px; font-size: 7.4pt; color: #c9d8ee; letter-spacing: .01em; }
  .contact { margin-top: auto; display: grid; gap: 2.5px; font-size: 8.3pt; font-weight: 600; }
  .contact div { display: flex; align-items: center; gap: 5px; }
  .contact svg { width: 8pt; height: 8pt; fill: #8fe0b4; flex: none; }
  .back { background: #fff; color: #122036; }
  .back .safe { flex-direction: row; gap: 0.16in; align-items: stretch; }
  .back .text { flex: 1; display: flex; flex-direction: column; }
  .back h2 { font: 800 11.5pt/1.12 Archivo, Arial; letter-spacing: -.01em; color: #0c2a52; }
  .back h2 span { color: #1456a8; }
  .back ul { list-style: none; margin-top: 7px; display: grid; gap: 3px; font-size: 7.6pt; }
  .back li { display: flex; gap: 5px; align-items: baseline; }
  .back li::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #0f7a4a; flex: none; transform: translateY(-1px); }
  .back .fine { margin-top: auto; font-size: 6.2pt; color: #566377; }
  .qr { width: 0.92in; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
  .qr .code { width: 0.86in; height: 0.86in; }
  .qr .code svg { width: 100%; height: 100%; display: block; }
  .qr span { font: 700 6.6pt Archivo, Arial; color: #1456a8; text-align: center; line-height: 1.15; }
  .stripe { position: absolute; left: 0; right: 0; bottom: 0; height: 0.2in; background: #1456a8; }
  /* guides (preview only) */
  .guides .card::after { content: ''; position: absolute; inset: 0.125in; border: 0.5px dashed rgba(255,80,80,.9); pointer-events: none; }`;

  const front = `<div class="card front"><div class="safe">
    <div class="logo"><span class="mark">PST</span>Appraisal<b>BC</b></div>
    <div class="tag">FIN 320 PST<br><em>Vehicle Appraisals</em></div>
    <div class="sub">BC private-sale vehicles · 100% online · Usually within 1 hour</div>
    <div class="contact">
      <div>${phone}604.635.3867</div>
      <div>${mail}Support@PSTAppraisal.ca</div>
      <div>${web}PSTappraisal.ca</div>
    </div></div></div>`;
  const back = `<div class="card back"><div class="safe">
    <div class="text">
      <h2>Paid less than Black Book?<br><span>Pay PST on what it's really worth.</span></h2>
      <ul>
        <li>Signed FIN 320, ready for ICBC</li>
        <li>Before or after you register</li>
        <li>Refund form included if already paid</li>
        <li>Photos only, no inspection visit</li>
      </ul>
      <p class="fine">Not affiliated with ICBC or the Government of BC.</p>
    </div>
    <div class="qr"><div class="code">${qr}</div><span>Scan to see<br>your saving</span></div>
  </div><div class="stripe"></div></div>`;

  const page = (body, guides) => `<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;800&family=Source+Sans+3:wght@400;600;700&display=swap"><style>${css}</style></head><body class="${guides ? 'guides' : ''}">${body}</body></html>`;

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
