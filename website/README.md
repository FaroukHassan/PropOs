# sakanly.com

Static bilingual website (English at `/`, Arabic at `/ar/`). No framework.

- `node build.mjs` builds everything into `dist/`
- Pages and copy: `src/pages.mjs` · frame (header, footer, forms): `src/layout.mjs`
- Styles and browser code: `public/site.css`, `public/site.js`
- Live rooms, holiday homes and enquiry forms use the PropOS API at `/api/public/site/*`
  (enquiries arrive in the CRM under Leasing as new leads, source "Website").
