// website/src/layout.mjs — the frame around every page: head, header, footer, WhatsApp, enquiry modal
export const WA_NUMBER = '971565913200';
export const PHONE = '+971 56 591 3200';
export const EMAIL = 'info@sakanly.com';
const SITE = 'https://sakanly.com';

export const icon = {
  wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4a.5.5 0 0 0 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z"/></svg>',
  stay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18M5 20V9l7-5 7 5v11"/><path d="M9 20v-5h6v5"/><path d="M17 4.5v2"/></svg>',
  room: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18h18M3 15h18M6 10V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M12 10V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l2 2M15 8l2 2"/></svg>',
  owner: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6"/><path d="M12 9.5v.01"/></svg>',
  buy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M16.5 7.5C16 6 14.3 5 12 5c-2.8 0-4.5 1.4-4.5 3.2 0 4.3 9 2.3 9 6.6 0 1.9-1.9 3.2-4.5 3.2-2.4 0-4.2-1-4.8-2.6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
  tt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-1.8-2.5V9.7a5.7 5.7 0 1 0 4.9 5.7V9.1a7.3 7.3 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.2-1.6Z"/></svg>',
  li: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3zM9 9h3.8v1.7h.1a4.2 4.2 0 0 1 3.8-2c4 0 4.8 2.6 4.8 6.1V21h-4v-5.5c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21H9z"/></svg>',
};

