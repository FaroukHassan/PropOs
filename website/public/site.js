// sakanly.com — menu, live availability from the Sakanly system, and enquiry forms
(() => {
  const API = window.SAKANLY_API || 'https://propos-production-e3ff566d.up.railway.app/api/public/site';
  const WA = '971565913200';
  const ar = document.documentElement.lang === 'ar';
  const T = ar ? {
    month: 'شهرياً', night: 'لليلة', from: 'من', now: 'متاحة الآن', availableFrom: 'متاحة من', ladies: 'للسيدات فقط', mix: 'مختلط', men: 'للرجال', family: 'عائلات',
    PARTITION: 'غرفة خاصة', ROOM: 'غرفة', BED: 'سرير', STUDIO: 'استوديو', apt: 'شقة', deposit: 'تأمين', viewing: 'احجز معاينة', ask: 'واتساب',
    none: 'لا توجد غرف متاحة بهذا الاختيار الآن. راسلنا على واتساب ونبلغك أول ما تتوفر غرفة.', noHomes: 'كل البيوت محجوزة حالياً. راسلنا على واتساب بتواريخك.',
    err: 'تعذّر تحميل الأماكن المتاحة الآن. راسلنا على واتساب.', bed: 'غرفة نوم', beds: 'غرف نوم', studio: 'استوديو', bath: 'حمام', book: 'احجز مباشرة', airbnb: 'Airbnb', booking: 'Booking.com',
    perMonth: 'للشهر', sending: 'جارٍ الإرسال…', sendErr: 'تعذّر الإرسال، حاول مرة أخرى أو راسلنا على واتساب.', all: 'الكل', waRoom: 'مرحباً سكنلي، أسأل عن', waHome: 'مرحباً سكنلي، أسأل عن بيت عطلات في',
  } : {
    month: '/ month', night: '/ night', from: 'From', now: 'Available now', availableFrom: 'Available from', ladies: 'Ladies only', mix: 'Mixed', men: 'Men only', family: 'Family',
    PARTITION: 'Private room', ROOM: 'Room', BED: 'Bed space', STUDIO: 'Studio', apt: 'Apartment', deposit: 'deposit', viewing: 'Book a viewing', ask: 'WhatsApp',
    none: 'Nothing matches right now. Message us on WhatsApp and we will tell you as soon as a room frees up.', noHomes: 'All our homes are booked right now. Send us your dates on WhatsApp.',
    err: 'We could not load what is available right now. Please message us on WhatsApp.', bed: 'bedroom', beds: 'bedrooms', studio: 'Studio', bath: 'bath', book: 'Book direct', airbnb: 'Airbnb', booking: 'Booking.com',
    perMonth: 'per month', sending: 'Sending…', sendErr: 'Could not send. Please try again or message us on WhatsApp.', all: 'All', waRoom: 'Hi Sakanly, I am asking about', waHome: 'Hi Sakanly, I am asking about a holiday home in',
  };
  const fmt = n => Number(n || 0).toLocaleString(ar ? 'ar-AE-u-nu-latn' : 'en-AE', { maximumFractionDigits: 0 });
  const aed = n => (ar ? `${fmt(n)} درهم` : `AED ${fmt(n)}`);
  const day = s => new Date(s).toLocaleDateString(ar ? 'ar-AE-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short' });
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const wa = text => `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;

  // ── menu
  const btn = document.querySelector('.menu-btn');
  const nav = document.querySelector('.nav');
  if (btn) btn.addEventListener('click', () => { const o = nav.classList.toggle('open'); btn.setAttribute('aria-expanded', o); document.body.style.overflow = o ? 'hidden' : ''; });

  // ── enquiry modal (room / home)
  const modal = document.getElementById('enquire');
  const openModal = (title, details, type) => {
    if (!modal) return;
    modal.querySelector('[data-title]').textContent = title;
    const f = modal.querySelector('form');
    f.dataset.lead = type;
    f.dataset.extra = JSON.stringify(details);
    modal.classList.add('open');
    setTimeout(() => f.querySelector('input[name=name]').focus(), 50);
  };
  if (modal) {
    modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('.modal-x')) modal.classList.remove('open'); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') modal.classList.remove('open'); });
  }

  // ── forms → Sakanly system (Leasing, as new leads)
  document.querySelectorAll('form[data-lead]').forEach(form => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const msg = form.querySelector('.form-msg');
      const submit = form.querySelector('button[type=submit]');
      const fd = Object.fromEntries(new FormData(form).entries());
      const { name, phone, email, message, website, ...details } = fd;
      Object.assign(details, JSON.parse(form.dataset.extra || '{}'));
      submit.disabled = true; const label = submit.textContent; submit.textContent = T.sending; msg.className = 'form-msg';
      try {
        const r = await fetch(`${API}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: form.dataset.lead, name, phone, email, message, website, details, page: location.pathname, lang: ar ? 'ar' : 'en' }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || T.sendErr);
        location.href = `${ar ? '/ar' : ''}/thank-you/`;
      } catch (err) {
        msg.textContent = err.message || T.sendErr; msg.className = 'form-msg err';
        submit.disabled = false; submit.textContent = label;
      }
    });
  });

  // ── shared-living rooms, live
  const occTag = o => ({ LADIES: `<span class="tag ladies">${T.ladies}</span>`, MIX: `<span class="tag mix">${T.mix}</span>`, MEN: `<span class="tag">${T.men}</span>`, FAMILY: `<span class="tag">${T.family}</span>` }[o] || '');
  const roomCard = r => {
    const title = `${T[r.kind] || T.ROOM} ${esc(r.code)}`;
    const where = `${T.apt} ${esc(r.apartment)} · ${esc(r.building)}${r.area ? `, ${esc(r.area)}` : ''}`;
    const when = r.availableFrom ? `<span class="tag">${T.availableFrom} ${day(r.availableFrom)}</span>` : `<span class="tag now">${T.now}</span>`;
    return `<article class="card room">
      <div class="room-top"><div><h3>${title}</h3><div class="where">${where}</div></div></div>
      <div class="price">${aed(r.price)} <small>${T.month}</small></div>
      <div class="tags">${occTag(r.occupancy)}${when}${r.deposit ? `<span class="tag">${T.deposit} ${aed(r.deposit)}</span>` : ''}</div>
      ${r.amenities ? `<div class="small muted">${esc(r.amenities)}</div>` : ''}
      <div class="btns"><button class="btn btn-primary" data-room='${esc(JSON.stringify({ building: r.building, room: `${r.code} · ${T.apt} ${r.apartment}`, price: r.price }))}' data-title="${esc(`${title} · ${where}`)}">${T.viewing}</button>
      <a class="btn" target="_blank" rel="noopener" href="${wa(`${T.waRoom} ${title}, ${where} (${aed(r.price)})`)}">${T.ask}</a></div>
    </article>`;
  };
  document.querySelectorAll('[data-rooms]').forEach(async box => {
    const fixed = { building: box.dataset.building || '', occupancy: box.dataset.occupancy || '' };
    const filters = box.parentElement.querySelector('[data-room-filters]');
    let rooms = [];
    let occ = fixed.occupancy;
    const draw = () => {
      const list = rooms.filter(r => (!fixed.building || r.buildingSlug === fixed.building) && (!occ || r.occupancy === occ));
      box.innerHTML = list.length ? list.map(roomCard).join('') : `<div class="empty" style="grid-column:1/-1">${T.none}</div>`;
      const count = document.querySelector('[data-room-count]');
      if (count) count.textContent = list.length;
    };
    box.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
    try {
      rooms = await fetch(`${API}/rooms`).then(r => { if (!r.ok) throw new Error(); return r.json(); });
      if (box.dataset.limit) rooms = rooms.slice(0, Number(box.dataset.limit));
      draw();
      if (filters) filters.addEventListener('click', e => {
        const c = e.target.closest('.chip'); if (!c) return;
        occ = c.dataset.occ;
        filters.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x === c));
        draw();
      });
    } catch { box.innerHTML = `<div class="empty" style="grid-column:1/-1">${T.err}</div>`; }
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-room]'); if (!b) return;
      openModal(b.dataset.title, JSON.parse(b.dataset.room), 'shared');
    });
  });

  // ── holiday homes, live
  const homeArt = '<svg viewBox="0 0 200 120" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 110V52l44-30 44 30v58"/><path d="M108 110V38l36-22 36 22v72"/><path d="M10 110h180"/><path d="M50 110V80h28v30M126 56h12M152 56h12M126 76h12M152 76h12M126 96h12M152 96h12"/><circle cx="64" cy="58" r="7"/></svg>';
  document.querySelectorAll('[data-homes]').forEach(async box => {
    box.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
    try {
      const homes = await fetch(`${API}/homes`).then(r => { if (!r.ok) throw new Error(); return r.json(); });
      box.innerHTML = homes.length ? homes.map(h => {
        const size = h.bedrooms ? `${h.bedrooms} ${h.bedrooms > 1 ? T.beds : T.bed}` : T.studio;
        const title = `${size} · ${esc(h.building)}`;
        const rate = h.nightlyRate ? `<div class="price">${T.from} ${aed(h.nightlyRate)} <small>${T.night}</small></div>` : h.monthlyRent ? `<div class="price">${aed(h.monthlyRent)} <small>${T.month}</small></div>` : '';
        return `<article class="card home-card"><div class="art">${homeArt}</div><div class="body">
          <h3>${title}</h3><div class="where small muted">${esc(h.area || 'Dubai')}${h.bathrooms ? ` · ${h.bathrooms} ${T.bath}` : ''}</div>
          ${rate}${h.amenities ? `<div class="small muted">${esc(h.amenities)}</div>` : ''}
          <div class="btns" style="margin-top:auto">
            <button class="btn btn-primary btn-sm" data-home='${esc(JSON.stringify({ home: `${size} · ${h.building}`, area: h.area || '' }))}' data-title="${esc(title)}">${T.book}</button>
            ${h.airbnbUrl ? `<a class="btn btn-sm" target="_blank" rel="noopener" href="${esc(h.airbnbUrl)}">${T.airbnb}</a>` : ''}
            ${h.bookingUrl ? `<a class="btn btn-sm" target="_blank" rel="noopener" href="${esc(h.bookingUrl)}">${T.booking}</a>` : ''}
            <a class="btn btn-sm" target="_blank" rel="noopener" href="${wa(`${T.waHome} ${h.building}`)}">${T.ask}</a>
          </div></div></article>`;
      }).join('') : `<div class="empty" style="grid-column:1/-1">${T.noHomes}</div>`;
    } catch { box.innerHTML = `<div class="empty" style="grid-column:1/-1">${T.err}</div>`; }
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-home]'); if (!b) return;
      openModal(b.dataset.title, JSON.parse(b.dataset.home), 'stay');
    });
  });

  // live counter on the home page
  document.querySelectorAll('[data-live-count]').forEach(async el => {
    try { const rooms = await fetch(`${API}/rooms`).then(r => r.json()); el.textContent = rooms.length; } catch { el.closest('[data-live-wrap]')?.remove(); }
  });
})();
