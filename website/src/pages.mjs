// website/src/pages.mjs — every page of sakanly.com, English and Arabic side by side
import { L, href, wa, icon, arrow, leadForm, cta, PHONE, EMAIL } from './layout.mjs';

const heroArt = `<svg viewBox="0 0 420 430" fill="none" aria-hidden="true">
  <rect x="40" y="70" width="150" height="330" rx="75" fill="#1b2b4b"/>
  <rect x="60" y="92" width="110" height="160" rx="55" fill="#c9a46a" opacity=".9"/>
  <rect x="210" y="30" width="170" height="370" rx="85" fill="#2a3c60"/>
  <g stroke="#e9d9bd" stroke-width="2" opacity=".55">
    <path d="M240 140h110M240 180h110M240 220h110M240 260h110M240 300h110M240 340h110"/>
    <path d="M295 120v260"/>
  </g>
  <circle cx="330" cy="86" r="22" fill="#c9a46a"/>
  <path d="M0 400h420" stroke="#c9a46a" stroke-width="2"/>
  <rect x="78" y="290" width="74" height="110" rx="37" fill="#101e37" stroke="#c9a46a" stroke-width="2"/>
</svg>`;

const page = (path, def) => ({ path, ...def });
const crumbs = (lang, items) => {
  const t = L(lang);
  return `<div class="crumbs"><a href="${href(lang, '/')}">${t('Home', 'الرئيسية')}</a>${items.map(([p, label]) => ` / ${p ? `<a href="${href(lang, p)}">${label}</a>` : label}`).join('')}</div>`;
};
const pageHero = (lang, { crumbs: c, eyebrow, title, lead, buttons = '' }) => `<section class="page-hero"><div class="wrap">
  ${c || ''}<div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="lead">${lead}</p>${buttons ? `<div class="btns" style="margin-top:24px">${buttons}</div>` : ''}
</div></section>`;
const waBtn = (lang, text, label) => `<a class="btn btn-wa" href="${wa(text)}" target="_blank" rel="noopener">${icon.wa} ${label || L(lang)('WhatsApp us', 'راسلنا على واتساب')}</a>`;
const features = (items, cls = 'g3') => `<div class="grid ${cls}">${items.map(([h, p], i) => `<div class="feature"><div class="num">${i + 1}</div><div><h3>${h}</h3><p>${p}</p></div></div>`).join('')}</div>`;
const ticks = list => `<ul class="ticks">${list.map(x => `<li>${x}</li>`).join('')}</ul>`;
const roomsBlock = (lang, { building = '', occupancy = '', filters = true, limit } = {}) => {
  const t = L(lang);
  const chips = filters && !occupancy ? `<div class="filters" data-room-filters role="group" aria-label="${t('Filter', 'تصفية')}">
    <button class="chip" data-occ="" aria-pressed="true">${t('All rooms', 'كل الغرف')}</button>
    <button class="chip" data-occ="LADIES" aria-pressed="false">${t('Ladies only', 'للسيدات فقط')}</button>
    <button class="chip" data-occ="MIX" aria-pressed="false">${t('Mixed', 'مختلط')}</button></div>` : '';
  return `<div>${chips}<div class="grid g3" data-rooms data-building="${building}" data-occupancy="${occupancy}"${limit ? ` data-limit="${limit}"` : ''}></div></div>`;
};
const faqList = items => items.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('');

// ─── FAQ content, shared by the FAQ page and its schema ───
const FAQ = lang => {
  const t = L(lang);
  return [
    [t('What is included in the rent of a shared room?', 'ماذا يشمل إيجار الغرفة في السكن المشترك؟'), t('Electricity, water, air conditioning, Wi-Fi and cleaning of the shared areas are included. The apartment is furnished, so you only bring your suitcase.', 'يشمل الإيجار الكهرباء والمياه والتكييف والإنترنت وتنظيف المرافق المشتركة. الشقة مفروشة بالكامل، فقط أحضر حقيبتك.')],
    [t('Do you have ladies-only apartments?', 'هل لديكم شقق للسيدات فقط؟'), t('Yes. Each apartment is either ladies-only or mixed, and every listing shows which. In mixed apartments everyone has their own room.', 'نعم. كل شقة إما للسيدات فقط أو مختلطة، وتظهر هذه المعلومة على كل غرفة. وفي الشقق المختلطة لكل ساكن غرفته الخاصة.')],
    [t('How much is the deposit?', 'كم قيمة التأمين؟'), t('The security deposit is shown on every room. It is refundable within 14 days after you move out and hand back the keys, less any unpaid rent or damage.', 'قيمة التأمين مكتوبة على كل غرفة، ويُسترد خلال 14 يوماً من الإخلاء وتسليم المفاتيح، بعد خصم أي إيجار غير مدفوع أو أضرار.')],
    [t('What is the minimum stay?', 'ما أقل مدة للسكن؟'), t('Shared rooms are rented monthly. Holiday homes can be booked by the night, the week or the month.', 'تُؤجر الغرف المشتركة شهرياً، أما بيوت العطلات فيمكن حجزها بالليلة أو الأسبوع أو الشهر.')],
    [t('How do I give notice?', 'كيف أبلغ بالإخلاء؟'), t('Give 30 days’ notice by WhatsApp or email. Your contract states the exact notice period.', 'أرسل إشعاراً قبل 30 يوماً عبر واتساب أو البريد الإلكتروني، ومدة الإشعار مذكورة في عقدك.')],
    [t('How do I pay?', 'كيف أدفع؟'), t('By bank transfer, card link, cheque or cash against a receipt. Rent is paid in advance at the start of each month.', 'بالتحويل البنكي أو رابط دفع بالبطاقة أو شيك أو نقداً مقابل إيصال. يُدفع الإيجار مقدماً في بداية كل شهر.')],
    [t('Do I get a contract?', 'هل أحصل على عقد؟'), t('Yes. Every tenant signs a sub-lease agreement in Arabic and English. You can sign it on your phone.', 'نعم. يوقّع كل مستأجر عقد إيجار من الباطن بالعربية والإنجليزية، ويمكنك توقيعه من هاتفك.')],
    [t('Can I view the room before moving in?', 'هل يمكنني معاينة الغرفة قبل السكن؟'), t('Of course. Book a viewing from any listing or message us on WhatsApp and we will arrange a time.', 'بالتأكيد. احجز معاينة من أي غرفة أو راسلنا على واتساب لنحدد موعداً.')],
    [t('Can I book a holiday home on Airbnb or Booking.com?', 'هل يمكن حجز بيت العطلات عبر Airbnb أو Booking.com؟'), t('Yes, our homes are listed there too. Booking direct with us on WhatsApp is often simpler for longer stays.', 'نعم، بيوتنا معروضة هناك أيضاً. والحجز المباشر معنا عبر واتساب غالباً أسهل للإقامات الطويلة.')],
  ];
};

