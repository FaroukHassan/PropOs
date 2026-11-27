// website/build.mjs — builds sakanly.com as static pages in English (/) and Arabic (/ar/).
// node build.mjs → dist/
import { mkdirSync, writeFileSync, readFileSync, cpSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pages } from './src/pages.mjs';
import { layout } from './src/layout.mjs';

const root = dirname(fileURLToPath(import.meta.url));
// PREVIEW=/preview builds a test copy served under that path (hidden from search engines)
const BASE = (process.env.PREVIEW || '').replace(/\/$/, '');
const out = process.env.OUT || join(root, 'dist');
const SITE = 'https://sakanly.com';
rmSync(out, { recursive: true, force: true });
cpSync(join(root, 'public'), out, { recursive: true });

const urls = [];
for (const page of pages) {
  for (const lang of ['en', 'ar']) {
    let html = layout(page, lang);
    if (BASE) html = html.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE}/`).replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex, nofollow">');
    const path = page.path === '/404' ? (lang === 'en' ? '/404.html' : '/ar/404.html') : `${lang === 'ar' ? '/ar' : ''}${page.path}`;
    const file = path.endsWith('.html') ? join(out, path) : join(out, path, 'index.html');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
    if (!page.noindex) urls.push({ en: `${SITE}${page.path}`, ar: `${SITE}/ar${page.path}`, lang, priority: page.priority || 0.6 });
  }
}

const seen = new Set();
const xml = urls.filter(u => { const k = u.lang === 'en' ? u.en : u.ar; if (seen.has(k)) return false; seen.add(k); return true; }).map(u => `  <url>
    <loc>${u.lang === 'en' ? u.en : u.ar}</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${u.en}"/>
    <xhtml:link rel="alternate" hreflang="ar" href="${u.ar}"/>
    <priority>${u.priority}</priority>
  </url>`).join('\n');
writeFileSync(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${xml}\n</urlset>\n`);
writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /thank-you/\nDisallow: /ar/thank-you/\n\nSitemap: ${SITE}/sitemap.xml\n`);
if (BASE) {
  for (const f of ['site.css', 'site.js']) {
    const p = join(out, f);
    writeFileSync(p, readFileSync(p, 'utf8').replace(/url\(\/fonts/g, `url(${BASE}/fonts`).replace("`${ar ? '/ar' : ''}/thank-you/`", `\`${BASE}\${ar ? '/ar' : ''}/thank-you/\``));
  }
  writeFileSync(join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
} else writeFileSync(join(out, 'CNAME'), 'sakanly.com\n');
writeFileSync(join(out, '.nojekyll'), '');
console.log(`Built ${pages.length * 2} pages → dist/`);
