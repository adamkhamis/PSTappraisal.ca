// Writes the public site as plain .html files (for previews or static hosting).
// Usage: node src/export-static.js <outdir>
const fs = require('fs');
const path = require('path');
const { renderPage, PAGES } = require('./pages');
const { priceVars } = require('./pricing');

const out = path.resolve(process.argv[2] || 'static-preview');
const preview = process.argv.includes('--preview');
const BANNER = '<div style="background:#fff4d1;color:#5c4400;text-align:center;font:600 14px sans-serif;padding:8px">Preview of PSTappraisal.ca · ordering and the contact form work once the full site is live</div>';
fs.mkdirSync(out, { recursive: true });
for (const name of PAGES) {
  const html = renderPage(name, { noindex: preview, ...priceVars() })
    .replace(/(href|src)="\/(?!\/)([^"#?]*)/g, (m, attr, p) => `${attr}="${p === '' ? 'index.html' : /\.\w+$/.test(p) ? p : p + '.html'}`);
  fs.writeFileSync(path.join(out, `${name}.html`), preview ? html.replace(/<body[^>]*>/, (m) => m + BANNER) : html);
}
for (const f of ['style.css', 'site.js', 'calc.js', 'start.js', 'thank-you.js', 'lien.js', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'og-image.png']) fs.copyFileSync(path.join(__dirname, '..', 'public', f), path.join(out, f));
console.log(`Wrote ${PAGES.length} pages to ${out}`);