export const pages = [
  // ───────────────────────── Home
  page('/', {
    priority: 1.0,
    title: lang => L(lang)('Sakanly — Holiday homes, shared living and rentals in Dubai', 'سكنلي — بيوت العطلات والسكن المشترك والإيجارات في دبي'),
    description: lang => L(lang)('Furnished holiday homes, private rooms and ladies-only shared living with bills included, short and long-term rentals, and property management for owners in Dubai.', 'بيوت عطلات مفروشة، وغرف خاصة وسكن مشترك للسيدات شامل الفواتير، وإيجارات قصيرة وطويلة المدة، وإدارة عقارات للملاك في دبي.'),
    body: lang => {
      const t = L(lang);
      return `
<section class="hero"><div class="wrap">
  <div>
    <div class="eyebrow">${t('Sakanly Real Estate · Dubai', 'سكنلي للعقارات · دبي')}</div>
    <h1>${t('Your home, <em>evolved.</em>', 'منزلك، <em>بشكل أفضل.</em>')}</h1>
    <p class="lead">${t('Furnished homes and rooms across Dubai, ready to move into, with everything sorted. For a night, a month or a year.', 'بيوت وغرف مفروشة في أنحاء دبي، جاهزة للسكن وكل شيء مرتّب. لليلة أو شهر أو سنة.')}</p>
    <div class="finder" role="navigation" aria-label="${t('What are you looking for?', 'عن ماذا تبحث؟')}">
      <a href="${href(lang, '/stays/')}"><b>${t('A holiday stay', 'إقامة عطلة')}</b><span>${t('Nights and weeks', 'بالليلة والأسبوع')}</span></a>
      <a href="${href(lang, '/shared-living/')}"><b>${t('A room', 'غرفة')}</b><span>${t('Bills included', 'شامل الفواتير')}</span></a>
      <a href="${href(lang, '/rent/')}"><b>${t('A home to rent', 'منزل للإيجار')}</b><span>${t('1–12 months', 'من شهر إلى سنة')}</span></a>
    </div>
    <div class="stat-row" style="margin-top:28px" data-live-wrap>
      <div><b data-live-count>—</b><span>${t('rooms free right now', 'غرفة متاحة الآن')}</span></div>
      <div><b>${t('AR · EN', 'عربي · EN')}</b><span>${t('team on WhatsApp', 'فريق على واتساب')}</span></div>
    </div>
  </div>
  <div class="hero-art">${heroArt}</div>
</div></section>

<section class="block"><div class="wrap">
  <div class="head"><div><div class="eyebrow">${t('What we do', 'خدماتنا')}</div><h2>${t('One company for every way you live in Dubai', 'شركة واحدة لكل طرق السكن في دبي')}</h2></div></div>
  <div class="grid g3">
    <a class="card service" href="${href(lang, '/stays/')}"><div class="ico">${icon.stay}</div><h3>${t('Holiday homes', 'بيوت العطلات')}</h3><p>${t('Furnished apartments by the night, week or month, in Business Bay and beyond. Book direct or on Airbnb and Booking.com.', 'شقق مفروشة بالليلة أو الأسبوع أو الشهر في الخليج التجاري وغيرها. احجز معنا مباشرة أو عبر Airbnb وBooking.com.')}</p><span class="go">${t('See homes', 'شاهد البيوت')} ${arrow}</span></a>
    <a class="card service" href="${href(lang, '/shared-living/')}"><div class="ico">${icon.room}</div><h3>${t('Shared living', 'السكن المشترك')}</h3><p>${t('Private rooms and bed spaces in Barsha Heights, ladies-only or mixed, with bills, Wi-Fi and cleaning included.', 'غرف خاصة وأسرّة في برشا هايتس، للسيدات فقط أو مختلطة، شاملة الفواتير والإنترنت والتنظيف.')}</p><span class="go">${t('See free rooms', 'شاهد الغرف المتاحة')} ${arrow}</span></a>
    <a class="card service" href="${href(lang, '/rent/')}"><div class="ico">${icon.key}</div><h3>${t('Rent a home', 'استئجار منزل')}</h3><p>${t('Short-term (1–11 months) and yearly rentals. Tell us what you need and our leasing team finds it.', 'إيجار قصير المدة (من شهر إلى 11 شهراً) أو سنوي. أخبرنا بما تحتاجه وفريق التأجير يجده لك.')}</p><span class="go">${t('Start a search', 'ابدأ البحث')} ${arrow}</span></a>
    <a class="card service" href="${href(lang, '/owners/')}"><div class="ico">${icon.owner}</div><h3>${t('For owners', 'للملاك')}</h3><p>${t('Guaranteed rent or full management, including holiday-home operation. Clear monthly statements.', 'إيجار مضمون أو إدارة كاملة، بما فيها تشغيل بيوت العطلات، مع كشوف شهرية واضحة.')}</p><span class="go">${t('Get an estimate', 'احصل على تقدير')} ${arrow}</span></a>
    <a class="card service" href="${href(lang, '/buy/')}"><div class="ico">${icon.buy}</div><h3>${t('Buy', 'شراء')}</h3><p>${t('Ready apartments on the secondary market, for living in or for rental income.', 'شقق جاهزة في السوق الثانوي، للسكن أو للاستثمار والدخل الإيجاري.')}</p><span class="go">${t('Talk to us', 'تحدث معنا')} ${arrow}</span></a>
    <a class="card service" href="${href(lang, '/shared-living/ladies/')}"><div class="ico">${icon.room}</div><h3>${t('Ladies-only rooms', 'سكن للسيدات فقط')}</h3><p>${t('Apartments only for women, in safe, well-connected buildings, with the same bills-included price.', 'شقق مخصصة للسيدات فقط في مبانٍ آمنة وقريبة من كل شيء، وبنفس السعر الشامل للفواتير.')}</p><span class="go">${t('See ladies-only rooms', 'شاهد غرف السيدات')} ${arrow}</span></a>
  </div>
</div></section>

<section class="block tint"><div class="wrap">
  <div class="head"><div><div class="eyebrow">${t('Available now', 'متاح الآن')}</div><h2>${t('Rooms you can move into', 'غرف جاهزة للسكن')}</h2><p class="lead">${t('Live from our system, with real prices. What you see is free.', 'مباشرة من نظامنا وبأسعار حقيقية. كل ما تراه متاح فعلاً.')}</p></div>
  <a class="btn" href="${href(lang, '/shared-living/')}">${t('All rooms', 'كل الغرف')} ${arrow}</a></div>
  ${roomsBlock(lang, { filters: false, limit: 6 })}
</div></section>

<section class="block"><div class="wrap split">
  <div><div class="eyebrow">${t('Why Sakanly', 'لماذا سكنلي')}</div><h2>${t('Renting in Dubai, without the hassle', 'الإيجار في دبي بدون تعب')}</h2>
  <p class="lead">${t('We handle the parts that usually go wrong, so you can just live there.', 'نتولى الأمور التي عادةً ما تسبب المتاعب، لتسكن براحة.')}</p></div>
  <div>${features([
    [t('One price, everything in', 'سعر واحد شامل كل شيء'), t('Bills, Wi-Fi and cleaning of shared areas are in the rent. No surprise DEWA bills.', 'الفواتير والإنترنت وتنظيف المرافق المشتركة ضمن الإيجار. لا مفاجآت في فواتير ديوا.')],
    [t('A real contract', 'عقد حقيقي'), t('Every tenant gets a bilingual contract you can sign from your phone.', 'كل مستأجر يحصل على عقد بالعربية والإنجليزية يمكن توقيعه من الهاتف.')],
    [t('A team that answers', 'فريق يرد عليك'), t('Arabic and English on WhatsApp, and maintenance handled for you.', 'فريق يتحدث العربية والإنجليزية على واتساب، ونتولى الصيانة عنك.')],
  ], 'g1')}</div>
</div></section>

<section class="block dark"><div class="wrap split">
  <div><div class="eyebrow">${t('For property owners', 'لملاك العقارات')}</div><h2>${t('Your apartment, earning more, with zero work', 'شقتك تحقق دخلاً أكبر بدون أي مجهود منك')}</h2>
  <p class="lead">${t('We lease your apartment for a guaranteed yearly rent, or run it for you as a holiday home. You get paid; we handle tenants, guests, cleaning and maintenance.', 'نستأجر شقتك بإيجار سنوي مضمون، أو نديرها لك كبيت عطلات. أنت تستلم دخلك، ونحن نتولى المستأجرين والضيوف والتنظيف والصيانة.')}</p>
  <div class="btns"><a class="btn btn-sand" href="${href(lang, '/owners/estimate/')}">${t('Get a free rental estimate', 'احصل على تقدير مجاني للإيجار')}</a><a class="btn btn-light" href="${href(lang, '/owners/')}">${t('How it works', 'كيف نعمل')}</a></div></div>
  <div>${ticks([t('Guaranteed rent, paid by cheques', 'إيجار مضمون يُدفع بشيكات'), t('Or management for a share of income', 'أو إدارة مقابل نسبة من الدخل'), t('Licensed holiday-home operator in Dubai', 'مشغّل مرخص لبيوت العطلات في دبي'), t('Monthly statement for every unit', 'كشف شهري لكل وحدة'), t('Furnishing, cleaning and maintenance handled', 'نتولى الفرش والتنظيف والصيانة')])}</div>
</div></section>

<section class="block"><div class="wrap">${cta(lang, t('Not sure where to start?', 'لا تعرف من أين تبدأ؟'), t('Tell us what you need on WhatsApp. A real person replies.', 'أخبرنا بما تحتاجه على واتساب، وسيرد عليك شخص حقيقي.'))}</div></section>`;
    },
  }),

  // ───────────────────────── Stays
  page('/stays/', {
    priority: 0.9,
    title: lang => L(lang)('Holiday homes in Dubai — book direct | Sakanly', 'بيوت عطلات في دبي — احجز مباشرة | سكنلي'),
    description: lang => L(lang)('Furnished holiday apartments in Dubai by the night, week or month. Book direct on WhatsApp or through Airbnb and Booking.com.', 'شقق عطلات مفروشة في دبي بالليلة أو الأسبوع أو الشهر. احجز مباشرة عبر واتساب أو من خلال Airbnb وBooking.com.'),
    waTopic: lang => L(lang)('holiday homes', 'بيوت العطلات'),
    body: lang => {
      const t = L(lang);
      return `${pageHero(lang, { crumbs: crumbs(lang, [[null, t('Holiday homes', 'بيوت العطلات')]]), eyebrow: t('Holiday homes', 'بيوت العطلات'), title: t('Stay like you live here', 'أقم وكأنك من سكان المدينة'), lead: t('Furnished apartments with a kitchen, fast Wi-Fi and fresh linen. Book direct with us, or on Airbnb and Booking.com.', 'شقق مفروشة بمطبخ وإنترنت سريع ومفارش نظيفة. احجز معنا مباشرة أو عبر Airbnb وBooking.com.'), buttons: waBtn(lang, t('Hi Sakanly, I want to book a holiday home. My dates are: ', 'مرحباً سكنلي، أريد حجز بيت عطلات. تواريخي: '), t('Send us your dates', 'أرسل لنا تواريخك')) })}
<section class="block"><div class="wrap">
  <div class="head"><div><h2>${t('Our homes', 'بيوتنا')}</h2><p class="lead">${t('Prices are a starting rate per night; send your dates for an exact quote. Longer stays get better rates.', 'الأسعار تبدأ من المبلغ المذكور لليلة؛ أرسل تواريخك لعرض سعر دقيق. الإقامات الأطول بأسعار أفضل.')}</p></div></div>
  <div class="grid g3" data-homes></div>
</div></section>
<section class="block tint"><div class="wrap">
  <h2>${t('Booking direct', 'الحجز المباشر')}</h2>
  ${features([[t('Send your dates', 'أرسل تواريخك'), t('Use the form or WhatsApp. We confirm availability and the total price.', 'عبر النموذج أو واتساب، ونؤكد التوفر والسعر الإجمالي.')], [t('Confirm and pay', 'أكد وادفع'), t('Pay by card link or bank transfer to secure your dates.', 'ادفع برابط بطاقة أو تحويل بنكي لتأكيد حجزك.')], [t('Check in', 'تسجيل الدخول'), t('We send check-in details and stay one message away during your stay.', 'نرسل لك تفاصيل الدخول ونبقى على تواصل طوال إقامتك.')]])}
</div></section>
<section class="block"><div class="wrap">${cta(lang, t('Planning a longer stay?', 'تخطط لإقامة أطول؟'), t('Monthly stays come with a lower rate. Ask us for a quote.', 'الإقامة الشهرية بسعر أقل. اطلب عرض سعر.'))}</div></section>`;
    },
  }),

  // ───────────────────────── Shared living
  page('/shared-living/', {
    priority: 0.9,
    title: lang => L(lang)('Rooms for rent in Barsha Heights, bills included | Sakanly', 'غرف للإيجار في برشا هايتس شاملة الفواتير | سكنلي'),
    description: lang => L(lang)('Private rooms and bed spaces in Barsha Heights (TECOM), ladies-only or mixed. Furnished, with electricity, water, Wi-Fi and cleaning included. See live prices.', 'غرف خاصة وأسرّة في برشا هايتس (تيكوم)، للسيدات فقط أو مختلطة. مفروشة وشاملة الكهرباء والمياه والإنترنت والتنظيف. شاهد الأسعار المباشرة.'),
    waTopic: lang => L(lang)('shared living', 'السكن المشترك'),
    body: lang => {
      const t = L(lang);
      return `${pageHero(lang, { crumbs: crumbs(lang, [[null, t('Shared living', 'السكن المشترك')]]), eyebrow: t('Shared living', 'السكن المشترك'), title: t('A room of your own, everything included', 'غرفتك الخاصة، وكل شيء مشمول'), lead: t('Furnished private rooms and bed spaces in Barsha Heights. One monthly price covers bills, Wi-Fi and cleaning of shared areas.', 'غرف خاصة وأسرّة مفروشة في برشا هايتس. سعر شهري واحد يشمل الفواتير والإنترنت وتنظيف المرافق المشتركة.') })}
<section class="block"><div class="wrap">
  <div class="head"><div><h2>${t('Free now', 'المتاح الآن')} · <span data-room-count>…</span></h2><p class="lead">${t('Live availability and real prices. Book a viewing in two taps.', 'توفر مباشر وأسعار حقيقية. احجز معاينة بضغطتين.')}</p></div>
  <div class="btns"><a class="btn btn-sm" href="${href(lang, '/shared-living/al-fahd-2/')}">Al Fahd 2</a><a class="btn btn-sm" href="${href(lang, '/shared-living/sheikha-noura/')}">Sheikha Noura</a></div></div>
  ${roomsBlock(lang)}
</div></section>
<section class="block tint"><div class="wrap split">
  <div><h2>${t('What every room includes', 'ماذا تشمل كل غرفة')}</h2>${ticks([t('Furnished room with bed, wardrobe and AC', 'غرفة مفروشة بسرير وخزانة وتكييف'), t('Electricity, water and air conditioning', 'الكهرباء والمياه والتكييف'), t('High-speed Wi-Fi', 'إنترنت سريع'), t('Cleaning of kitchen, bathrooms and living areas', 'تنظيف المطبخ ودورات المياه وأماكن المعيشة'), t('Maintenance handled by our team', 'صيانة يتولاها فريقنا'), t('A bilingual contract you can sign on your phone', 'عقد بالعربية والإنجليزية يمكن توقيعه من هاتفك')])}</div>
  <div><h2>${t('Ladies-only or mixed', 'للسيدات فقط أو مختلط')}</h2><p class="lead">${t('Every apartment is clearly one or the other, so you always know who you will live with. In mixed apartments each person has their own room.', 'كل شقة واضحة إما للسيدات فقط أو مختلطة، لتعرف دائماً مع من ستسكن. وفي الشقق المختلطة لكل شخص غرفته الخاصة.')}</p>
  <a class="btn" href="${href(lang, '/shared-living/ladies/')}">${t('Ladies-only rooms', 'غرف السيدات فقط')} ${arrow}</a> <a class="btn" href="${href(lang, '/house-rules/')}" style="margin-top:8px">${t('House rules', 'قواعد السكن')}</a></div>
</div></section>
<section class="block"><div class="wrap">${cta(lang, t('Nothing that fits yet?', 'لا يوجد ما يناسبك حالياً؟'), t('Rooms free up every week. Tell us your budget and date and we will message you first.', 'تتوفر غرف كل أسبوع. أخبرنا بميزانيتك وموعدك وسنراسلك أولاً.'))}</div></section>`;
    },
  }),

  page('/shared-living/ladies/', {
    priority: 0.8,
    title: lang => L(lang)('Ladies-only rooms in Dubai, bills included | Sakanly', 'سكن بنات في دبي شامل الفواتير | سكنلي'),
    description: lang => L(lang)('Private rooms in ladies-only apartments in Barsha Heights, Dubai. Furnished, bills, Wi-Fi and cleaning included. See what is free now.', 'غرف خاصة في شقق للسيدات فقط في برشا هايتس، دبي. مفروشة وشاملة الفواتير والإنترنت والتنظيف. شاهدي المتاح الآن.'),
    waTopic: lang => L(lang)('ladies-only rooms', 'سكن السيدات'),
    body: lang => {
      const t = L(lang);
      return `${pageHero(lang, { crumbs: crumbs(lang, [['/shared-living/', t('Shared living', 'السكن المشترك')], [null, t('Ladies only', 'للسيدات فقط')]]), eyebrow: t('Ladies only', 'للسيدات فقط'), title: t('Ladies-only apartments', 'شقق للسيدات فقط'), lead: t('Private rooms in apartments only for women. Male tenants and male overnight guests are not allowed. Bills, Wi-Fi and cleaning included.', 'غرف خاصة في شقق مخصصة للسيدات فقط، ولا يُسمح بسكن الرجال أو مبيتهم. شاملة الفواتير والإنترنت والتنظيف.') })}
<section class="block"><div class="wrap">
  <div class="head"><div><h2>${t('Free now', 'المتاح الآن')} · <span data-room-count>…</span></h2></div></div>
  ${roomsBlock(lang, { occupancy: 'LADIES' })}
</div></section>
<section class="block"><div class="wrap">${cta(lang, t('Want to see the apartment first?', 'تريدين رؤية الشقة أولاً؟'), t('Book a viewing with our team. We reply on WhatsApp.', 'احجزي موعد معاينة مع فريقنا، ونرد على واتساب.'))}</div></section>`;
    },
  }),

  ...[['al-fahd-2', 'Al Fahd 2', 'الفهد 2'], ['sheikha-noura', 'Sheikha Noura', 'الشيخة نورة']].map(([slug, en, ar]) => page(`/shared-living/${slug}/`, {
    priority: 0.7,
    title: lang => L(lang)(`Rooms for rent in ${en}, Barsha Heights | Sakanly`, `غرف للإيجار في مبنى ${ar}، برشا هايتس | سكنلي`),
    description: lang => L(lang)(`Private rooms and bed spaces in ${en}, Barsha Heights, Dubai. Bills, Wi-Fi and cleaning included. Live prices.`, `غرف خاصة وأسرّة في مبنى ${ar}، برشا هايتس، دبي. شاملة الفواتير والإنترنت والتنظيف. أسعار مباشرة.`),
    waTopic: () => en,
    body: lang => {
      const t = L(lang);
      return `${pageHero(lang, { crumbs: crumbs(lang, [['/shared-living/', t('Shared living', 'السكن المشترك')], [null, t(en, ar)]]), eyebrow: t('Barsha Heights', 'برشا هايتس'), title: t(en, `مبنى ${ar}`), lead: t(`Furnished rooms in ${en}, Barsha Heights. Bills, Wi-Fi and cleaning included in one monthly price.`, `غرف مفروشة في مبنى ${ar} ببرشا هايتس. الفواتير والإنترنت والتنظيف ضمن سعر شهري واحد.`) })}
<section class="block"><div class="wrap">
  <div class="head"><div><h2>${t('Free now in this building', 'المتاح الآن في هذا المبنى')} · <span data-room-count>…</span></h2></div></div>
  ${roomsBlock(lang, { building: slug })}
</div></section>
<section class="block"><div class="wrap">${cta(lang, t('Want to see it?', 'تريد رؤيته؟'), t('We arrange viewings every day. Message us on WhatsApp.', 'نرتب المعاينات يومياً. راسلنا على واتساب.'))}</div></section>`;
    },
  })),

  // ───────────────────────── Rent a home
  page('/rent/', {
    priority: 0.8,
    title: lang => L(lang)('Rent an apartment in Dubai — monthly or yearly | Sakanly', 'استأجر شقة في دبي — شهرياً أو سنوياً | سكنلي'),
    description: lang => L(lang)('Short-term (1–11 months) and yearly apartment rentals in Dubai. Tell our leasing team what you need and get matching options on WhatsApp.', 'إيجار شقق في دبي لمدة قصيرة (1–11 شهراً) أو سنوياً. أخبر فريق التأجير بما تحتاجه واستلم خيارات مناسبة على واتساب.'),
    waTopic: lang => L(lang)('renting a home', 'استئجار منزل'),
    body: lang => {
      const t = L(lang);
      return `${pageHero(lang, { crumbs: crumbs(lang, [[null, t('Rent a home', 'استئجار منزل')]]), eyebrow: t('Leasing', 'التأجير'), title: t('Find your next home, monthly or yearly', 'ابحث عن منزلك القادم، شهرياً أو سنوياً'), lead: t('Studios to family apartments across Dubai. Tell us your budget and area; our leasing team sends you options that fit.', 'من الاستوديو إلى الشقق العائلية في أنحاء دبي. أخبرنا بميزانيتك والمنطقة، وفريق التأجير يرسل لك خيارات مناسبة.') })}
<section class="block"><div class="wrap split">
  <div>
    <div class="grid g2" style="margin-bottom:28px">
      <div class="card"><h3>${t('Short term · 1–11 months', 'قصير المدة · 1–11 شهراً')}</h3><p class="muted">${t('Furnished apartments paid monthly. Ideal when you are new in Dubai, between homes, or here for a project.', 'شقق مفروشة تُدفع شهرياً. مثالية إن كنت جديداً في دبي أو بين سكنين أو هنا لمشروع.')}</p></div>
      <div class="card"><h3>${t('Yearly', 'سنوي')}</h3><p class="muted">${t('Furnished or unfurnished, paid by cheques. We negotiate the rent and number of cheques with the landlord for you.', 'مفروشة أو غير مفروشة، بالدفع بشيكات. نتفاوض مع المالك على الإيجار وعدد الشيكات نيابة عنك.')}</p></div>
    </div>
    <h2>${t('What you need', 'ما تحتاجه')}</h2>
    ${ticks([t('Emirates ID or passport with visa', 'الهوية الإماراتية أو جواز السفر مع التأشيرة'), t('Security deposit, usually 5% of yearly rent unfurnished or 10% furnished', 'مبلغ تأمين، عادةً 5% من الإيجار السنوي لغير المفروش أو 10% للمفروش'), t('Agency fee, usually 5% of yearly rent (one month for short term)', 'عمولة الوكالة، عادةً 5% من الإيجار السنوي (أو شهر للإيجار القصير)'), t('Post-dated cheques for yearly contracts', 'شيكات مؤجلة للعقود السنوية')])}
  </div>
  <div class="card form-card"><h2 style="font-size:26px">${t('Tell us what you are looking for', 'أخبرنا عن ما تبحث عنه')}</h2>
  ${leadForm(lang, 'rent', [
    ['term', t('Rental type', 'نوع الإيجار'), 'select', false, { options: [['monthly', t('Short term (1–11 months)', 'قصير المدة (1–11 شهراً)')], ['yearly', t('Yearly', 'سنوي')]] }],
    ['unitType', t('Size', 'المساحة'), 'select', false, { options: [['Studio', t('Studio', 'استوديو')], ['1BR', t('1 bedroom', 'غرفة وصالة')], ['2BR', t('2 bedrooms', 'غرفتان وصالة')], ['3BR+', t('3+ bedrooms', '3 غرف أو أكثر')]] }],
    ['area', t('Preferred area', 'المنطقة المفضلة'), 'text', false, { placeholder: t('e.g. Business Bay, JVC, Marina', 'مثال: الخليج التجاري، قرية جميرا، المارينا') }],
    ['budget', t('Budget (AED)', 'الميزانية (درهم)'), 'number', false, { placeholder: t('Per month or per year', 'شهرياً أو سنوياً') }],
    ['moveIn', t('Move-in date', 'تاريخ الانتقال'), 'date'],
    ['email', t('Email (optional)', 'البريد الإلكتروني (اختياري)'), 'email'],
    ['message', t('Anything else?', 'ملاحظات أخرى؟'), 'textarea'],
  ], t('Send my request', 'أرسل طلبي'))}</div>
</div></section>`;
    },
  }),

  // ───────────────────────── Owners
  page('/owners/', {
    priority: 0.9,
    title: lang => L(lang)('Property management and guaranteed rent in Dubai | Sakanly', 'إدارة العقارات والإيجار المضمون في دبي | سكنلي'),
    description: lang => L(lang)('Lease your Dubai apartment to Sakanly for a guaranteed yearly rent, or let us manage it as a holiday home. Free rental estimate within 24 hours.', 'أجّر شقتك في دبي لسكنلي بإيجار سنوي مضمون، أو دعنا نديرها كبيت عطلات. تقدير مجاني للإيجار خلال 24 ساعة.'),
    waTopic: lang => L(lang)('property management', 'إدارة عقار'),
    body: lang => {
      const t = L(lang);
      return `${pageHero(lang, { crumbs: crumbs(lang, [[null, t('For owners', 'للملاك')]]), eyebrow: t('For owners', 'للملاك'), title: t('Two ways to earn from your apartment', 'طريقتان لتحقيق دخل من شقتك'), lead: t('Choose a fixed rent with no risk, or full management to earn more. Either way, we do the work.', 'اختر إيجاراً ثابتاً بلا مخاطرة، أو إدارة كاملة لدخل أعلى. في الحالتين، نحن نقوم بالعمل.'), buttons: `<a class="btn btn-sand" href="${href(lang, '/owners/estimate/')}">${t('Get a free rental estimate', 'احصل على تقدير مجاني')}</a>` })}
<section class="block"><div class="wrap grid g2">
  <div class="card" style="padding:34px"><div class="eyebrow">${t('Option 1', 'الخيار 1')}</div><h2 style="font-size:30px">${t('Guaranteed rent', 'إيجار مضمون')}</h2><p class="lead">${t('Sakanly leases your apartment for a year and pays you rent by cheques, whether it is occupied or not.', 'تستأجر سكنلي شقتك لمدة سنة وتدفع لك الإيجار بشيكات، سواء كانت مسكونة أم لا.')}</p>
  ${ticks([t('Fixed income, no vacancy risk', 'دخل ثابت بلا مخاطرة الشواغر'), t('No tenants or guests to deal with', 'لا تتعامل مع مستأجرين أو ضيوف'), t('We maintain the apartment during the lease', 'نحافظ على الشقة طوال مدة العقد'), t('Returned in good condition at the end', 'تُسلّم بحالة جيدة في النهاية')])}</div>
  <div class="card" style="padding:34px"><div class="eyebrow">${t('Option 2', 'الخيار 2')}</div><h2 style="font-size:30px">${t('Full management', 'إدارة كاملة')}</h2><p class="lead">${t('We run your apartment as a holiday home or monthly rental and keep a share of the income. You get the rest, with a statement every month.', 'ندير شقتك كبيت عطلات أو إيجار شهري مقابل نسبة من الدخل، وتحصل أنت على الباقي مع كشف حساب شهري.')}</p>
  ${ticks([t('Higher income potential', 'إمكانية دخل أعلى'), t('Listing on Airbnb, Booking.com and our own site', 'عرض على Airbnb وBooking.com وموقعنا'), t('Pricing, guests, cleaning and maintenance handled', 'التسعير والضيوف والتنظيف والصيانة علينا'), t('Monthly owner statement', 'كشف شهري للمالك')])}
  <a class="btn" href="${href(lang, '/owners/holiday-homes/')}">${t('Holiday-home management', 'إدارة بيوت العطلات')} ${arrow}</a></div>
</div></section>
<section class="block tint"><div class="wrap"><h2>${t('How it works', 'كيف نعمل')}</h2>
  ${features([[t('Tell us about the unit', 'أخبرنا عن الوحدة'), t('Building, size and whether it is furnished. Takes two minutes.', 'المبنى والمساحة وهل هي مفروشة. يستغرق دقيقتين.')], [t('Get your estimate', 'استلم التقدير'), t('We reply within 24 hours with the rent we can guarantee and what management could earn.', 'نرد خلال 24 ساعة بالإيجار الذي نضمنه وما يمكن أن تحققه الإدارة.')], [t('Sign and relax', 'وقّع واسترح'), t('We sign the agreement, prepare the apartment and start paying you.', 'نوقّع الاتفاقية ونجهّز الشقة ونبدأ الدفع لك.')]])}
</div></section>
<section class="block"><div class="wrap">${cta(lang, t('What could your apartment earn?', 'كم يمكن أن تحقق شقتك؟'), t('Get a free estimate within 24 hours.', 'احصل على تقدير مجاني خلال 24 ساعة.'))}</div></section>`;
    },
  }),

  page('/owners/holiday-homes/', {
    priority: 0.7,
    title: lang => L(lang)('Holiday home management in Dubai | Sakanly', 'إدارة بيوت العطلات في دبي | سكنلي'),
    description: lang => L(lang)('Licensed holiday-home management in Dubai: listing on Airbnb and Booking.com, pricing, guests, cleaning, maintenance and monthly payouts.', 'إدارة مرخصة لبيوت العطلات في دبي: العرض على Airbnb وBooking.com، والتسعير، والضيوف، والتنظيف، والصيانة، ودفعات شهرية.'),
    waTopic: lang => L(lang)('holiday-home management', 'إدارة بيت عطلات'),
    body: lang => {
      const t = L(lang);
      return `${pageHero(lang, { crumbs: crumbs(lang, [['/owners/', t('For owners', 'للملاك')], [null, t('Holiday-home management', 'إدارة بيوت العطلات')]]), eyebrow: t('Holiday-home management', 'إدارة بيوت العطلات'), title: t('We run your holiday home, end to end', 'ندير بيت العطلات الخاص بك من البداية للنهاية'), lead: t('Sakanly is a licensed vacation-homes rental company in Dubai. We take care of everything from the listing to the last guest checkout.', 'سكنلي شركة مرخصة لتأجير بيوت العطلات في دبي. نتولى كل شيء من عرض الوحدة حتى مغادرة آخر ضيف.'), buttons: `<a class="btn btn-sand" href="${href(lang, '/owners/estimate/')}">${t('Get a free estimate', 'احصل على تقدير مجاني')}</a>` })}
<section class="block"><div class="wrap">${features([
  [t('Licence and setup', 'الترخيص والتجهيز'), t('We register the unit for holiday-home use and get it ready: furnishing advice, photos and amenities.', 'نسجل الوحدة كبيت عطلات ونجهزها: نصائح الفرش والتصوير والمستلزمات.')],
  [t('Listing and pricing', 'العرض والتسعير'), t('Listed on Airbnb, Booking.com and sakanly.com, with prices adjusted to demand.', 'عرض على Airbnb وBooking.com وsakanly.com بأسعار تتغير حسب الطلب.')],
  [t('Guests', 'الضيوف'), t('Bookings, check-in, questions and reviews, in Arabic and English.', 'الحجوزات وتسجيل الدخول والاستفسارات والتقييمات بالعربية والإنجليزية.')],
  [t('Cleaning and linen', 'التنظيف والمفارش'), t('Professional cleaning and fresh linen after every stay.', 'تنظيف احترافي ومفارش نظيفة بعد كل إقامة.')],
  [t('Maintenance', 'الصيانة'), t('Repairs handled quickly so the calendar stays open.', 'إصلاح سريع للأعطال ليبقى التقويم متاحاً.')],
  [t('Monthly payout', 'دفعة شهرية'), t('A clear statement and your payout every month.', 'كشف واضح ودفعتك كل شهر.')],
])}</div></section>
<section class="block"><div class="wrap">${cta(lang, t('Thinking of turning your apartment into a holiday home?', 'تفكر في تحويل شقتك إلى بيت عطلات؟'), t('Ask us what it could earn.', 'اسألنا كم يمكن أن تحقق.'))}</div></section>`;
    },
  }),

  page('/owners/estimate/', {
    priority: 0.8,
    title: lang => L(lang)('Free rental estimate for your Dubai apartment | Sakanly', 'تقدير مجاني لإيجار شقتك في دبي | سكنلي'),
    description: lang => L(lang)('Tell us about your apartment and get a free rental estimate within 24 hours: guaranteed yearly rent and holiday-home income.', 'أخبرنا عن شقتك واحصل على تقدير مجاني خلال 24 ساعة: الإيجار السنوي المضمون ودخل بيت العطلات.'),
    body: lang => {
      const t = L(lang);
      return `${pageHero(lang, { crumbs: crumbs(lang, [['/owners/', t('For owners', 'للملاك')], [null, t('Rental estimate', 'تقدير الإيجار')]]), eyebrow: t('Free, no commitment', 'مجاني وبدون التزام'), title: t('What could your apartment earn?', 'كم يمكن أن تحقق شقتك؟'), lead: t('Answer a few questions. We call you back within 24 hours with numbers.', 'أجب عن بعض الأسئلة، وسنتصل بك خلال 24 ساعة بالأرقام.') })}
<section class="block"><div class="wrap" style="max-width:760px"><div class="card form-card">
${leadForm(lang, 'owner', [
  ['building', t('Building or project', 'المبنى أو المشروع'), 'text', true],
  ['area', t('Area', 'المنطقة'), 'text', false, { placeholder: t('e.g. Business Bay', 'مثال: الخليج التجاري') }],
  ['unitType', t('Size', 'المساحة'), 'select', false, { options: [['Studio', t('Studio', 'استوديو')], ['1BR', t('1 bedroom', 'غرفة وصالة')], ['2BR', t('2 bedrooms', 'غرفتان وصالة')], ['3BR+', t('3+ bedrooms', '3 غرف أو أكثر')]] }],
  ['furnished', t('Furnished?', 'مفروشة؟'), 'select', false, { options: [['Furnished', t('Furnished', 'مفروشة')], ['Unfurnished', t('Unfurnished', 'غير مفروشة')], ['Partly', t('Partly furnished', 'مفروشة جزئياً')]] }],
  ['interest', t('Interested in', 'مهتم بـ'), 'select', false, { options: [['Either', t('Show me both options', 'أرني الخيارين')], ['Guaranteed rent', t('Guaranteed rent', 'إيجار مضمون')], ['Management', t('Full management', 'إدارة كاملة')]] }],
  ['email', t('Email (optional)', 'البريد الإلكتروني (اختياري)'), 'email'],
  ['message', t('Anything else?', 'ملاحظات أخرى؟'), 'textarea'],
], t('Get my estimate', 'احصل على التقدير'))}
</div></div></section>`;
    },
  }),

  // ───────────────────────── Buy
  page('/buy/', {
    priority: 0.7,
    title: lang => L(lang)('Buy a ready apartment in Dubai | Sakanly', 'اشترِ شقة جاهزة في دبي | سكنلي'),
    description: lang => L(lang)('Ready apartments on Dubai’s secondary market, to live in or to rent out. Tell us your budget and we shortlist units for you.', 'شقق جاهزة في السوق الثانوي بدبي، للسكن أو للتأجير. أخبرنا بميزانيتك ونرشح لك وحدات مناسبة.'),
    waTopic: lang => L(lang)('buying a property', 'شراء عقار'),
    body: lang => {
      const t = L(lang);
      return `${pageHero(lang, { crumbs: crumbs(lang, [[null, t('Buy', 'شراء')]]), eyebrow: t('Secondary market', 'السوق الثانوي'), title: t('Buy a ready home, or an income', 'اشترِ منزلاً جاهزاً أو مصدر دخل'), lead: t('We know what rents in Dubai because we rent it every day. Buy with numbers on real rental income, not brochures.', 'نعرف ما يؤجَّر في دبي لأننا نؤجره كل يوم. اشترِ بناءً على أرقام دخل إيجاري حقيقية، لا كتيبات دعائية.') })}
<section class="block"><div class="wrap split">
  <div>${features([
    [t('Tell us your goal', 'أخبرنا بهدفك'), t('To live in, or to rent out. Budget, area, cash or mortgage.', 'للسكن أو للتأجير. الميزانية والمنطقة، نقداً أو بالتمويل.')],
    [t('Get a shortlist', 'استلم قائمة مختصرة'), t('Ready units that fit, with expected rent from our own data.', 'وحدات جاهزة مناسبة، مع الإيجار المتوقع من بياناتنا.')],
    [t('View, offer, transfer', 'عاين وقدّم عرضاً وانقل الملكية'), t('We arrange viewings, negotiate and take you through the transfer.', 'نرتب المعاينات ونتفاوض ونرافقك حتى نقل الملكية.')],
    [t('Then, if you want, we rent it', 'وبعدها، إن أردت، نؤجرها لك'), t('Guaranteed rent or full management from day one.', 'إيجار مضمون أو إدارة كاملة من اليوم الأول.')],
  ], 'g1')}</div>
  <div class="card form-card"><h2 style="font-size:26px">${t('Book a call', 'احجز مكالمة')}</h2>
  ${leadForm(lang, 'buy', [
    ['purpose', t('I want to', 'أريد'), 'select', false, { options: [['Live in', t('Live in it', 'السكن فيه')], ['Invest', t('Rent it out', 'تأجيره')]] }],
    ['budget', t('Budget (AED)', 'الميزانية (درهم)'), 'number'],
    ['area', t('Preferred area', 'المنطقة المفضلة'), 'text'],
    ['unitType', t('Size', 'المساحة'), 'select', false, { options: [['Studio', t('Studio', 'استوديو')], ['1BR', t('1 bedroom', 'غرفة وصالة')], ['2BR', t('2 bedrooms', 'غرفتان وصالة')], ['3BR+', t('3+ bedrooms', '3 غرف أو أكثر')]] }],
    ['payment', t('Payment', 'طريقة الدفع'), 'select', false, { options: [['Cash', t('Cash', 'نقداً')], ['Mortgage', t('Mortgage', 'تمويل عقاري')]] }],
    ['email', t('Email (optional)', 'البريد الإلكتروني (اختياري)'), 'email'],
  ], t('Request a call', 'اطلب مكالمة'))}</div>
</div></section>`;
    },
  }),

  // ───────────────────────── About
  page('/about/', {
    priority: 0.6,
    title: lang => L(lang)('About Sakanly Real Estate', 'من نحن — سكنلي للعقارات'),
    description: lang => L(lang)('Sakanly is a Dubai real estate company for holiday homes, shared living, leasing, property management and sales, based in Barsha Heights.', 'سكنلي شركة عقارية في دبي لبيوت العطلات والسكن المشترك والتأجير وإدارة العقارات والبيع، مقرها برشا هايتس.'),
    body: lang => {
      const t = L(lang);
      return `${pageHero(lang, { crumbs: crumbs(lang, [[null, t('About', 'من نحن')]]), eyebrow: t('About us', 'من نحن'), title: t('Your home, evolved.', 'منزلك، بشكل أفضل.'), lead: t('Sakanly makes living in Dubai simpler: furnished homes and rooms with fair, all-in prices, and owners who earn without the work.', 'سكنلي تجعل السكن في دبي أسهل: بيوت وغرف مفروشة بأسعار عادلة وشاملة، وملاك يحققون دخلاً بدون مجهود.') })}
<section class="block"><div class="wrap split">
  <div><h2>${t('What we believe', 'ما نؤمن به')}</h2>
  <p class="lead">${t('A home should be easy to find, honest about its price and well looked after. We run every apartment ourselves, from the contract to the cleaning, so tenants, guests and owners deal with one team that answers.', 'يجب أن يكون المنزل سهل الإيجاد، وواضح السعر، ومُعتنى به. نحن ندير كل شقة بأنفسنا من العقد حتى التنظيف، ليتعامل المستأجرون والضيوف والملاك مع فريق واحد يرد عليهم.')}</p></div>
  <div class="grid g2">
    <div class="card"><h3>${t('Licensed', 'مرخصون')}</h3><p class="muted small">${t('Sakanly Stay Vacation Homes Rental L.L.C, Dubai Department of Economy and Tourism, trade licence 1623106.', 'سكنلي ستاي لتأجير بيوت العطلات ش.ذ.م.م، دائرة الاقتصاد والسياحة في دبي، رخصة تجارية رقم 1623106.')}</p></div>
    <div class="card"><h3>${t('Bilingual', 'بلغتين')}</h3><p class="muted small">${t('Arabic and English, in person and on WhatsApp.', 'بالعربية والإنجليزية، شخصياً وعلى واتساب.')}</p></div>
    <div class="card"><h3>${t('Hands-on', 'إدارة مباشرة')}</h3><p class="muted small">${t('We run what we rent: contracts, payments, cleaning and repairs.', 'ندير ما نؤجره: العقود والمدفوعات والتنظيف والصيانة.')}</p></div>
    <div class="card"><h3>${t('Barsha Heights', 'برشا هايتس')}</h3><p class="muted small">${t('Office 301, Warsan Building. Visit us by appointment.', 'مكتب 301، مبنى ورسان. زيارتنا بموعد مسبق.')}</p></div>
  </div>
</div></section>
<section class="block"><div class="wrap">${cta(lang, t('Come and see us', 'تفضل بزيارتنا'), t('Office 301, Warsan Building, Barsha Heights, Dubai.', 'مكتب 301، مبنى ورسان، برشا هايتس، دبي.'))}</div></section>`;
    },
  }),

  // ───────────────────────── Contact
  page('/contact/', {
    priority: 0.6,
    title: lang => L(lang)('Contact Sakanly — WhatsApp, phone and office', 'تواصل مع سكنلي — واتساب وهاتف ومكتب'),
    description: lang => L(lang)('Talk to Sakanly on WhatsApp or call +971 56 591 3200. Office 301, Warsan Building, Barsha Heights, Dubai.', 'تحدث مع سكنلي على واتساب أو اتصل على ‎+971 56 591 3200. مكتب 301، مبنى ورسان، برشا هايتس، دبي.'),
    body: lang => {
      const t = L(lang);
      return `${pageHero(lang, { crumbs: crumbs(lang, [[null, t('Contact', 'تواصل معنا')]]), eyebrow: t('Contact', 'تواصل معنا'), title: t('We reply fast', 'نرد بسرعة'), lead: t('WhatsApp is quickest. Or call, email, or visit our office in Barsha Heights.', 'واتساب هو الأسرع. أو اتصل أو راسلنا بالبريد أو زر مكتبنا في برشا هايتس.'), buttons: `${waBtn(lang, t('Hi Sakanly', 'مرحباً سكنلي'))}<a class="btn btn-light" href="tel:${PHONE.replace(/\s/g, '')}" dir="ltr">${PHONE}</a>` })}
<section class="block"><div class="wrap split" style="align-items:start">
  <div class="grid">
    <div class="card"><h3>${t('Office', 'المكتب')}</h3><p class="muted">${t('Office 301, Warsan Building, Barsha Heights, Dubai, UAE', 'مكتب 301، مبنى ورسان، برشا هايتس، دبي، الإمارات')}</p><a class="btn btn-sm" href="https://maps.google.com/?q=Warsan+Building+Barsha+Heights+Dubai" target="_blank" rel="noopener">${t('Open in Maps', 'افتح في الخرائط')}</a></div>
    <div class="card"><h3>${t('Phone and email', 'الهاتف والبريد')}</h3><p><a href="tel:${PHONE.replace(/\s/g, '')}" dir="ltr">${PHONE}</a><br><a href="mailto:${EMAIL}">${EMAIL}</a></p></div>
    <div class="card"><h3>${t('Hours', 'ساعات العمل')}</h3><p class="muted">${t('Every day, 9 am to 9 pm. Office visits by appointment.', 'يومياً من 9 صباحاً حتى 9 مساءً. زيارة المكتب بموعد مسبق.')}</p></div>
  </div>
  <div class="card form-card"><h2 style="font-size:26px">${t('Send us a message', 'أرسل لنا رسالة')}</h2>
  ${leadForm(lang, 'contact', [['email', t('Email (optional)', 'البريد الإلكتروني (اختياري)'), 'email', false, { full: true }], ['message', t('How can we help?', 'كيف يمكننا مساعدتك؟'), 'textarea']], t('Send', 'إرسال'))}</div>
</div></section>`;
    },
  }),

  // ───────────────────────── FAQ
  page('/faq/', {
    priority: 0.6,
    title: lang => L(lang)('FAQ — rooms, holiday homes, deposits and contracts | Sakanly', 'الأسئلة الشائعة — الغرف وبيوت العطلات والتأمين والعقود | سكنلي'),
    description: lang => L(lang)('Answers about what the rent includes, ladies-only apartments, deposits, notice, payments, contracts and booking holiday homes with Sakanly.', 'إجابات عن ما يشمله الإيجار، وشقق السيدات، والتأمين، والإشعار، والدفع، والعقود، وحجز بيوت العطلات مع سكنلي.'),
    schema: lang => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ(lang).map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }),
    body: lang => {
      const t = L(lang);
      return `${pageHero(lang, { crumbs: crumbs(lang, [[null, t('FAQ', 'الأسئلة الشائعة')]]), eyebrow: t('FAQ', 'الأسئلة الشائعة'), title: t('Good questions', 'أسئلة شائعة'), lead: t('If yours is not here, ask us on WhatsApp.', 'إن لم تجد سؤالك هنا، اسألنا على واتساب.') })}
<section class="block"><div class="wrap" style="max-width:820px">${faqList(FAQ(lang))}</div></section>
<section class="block" style="padding-top:0"><div class="wrap">${cta(lang, t('Still have a question?', 'لديك سؤال آخر؟'), t('Our team answers on WhatsApp in Arabic and English.', 'فريقنا يجيب على واتساب بالعربية والإنجليزية.'))}</div></section>`;
    },
  }),

  // ───────────────────────── House rules
  page('/house-rules/', {
    priority: 0.4,
    title: lang => L(lang)('House rules for shared apartments | Sakanly', 'قواعد السكن في الشقق المشتركة | سكنلي'),
    description: lang => L(lang)('The house rules for Sakanly shared apartments: quiet hours, guests, cleanliness, smoking and safety.', 'قواعد السكن في شقق سكنلي المشتركة: أوقات الهدوء والزوار والنظافة والتدخين والسلامة.'),
    body: lang => {
      const t = L(lang);
      return `${pageHero(lang, { crumbs: crumbs(lang, [[null, t('House rules', 'قواعد السكن')]]), eyebrow: t('Shared living', 'السكن المشترك'), title: t('House rules', 'قواعد السكن'), lead: t('A few simple rules so everyone feels at home. They form part of every sub-lease contract.', 'قواعد بسيطة ليشعر الجميع بالراحة، وهي جزء من كل عقد إيجار من الباطن.') })}
<section class="block"><div class="wrap prose">
  <h2>${t('Respect and quiet', 'الاحترام والهدوء')}</h2>${ticks([t('Keep noise low between 10 pm and 8 am.', 'تجنب الإزعاج من الساعة 10 مساءً حتى 8 صباحاً.'), t('Be considerate of your flatmates in the kitchen, bathrooms and living areas.', 'راعِ شركاء السكن في المطبخ ودورات المياه وأماكن المعيشة.')])}
  <h2>${t('Guests', 'الزوار')}</h2>${ticks([t('Only the person named in the contract lives in the room.', 'يسكن الغرفة الشخص المذكور في العقد فقط.'), t('No overnight guests without Sakanly’s written consent.', 'لا يُسمح بمبيت الزوار دون موافقة كتابية من سكنلي.'), t('In ladies-only apartments, male guests are not allowed inside.', 'في شقق السيدات فقط، لا يُسمح بدخول الزوار من الرجال.')])}
  <h2>${t('Cleanliness', 'النظافة')}</h2>${ticks([t('Clean up after cooking and keep shared areas tidy.', 'نظّف بعد الطهي وحافظ على ترتيب المرافق المشتركة.'), t('Take your rubbish out regularly.', 'أخرج القمامة بانتظام.')])}
  <h2>${t('Safety', 'السلامة')}</h2>${ticks([t('No smoking inside the apartment.', 'ممنوع التدخين داخل الشقة.'), t('No pets.', 'ممنوع اقتناء الحيوانات الأليفة.'), t('No flammable, dangerous or illegal items.', 'ممنوع إدخال أي مواد قابلة للاشتعال أو خطرة أو ممنوعة.'), t('Do not change locks or copy keys and access cards.', 'ممنوع تغيير الأقفال أو نسخ المفاتيح وبطاقات الدخول.')])}
  <h2>${t('Repairs', 'الأعطال')}</h2><p>${t('Report any fault on WhatsApp straight away. We fix faults from normal use; damage caused by a tenant or their visitors is charged to the tenant.', 'أبلغ عن أي عطل فوراً عبر واتساب. نصلح الأعطال الناتجة عن الاستخدام العادي، ويتحمل المستأجر تكلفة الأضرار التي يسببها هو أو زواره.')}</p>
</div></section>`;
    },
  }),

  // ───────────────────────── Legal
  page('/privacy/', {
    priority: 0.2,
    title: lang => L(lang)('Privacy policy | Sakanly', 'سياسة الخصوصية | سكنلي'),
    description: lang => L(lang)('How Sakanly collects and uses your personal information.', 'كيف تجمع سكنلي بياناتك الشخصية وتستخدمها.'),
    body: lang => {
      const t = L(lang);
      return `${pageHero(lang, { eyebrow: t('Legal', 'قانوني'), title: t('Privacy policy', 'سياسة الخصوصية'), lead: t('What we collect, why, and your choices.', 'ما نجمعه ولماذا، وخياراتك.') })}
<section class="block"><div class="wrap prose">
  <h2>${t('What we collect', 'ما نجمعه')}</h2><p>${t('When you send an enquiry we collect your name, phone number, email if you give it, and the details you write. Tenants also give us a copy of their ID or passport for their contract.', 'عند إرسال طلب نجمع اسمك ورقم هاتفك وبريدك إن أعطيتنا إياه والتفاصيل التي تكتبها. ويقدم المستأجرون أيضاً نسخة من الهوية أو جواز السفر لأجل العقد.')}</p>
  <h2>${t('How we use it', 'كيف نستخدمها')}</h2><p>${t('Only to answer your enquiry, arrange viewings and bookings, prepare contracts and meet legal requirements. We do not sell your data.', 'فقط للرد على طلبك وترتيب المعاينات والحجوزات وإعداد العقود والوفاء بالمتطلبات القانونية. لا نبيع بياناتك.')}</p>
  <h2>${t('Who sees it', 'من يطلع عليها')}</h2><p>${t('Our team, and the building management or authorities when the law requires it.', 'فريقنا، وإدارة المبنى أو الجهات الرسمية عندما يتطلب القانون ذلك.')}</p>
  <h2>${t('Your choices', 'خياراتك')}</h2><p>${t('Ask us at any time to see, correct or delete your details:', 'يمكنك في أي وقت أن تطلب الاطلاع على بياناتك أو تصحيحها أو حذفها:')} <a href="mailto:${EMAIL}">${EMAIL}</a>.</p>
</div></section>`;
    },
  }),
  page('/terms/', {
    priority: 0.2,
    title: lang => L(lang)('Terms of use | Sakanly', 'شروط الاستخدام | سكنلي'),
    description: lang => L(lang)('Terms for using sakanly.com.', 'شروط استخدام موقع sakanly.com.'),
    body: lang => {
      const t = L(lang);
      return `${pageHero(lang, { eyebrow: t('Legal', 'قانوني'), title: t('Terms of use', 'شروط الاستخدام'), lead: t('The basics of using this website.', 'أساسيات استخدام هذا الموقع.') })}
<section class="block"><div class="wrap prose">
  <p>${t('This website is run by Sakanly Stay Vacation Homes Rental L.L.C, Dubai (trade licence 1623106).', 'يدير هذا الموقع شركة سكنلي ستاي لتأجير بيوت العطلات ش.ذ.م.م، دبي (رخصة تجارية رقم 1623106).')}</p>
  <h2>${t('Prices and availability', 'الأسعار والتوفر')}</h2><p>${t('Prices and availability come live from our system but can change before a booking or contract is confirmed. Only a signed contract or a confirmed booking is binding.', 'تأتي الأسعار والتوفر مباشرة من نظامنا، لكنها قد تتغير قبل تأكيد الحجز أو العقد. لا يُلزم إلا العقد الموقّع أو الحجز المؤكد.')}</p>
  <h2>${t('Contracts', 'العقود')}</h2><p>${t('Each stay or tenancy is governed by its own contract and our house rules.', 'تخضع كل إقامة أو إيجار لعقدها الخاص ولقواعد السكن.')}</p>
  <h2>${t('Law', 'القانون')}</h2><p>${t('These terms are governed by the laws of the Emirate of Dubai and the UAE.', 'تخضع هذه الشروط لقوانين إمارة دبي ودولة الإمارات العربية المتحدة.')}</p>
</div></section>`;
    },
  }),

  page('/thank-you/', {
    noindex: true,
    title: lang => L(lang)('Thank you | Sakanly', 'شكراً لك | سكنلي'),
    description: lang => L(lang)('We received your request.', 'استلمنا طلبك.'),
    body: lang => {
      const t = L(lang);
      return `<section class="thanks"><div class="wrap"><div class="tick">✓</div><h1 style="font-size:40px">${t('Thank you, we have your request', 'شكراً لك، استلمنا طلبك')}</h1>
<p class="lead" style="margin:0 auto 24px">${t('Our team will message you on WhatsApp shortly, usually within the hour between 9 am and 9 pm.', 'سيراسلك فريقنا على واتساب قريباً، عادةً خلال ساعة بين 9 صباحاً و9 مساءً.')}</p>
<div class="btns" style="justify-content:center">${waBtn(lang, t('Hi Sakanly, I just sent a request on your website', 'مرحباً سكنلي، أرسلت طلباً على موقعكم للتو'), t('Chat now on WhatsApp', 'تحدث الآن على واتساب'))}<a class="btn" href="${href(lang, '/')}">${t('Back to home', 'العودة للرئيسية')}</a></div></div></section>`;
    },
  }),

  page('/404', {
    noindex: true,
    title: lang => L(lang)('Page not found | Sakanly', 'الصفحة غير موجودة | سكنلي'),
    description: lang => L(lang)('This page does not exist.', 'هذه الصفحة غير موجودة.'),
    body: lang => {
      const t = L(lang);
      return `<section class="thanks"><div class="wrap"><h1 style="font-size:44px">${t('This page has moved out', 'هذه الصفحة غير موجودة')}</h1>
<p class="lead" style="margin:0 auto 24px">${t('But we have plenty of rooms and homes that are free.', 'لكن لدينا الكثير من الغرف والبيوت المتاحة.')}</p>
<div class="btns" style="justify-content:center"><a class="btn btn-primary" href="${href(lang, '/shared-living/')}">${t('See free rooms', 'شاهد الغرف المتاحة')}</a><a class="btn" href="${href(lang, '/')}">${t('Home', 'الرئيسية')}</a></div></div></section>`;
    },
  }),
];
