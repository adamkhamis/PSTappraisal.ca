// Writes the public site as plain .html files (for previews or static hosting).
// Usage: node src/export-static.js <outdir>
const fs = require('fs');
const path = require('path');
const { renderPage, PAGES } = require('./pages');

const out = path.resolve(process.argv[2] || 'static-preview');
const preview = process.argv.includes('--preview');
const BANNER = '<div style="background:#fff4d1;color:#5c4400;text-align:center;font:600 14px sans-serif;padding:8px">Preview of PSTappraisal.ca · forms don\'t submit here</div>';
fs.mkdirSync(out, { recursive: true });
const price = '$' + (Number(process.env.PRICE_CENTS || 9900) / 100).toFixed(2).replace('.00', '');
for (const name of PAGES) {
  const html = renderPage(name, { price })
    .replace(/(href|src)="\/(?!\/)([^"#?]*)/g, (m, attr, p) => `${attr}="${p === '' ? 'index.html' : /\.\w+$/.test(p) ? p : p + '.html'}`);
  fs.writeFileSync(path.join(out, `${name}.html`), preview ? html.replace('<body>', '<body>' + BANNER) : html);
}
for (const f of ['style.css', 'site.js', 'start.js', 'thank-you.js']) fs.copyFileSync(path.join(__dirname, '..', 'public', f), path.join(out, f));
console.log(`Wrote ${PAGES.length} pages to ${out}`);