export const L = lang => (en, ar) => (lang === 'ar' ? ar : en);
export const href = (lang, path) => `${lang === 'ar' ? '/ar' : ''}${path}`;
export const wa = text => `https://wa.me/${WA_NUMBER}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const arrow = '<span class="go-arrow">→</span>';

const NAV = [
  ['/stays/', 'Stays', 'بيوت العطلات'],
  ['/shared-living/', 'Shared living', 'السكن المشترك'],
  ['/rent/', 'Rent a home', 'استئجار منزل'],
  ['/owners/', 'For owners', 'للملاك'],
  ['/buy/', 'Buy', 'شراء'],
  ['/about/', 'About', 'من نحن'],
];

export function enquiryModal(lang) {
  const t = L(lang);
  return `<div class="modal" id="enquire" role="dialog" aria-modal="true" aria-labelledby="enq-title"><div class="modal-box">
  <button class="modal-x" aria-label="${t('Close', 'إغلاق')}">×</button>
  <div class="eyebrow">${t('Enquire', 'استفسار')}</div>
  <h3 id="enq-title" data-title></h3>
  <p class="small muted">${t('Leave your details and our team will reply on WhatsApp, usually within the hour.', 'اترك بياناتك وسيرد عليك فريقنا على واتساب، عادةً خلال ساعة.')}</p>
  <form class="form" data-lead="shared" novalidate>
    ${fields(lang, [['name', t('Full name', 'الاسم الكامل'), 'text', true], ['phone', t('WhatsApp number', 'رقم الواتساب'), 'tel', true], ['moveIn', t('Move-in or check-in date', 'تاريخ الدخول أو الوصول'), 'date'], ['email', t('Email (optional)', 'البريد الإلكتروني (اختياري)'), 'email']])}
    <div class="field full"><label for="m-message">${t('Anything else?', 'ملاحظات أخرى؟')}</label><textarea class="input" id="m-message" name="message" placeholder="${t('Number of nights or months, questions…', 'عدد الليالي أو الشهور، أسئلة…')}"></textarea></div>
    <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <div class="form-msg" role="alert"></div>
    <div class="full"><button class="btn btn-primary" type="submit" style="width:100%">${t('Send enquiry', 'إرسال الطلب')}</button></div>
  </form></div></div>`;
}

// [name, label, type, required, extra]
export function fields(lang, list) {
  return list.map(([name, label, type = 'text', req, opts]) => {
    const id = `f-${name}-${Math.random().toString(36).slice(2, 6)}`;
    const full = opts?.full ? ' full' : '';
    if (type === 'select') {
      return `<div class="field${full}"><label for="${id}">${label}</label><select class="input" id="${id}" name="${name}"${req ? ' required' : ''}>${opts.options.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>`;
    }
    if (type === 'textarea') return `<div class="field full"><label for="${id}">${label}</label><textarea class="input" id="${id}" name="${name}"${opts?.placeholder ? ` placeholder="${opts.placeholder}"` : ''}></textarea></div>`;
    const auto = { name: 'name', phone: 'tel', email: 'email' }[name];
    return `<div class="field${full}"><label for="${id}">${label}${req ? ' *' : ''}</label><input class="input" id="${id}" name="${name}" type="${type}"${req ? ' required' : ''}${auto ? ` autocomplete="${auto}"` : ''}${type === 'tel' ? ' dir="ltr" inputmode="tel" placeholder="+971 5x xxx xxxx"' : ''}${opts?.placeholder ? ` placeholder="${opts.placeholder}"` : ''}${type === 'number' ? ' inputmode="numeric" min="0"' : ''}></div>`;
  }).join('\n');
}

export function leadForm(lang, type, list, button) {
  const t = L(lang);
  return `<form class="form" data-lead="${type}" novalidate>
  ${fields(lang, [['name', t('Full name', 'الاسم الكامل'), 'text', true], ['phone', t('WhatsApp number', 'رقم الواتساب'), 'tel', true], ...list])}
  <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
  <div class="form-msg" role="alert"></div>
  <div class="full"><button class="btn btn-primary" type="submit">${button}</button>
  <p class="form-note" style="margin-top:10px">${t('We reply on WhatsApp, usually within the hour, 9 am to 9 pm.', 'نرد على واتساب عادةً خلال ساعة، من 9 صباحاً حتى 9 مساءً.')}</p></div>
</form>`;
}

export function cta(lang, title, text) {
  const t = L(lang);
  return `<div class="cta"><div><h2>${title}</h2><p>${text}</p></div>
  <div class="btns"><a class="btn btn-wa" href="${wa(t('Hi Sakanly', 'مرحباً سكنلي'))}" target="_blank" rel="noopener">${icon.wa} ${t('WhatsApp us', 'راسلنا على واتساب')}</a>
  <a class="btn btn-light" href="tel:${PHONE.replace(/\s/g, '')}" dir="ltr">${PHONE}</a></div></div>`;
}

export function layout(page, lang) {
  const t = L(lang);
  const other = lang === 'ar' ? 'en' : 'ar';
  const path = page.path === '/404' ? '/' : page.path;
  const title = page.title(lang);
  const desc = page.description(lang);
  const canonical = `${SITE}${href(lang, path)}`;
  const navLinks = NAV.map(([p, en, ar]) => `<a href="${href(lang, p)}"${page.path.startsWith(p) ? ' aria-current="page"' : ''}>${t(en, ar)}</a>`).join('');
  const org = {
    '@context': 'https://schema.org', '@type': 'RealEstateAgent', name: 'Sakanly Real Estate', alternateName: ['Sakanly Stay', 'سكنلي للعقارات'],
    legalName: 'Sakanly Stay Vacation Homes Rental L.L.C', url: SITE, logo: `${SITE}/img/logo-navy.png`, telephone: PHONE, email: EMAIL,
    slogan: 'Your home, evolved.',
    address: { '@type': 'PostalAddress', streetAddress: 'Office 301, Warsan Building, Barsha Heights', addressLocality: 'Dubai', addressCountry: 'AE' },
    areaServed: 'Dubai', sameAs: ['https://www.instagram.com/sakanlystay', 'https://www.tiktok.com/@sakanly', 'https://www.linkedin.com/company/sakanlystay'],
  };
  return `<!doctype html>
<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${canonical}">
<link rel="alternate" hreflang="en" href="${SITE}${path}">
<link rel="alternate" hreflang="ar" href="${SITE}/ar${path}">
<link rel="alternate" hreflang="x-default" href="${SITE}${path}">
${page.noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Sakanly Real Estate">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}/img/og.png">
<meta property="og:locale" content="${lang === 'ar' ? 'ar_AE' : 'en_AE'}">
<meta name="theme-color" content="#101e37">
<link rel="icon" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/fonts/${lang === 'ar' ? 'tajawal-arabic-400' : 'inter-latin-400'}-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/site.css">
<script type="application/ld+json">${JSON.stringify(org)}</script>
${page.schema ? `<script type="application/ld+json">${JSON.stringify(page.schema(lang))}</script>` : ''}
</head>
<body>
<a class="hp" href="#main">${t('Skip to content', 'انتقل إلى المحتوى')}</a>
<header class="top"><div class="wrap">
  <a class="logo" href="${href(lang, '/')}" aria-label="Sakanly — ${t('home', 'الرئيسية')}"><img src="/img/logo-white.png" alt="Sakanly" width="120" height="32"></a>
  <nav class="nav" aria-label="${t('Main', 'القائمة الرئيسية')}">${navLinks}<a href="${href(lang, '/contact/')}">${t('Contact', 'تواصل معنا')}</a></nav>
  <div class="top-cta">
    <a class="lang" href="${href(other, path)}" lang="${other}" hreflang="${other}">${lang === 'ar' ? 'EN' : 'العربية'}</a>
    <a class="btn btn-sand btn-sm hide-m" href="${href(lang, '/owners/estimate/')}">${t('List your property', 'اعرض عقارك')}</a>
    <button class="menu-btn" aria-label="${t('Menu', 'القائمة')}" aria-expanded="false">${icon.menu}</button>
  </div>
</div></header>
<main id="main">
${page.body(lang)}
</main>
<footer><div class="wrap">
  <div class="foot">
    <div>
      <a class="logo" href="${href(lang, '/')}"><img src="/img/logo-white.png" alt="Sakanly"></a>
      <p>${t('Your home, evolved.', 'منزلك، بشكل أفضل.')}<br>${t('Holiday homes, shared living, rentals and property management in Dubai.', 'بيوت العطلات والسكن المشترك والإيجارات وإدارة العقارات في دبي.')}</p>
      <div class="social">
        <a href="https://www.instagram.com/sakanlystay" aria-label="Instagram" target="_blank" rel="noopener">${icon.ig}</a>
        <a href="https://www.tiktok.com/@sakanly" aria-label="TikTok" target="_blank" rel="noopener">${icon.tt}</a>
        <a href="https://www.linkedin.com/company/sakanlystay" aria-label="LinkedIn" target="_blank" rel="noopener">${icon.li}</a>
      </div>
    </div>
    <div><h4>${t('Stay with us', 'اسكن معنا')}</h4><ul>
      <li><a href="${href(lang, '/stays/')}">${t('Holiday homes', 'بيوت العطلات')}</a></li>
      <li><a href="${href(lang, '/shared-living/')}">${t('Shared living', 'السكن المشترك')}</a></li>
      <li><a href="${href(lang, '/shared-living/ladies/')}">${t('Ladies-only rooms', 'سكن للسيدات فقط')}</a></li>
      <li><a href="${href(lang, '/rent/')}">${t('Short and long-term rentals', 'إيجار قصير وطويل المدة')}</a></li>
      <li><a href="${href(lang, '/buy/')}">${t('Buy a property', 'شراء عقار')}</a></li>
    </ul></div>
    <div><h4>${t('Owners', 'للملاك')}</h4><ul>
      <li><a href="${href(lang, '/owners/')}">${t('Property management', 'إدارة العقارات')}</a></li>
      <li><a href="${href(lang, '/owners/holiday-homes/')}">${t('Holiday-home management', 'إدارة بيوت العطلات')}</a></li>
      <li><a href="${href(lang, '/owners/estimate/')}">${t('Free rental estimate', 'تقدير مجاني للإيجار')}</a></li>
      <li><a href="https://crm.sakanly.com">${t('Team login', 'دخول الفريق')}</a></li>
    </ul></div>
    <div><h4>${t('Company', 'الشركة')}</h4><ul>
      <li><a href="${href(lang, '/about/')}">${t('About us', 'من نحن')}</a></li>
      <li><a href="${href(lang, '/faq/')}">${t('FAQ', 'الأسئلة الشائعة')}</a></li>
      <li><a href="${href(lang, '/contact/')}">${t('Contact', 'تواصل معنا')}</a></li>
      <li><a href="tel:${PHONE.replace(/\s/g, '')}" dir="ltr">${PHONE}</a></li>
      <li><a href="mailto:${EMAIL}">${EMAIL}</a></li>
    </ul></div>
  </div>
  <div class="legal">
    <span>© ${new Date().getFullYear()} Sakanly Stay Vacation Homes Rental L.L.C · ${t('Trade licence', 'رخصة تجارية')} 1623106 · ${t('Office 301, Warsan Building, Barsha Heights, Dubai', 'مكتب 301، مبنى ورسان، برشا هايتس، دبي')}</span>
    <span><a href="${href(lang, '/house-rules/')}">${t('House rules', 'قواعد السكن')}</a> · <a href="${href(lang, '/privacy/')}">${t('Privacy', 'الخصوصية')}</a> · <a href="${href(lang, '/terms/')}">${t('Terms', 'الشروط')}</a></span>
  </div>
</div></footer>
<a class="wa-float" href="${wa(`${t('Hi Sakanly, I am on your website', 'مرحباً سكنلي، أنا على موقعكم')}${page.waTopic ? ` — ${page.waTopic(lang)}` : ''}`)}" target="_blank" rel="noopener" aria-label="WhatsApp">${icon.wa}</a>
${enquiryModal(lang)}
<script src="/site.js" defer></script>
</body>
</html>`;
}
