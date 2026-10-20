const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, '..', 'site');
const read = (p) => fs.readFileSync(path.join(SITE, p), 'utf8');

// Assembles a page from site/pages/<name>.html plus the shared header and footer.
function renderPage(name, vars) {
  let body = read(`pages/${name}.html`);
  const m = body.match(/^<!--meta (\{.*\}) -->\n?/);
  const meta = m ? JSON.parse(m[1]) : {};
  if (m) body = body.slice(m[0].length);
  const scripts = (meta.scripts || []).map((s) => `<script src="${s}"></script>`).join('\n');
  const html = read('partials/header.html') + body + read('partials/footer.html');
  const all = { title: 'PST Appraisal BC', description: '', ...meta, scripts, today: new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }), ...vars };
  const fill = (t) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => all[k] ?? '');
  return fill(fill(html)) // twice, so values like the meta description can use {{price}}
    .replace(`data-nav="${name}"`, `data-nav="${name}" aria-current="page"`);
}

const PAGES = fs.readdirSync(path.join(SITE, 'pages')).map((f) => f.replace(/\.html$/, ''));

module.exports = { renderPage, PAGES };
