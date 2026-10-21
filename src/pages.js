const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, '..', 'site');
const read = (p) => fs.readFileSync(path.join(SITE, p), 'utf8');

// The address Google should treat as the real site. Copies elsewhere (test domains, previews) point here
// and are kept out of search results.
const canonicalOrigin = () => (process.env.CANONICAL_URL || 'https://pstappraisal.ca').replace(/\/$/, '');
const isCanonicalHost = () => (process.env.BASE_URL || '').replace(/\/$/, '').replace(/^http:/, 'https:') === canonicalOrigin();
const pagePath = (name) => (name === 'index' ? '/' : '/' + name);

const strip = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

// Business details for Google, from Admin → Settings.
function businessLd(vars) {
  const e = process.env, origin = canonicalOrigin();
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': origin + '/#business',
    name: e.COMPANY_NAME || 'PST Appraisal BC',
    url: origin + '/',
    logo: origin + '/icon-512.png',
    image: origin + '/og-image.png',
    description: 'Online FIN 320 Motor Vehicle Appraisals for PST on private used-vehicle sales in British Columbia.',
    telephone: '+1-' + String(e.COMPANY_PHONE || '604.635.3867').replace(/\D/g, '').slice(-10).replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3'),
    email: 'support@pstappraisal.ca',
    address: {
      '@type': 'PostalAddress',
      streetAddress: e.COMPANY_STREET || 'PMB 56117, 915 E Cordova St',
      addressLocality: e.COMPANY_CITY || 'Vancouver',
      addressRegion: e.COMPANY_PROVINCE || 'BC',
      postalCode: e.COMPANY_POSTAL || 'V6A 4B8',
      addressCountry: 'CA',
    },
    areaServed: { '@type': 'AdministrativeArea', name: 'British Columbia' },
    priceRange: vars.price_amount || '$70',
    makesOffer: {
      '@type': 'Offer',
      priceCurrency: 'CAD',
      price: String(vars.price_amount || '$70').replace(/[^\d.]/g, ''),
      itemOffered: { '@type': 'Service', name: 'FIN 320 PST vehicle appraisal', serviceType: 'Motor vehicle appraisal for BC PST' },
    },
  };
}

// FAQ questions for Google, read from the page's <details> blocks.
function faqLd(body) {
  const items = [...body.matchAll(/<details><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)];
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(([, q, a]) => ({ '@type': 'Question', name: strip(q), acceptedAnswer: { '@type': 'Answer', text: strip(a) } })),
  };
}

// Assembles a page from site/pages/<name>.html plus the shared header and footer.
function renderPage(name, vars = {}) {
  let body = read(`pages/${name}.html`);
  const m = body.match(/^<!--meta (\{.*\}) -->\n?/);
  const meta = m ? JSON.parse(m[1]) : {};
  if (m) body = body.slice(m[0].length);
  const scripts = (meta.scripts || []).map((s) => `<script src="${s}"></script>`).join('\n');
  const html = read('partials/header.html') + body + read('partials/footer.html');
  const origin = canonicalOrigin();
  const noindex = meta.noindex || vars.noindex || !isCanonicalHost();
  const structured = [name === 'index' || name === 'contact' || name === 'pricing' ? businessLd(vars) : null, name === 'faq' ? faqLd(body) : null].filter(Boolean);
  const all = {
    title: 'PST Appraisal BC', description: '', ...meta, scripts,
    today: new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }),
    canonical: origin + pagePath(name),
    robots: noindex ? 'noindex, follow' : 'index, follow',
    og_image: origin + '/og-image.png',
    jsonld: structured.map(jsonLd).join('\n'),
    ...vars,
  };
  const fill = (t) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => all[k] ?? '');
  return fill(fill(html)) // twice, so values like the meta description can use {{price}}
    .replace(`data-nav="${meta.nav || name}"`, `data-nav="${meta.nav || name}" aria-current="page"`);
}

const PAGES = fs.readdirSync(path.join(SITE, 'pages')).map((f) => f.replace(/\.html$/, ''));

// Pages for sitemap.xml: everything except pages marked noindex (order form, thank-you).
function sitemapPages() {
  return PAGES.filter((p) => !/"noindex":true/.test(read(`pages/${p}.html`).split('\n')[0]));
}

function sitemapXml() {
  const origin = canonicalOrigin();
  const today = new Date().toISOString().slice(0, 10);
  const pri = { index: '1.0', 'fin-320': '0.9', 'pst-calculator': '0.9', 'ways-to-use-it': '0.8', 'how-it-works': '0.8', pricing: '0.8', faq: '0.8' };
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    sitemapPages().map((p) => `  <url><loc>${origin}${pagePath(p)}</loc><lastmod>${today}</lastmod><priority>${pri[p] || '0.5'}</priority></url>`).join('\n') +
    '\n</urlset>\n';
}

function robotsTxt() {
  if (!isCanonicalHost()) return 'User-agent: *\nDisallow: /\n'; // test copies stay out of search engines
  return `User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /webhook/\nDisallow: /thank-you\n\nSitemap: ${canonicalOrigin()}/sitemap.xml\n`;
}

module.exports = { renderPage, PAGES, sitemapXml, robotsTxt };
