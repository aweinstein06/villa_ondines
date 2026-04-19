
// SMOOTH SCROLL
document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
        const t = document.querySelector(a.getAttribute('href'));
        if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
});

// NAV SCROLL
window.addEventListener('scroll', () => {
    document.getElementById('main-nav').style.background =
        window.scrollY > 60 ? 'rgba(10,22,40,0.98)' : 'rgba(10,22,40,0.90)';
});

// MOBILE MENU
let menuOpen = false;
function toggleMenu() {
    menuOpen = !menuOpen;
    const nl = document.getElementById('nav-links');
    nl.style.cssText = menuOpen ? 'display:flex;flex-direction:column;position:fixed;top:62px;left:0;right:0;background:rgba(10,22,40,0.98);padding:2rem;gap:1.5rem;border-bottom:1px solid rgba(255,255,255,0.1);z-index:199;' : 'display:none';
}

// FADE IN
const obsEl = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.style.opacity = '1'; e.target.style.transform = 'translateY(0)'; }
}), { threshold: 0.07 });
document.querySelectorAll('.feature,.amenity-item,.review-card,.att-card,.rate-card').forEach(el => {
    el.style.cssText += ';opacity:0;transform:translateY(18px);transition:opacity 0.5s ease,transform 0.5s ease;';
    obsEl.observe(el);
});

// ── PRICING ──────────────────────────────────────────────────────
const CLEANING_FEE = 350; // € — frais de ménage fixes par séjour

// Season-specific ranges (start/end inclusive) with weekly rates
const SEASONS = [
    { name: 'MARS', start: '2026-03-07', end: '2026-04-03', weekly: 3800 },
    { name: 'AVRIL', start: '2026-04-04', end: '2026-05-08', weekly: 4200 },
    { name: 'PRINTEMPS', start: '2026-05-09', end: '2026-06-29', weekly: 2800 },
    { name: 'ÉTÉ', start: '2026-06-29', end: '2026-08-28', weekly: 3500 },
    { name: 'AUTOMNE', start: '2026-08-30', end: '2026-10-16', weekly: 2800 },
    { name: 'TOUSSAINT', start: '2026-10-17', end: '2026-11-06', weekly: 3500 },
    { name: 'PRÉ-HIVER', start: '2026-11-07', end: '2026-12-18', weekly: 3000 },
    { name: 'VACANCES', start: '2026-12-19', end: '2027-01-01', weekly: 7500 },
    { name: 'MI-SAISON', start: '2027-01-02', end: '2027-02-05', weekly: 4000 },
    { name: 'HAUTE SAISON', start: '2027-02-06', end: '2027-03-05', weekly: 4600 }
];

function getRate(d) {
    // Helper: parse 'YYYY-MM-DD' as local midnight Date
    const parse = s => {
        const [y, m, day] = s.split('-').map(Number);
        return new Date(y, m - 1, day);
    };

    for (const s of SEASONS) {
        const a = parse(s.start);
        const b = parse(s.end);
        const bEx = new Date(b.getFullYear(), b.getMonth(), b.getDate() + 1);
        if (d >= a && d < bEx) return { label: s.name, weekly: s.weekly };
    }
    // Fallback to a sensible default
    return { label: 'Default', weekly: 2800 };
}
function calcPrice(ci, co) {
    const nights = Math.round((co - ci) / 86400000);
    if (nights <= 0) return null;
    let rental = 0, bk = {};
    for (let i = 0; i < nights; i++) {
        const d = new Date(ci.getFullYear(), ci.getMonth(), ci.getDate() + i);
        const r = getRate(d);
        const pn = r.weekly / 7;
        rental += pn;
        if (!bk[r.label]) bk[r.label] = { n: 0, pn };
        bk[r.label].n++;
    }
    rental = Math.round(rental);
    return { rental, cleaning: CLEANING_FEE, total: rental + CLEANING_FEE, nights, bk };
}

// ══════════════════════════════════════════════════════════════════
// ✏️  MANUAL BLOCKED DATES — edit this list to block dates yourself
// Format: ['YYYY-MM-DD', 'YYYY-MM-DD'] = arrival to departure (end is exclusive)
// These are ALWAYS active and merge with the Avantio iCal sync below.
// ══════════════════════════════════════════════════════════════════
const MANUAL_BLOCKS = [
];

// ── iCAL AUTO-SYNC (Avantio) ──────────────────────────────────────
const ICAL_URL = 'https://calendar.avantio.pro/v1/174e5151-9f4e-4885-a2b7-85574d33fd68.ics';
let blockedRanges = [];

function parseDateStr(str) { // 'YYYY-MM-DD' -> local midnight Date
    const [y, m, day] = str.split('-').map(Number);
    return new Date(y, m - 1, day);
}

function parseICS(txt) {
    const ranges = [];
    txt.split('BEGIN:VEVENT').slice(1).forEach(ev => {
        const sm = ev.match(/DTSTART[^:]*:(\d{8})/);
        const em = ev.match(/DTEND[^:]*:(\d{8})/);
        if (!sm || !em) return;
        const p = s => new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
        const s = p(sm[1]), e = p(em[1]);
        if (!isNaN(s) && !isNaN(e) && e > s) ranges.push({ s, e });
    });
    return ranges;
}

function applyAllBlocks(icalRanges) {
    const manual = MANUAL_BLOCKS.map(([a, b]) => ({ s: parseDateStr(a), e: parseDateStr(b) }));
    blockedRanges = [...manual, ...icalRanges];
    buildCalendars();
}

function setDot(state, msg) {
    const dot = document.getElementById('ical-dot');
    const txt = document.getElementById('ical-status');
    const base = 'width:9px;height:9px;border-radius:50%;flex-shrink:0;';
    try {
        if (dot) {
            if (state === 'ok') dot.style.cssText = base + 'background:#4dd296;animation:pulse-green 2s ease infinite;';
            else if (state === 'warn') dot.style.cssText = base + 'background:#f0a840;';
            else if (state === 'error') dot.style.cssText = base + 'background:#f87;';
            else dot.style.cssText = base + 'background:#888;animation:pulse-grey 1.5s ease infinite;';
        }
        if (txt) {
            if (state === 'ok') txt.style.color = 'rgba(255,255,255,0.65)';
            else if (state === 'warn') txt.style.color = 'rgba(255,200,100,0.9)';
            else if (state === 'error') txt.style.color = 'rgba(255,130,130,0.9)';
            else txt.style.color = 'rgba(255,255,255,0.4)';
            if (msg) txt.textContent = msg;
        }
    } catch (e) { /* silently ignore if elements missing */ }
}

async function loadICal() {
    setDot('loading');
    // Apply manual blocks right away so calendar is usable immediately
    applyAllBlocks([]);

    const proxies = [
        { mk: u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`, json: true },
        { mk: u => `https://corsproxy.io/?${encodeURIComponent(u)}`, json: false },
        { mk: u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`, json: false },
    ];

    for (const { mk, json } of proxies) {
        try {
            const res = await fetch(mk(ICAL_URL), { signal: AbortSignal.timeout(10000) });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const ics = json ? (await res.json()).contents : await res.text();
            if (!ics || !ics.includes('BEGIN:VCALENDAR')) throw new Error('Not a valid iCal');

            const icalRanges = parseICS(ics);

            applyAllBlocks(icalRanges);

            const ni = icalRanges.length, nm = MANUAL_BLOCKS.length;
            const parts = [];
            if (ni > 0) parts.push(ni + ' réservation' + (ni > 1 ? 's' : '') + ' Avantio');
            if (nm > 0) parts.push(nm + ' bloc' + (nm > 1 ? 's' : '') + ' manuel' + (nm > 1 ? 's' : ''));
            setDot('ok');
            return;
        } catch (err) {
            // try next proxy
        }
    }

    // All proxies failed — manual blocks still work fine
    const nm = MANUAL_BLOCKS.length;
    setDot('warn',
        nm > 0
            ? '⚠ Synchro Avantio indisponible — ' + nm + ' bloc' + (nm > 1 ? 's' : '') + ' manuel' + (nm > 1 ? 's' : '') + ' actif' + (nm > 1 ? 's' : '')
            : '⚠ Synchro automatique indisponible — vérifiez les disponibilités par email'
    );
}

// ── CALENDAR ─────────────────────────────────────────────────────
function midnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function sameDay(a, b) { return a && b && midnight(a).getTime() === midnight(b).getTime(); }
function isBlockedForArrival(d) {
    const t = midnight(d).getTime();
    return blockedRanges.some(r => {
        const start = midnight(r.s).getTime();
        const end = midnight(r.e).getTime();
        return t > start && t < end;
    });
}

function isBlockedForStay(d) {
    const t = midnight(d).getTime();
    return blockedRanges.some(r => {
        const start = midnight(r.s).getTime();
        const end = midnight(r.e).getTime();
        return t > start && t < end;
    });
}

function isOccupiedNight(d) {
    const t = midnight(d).getTime();
    return blockedRanges.some(r => {
        const start = midnight(r.s).getTime();
        const end = midnight(r.e).getTime();
        return t > start && t < end;
    });
}

function canArrive(d) {
    return !isOccupiedNight(d);
}

function canDepart(d) {
    return true;
}

function isPast(d) { return midnight(d).getTime() < midnight(new Date()).getTime(); }

let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();
let selStart = null;
let selEnd = null;

function prevMonths() {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    buildCalendars();
}
function nextMonths() {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    buildCalendars();
}

function buildCalendars() {
    const cont = document.getElementById('calendars');
    const lbls = document.getElementById('cal-month-labels');
    cont.innerHTML = '';
    lbls.innerHTML = '';
    const locale = (typeof lang !== 'undefined' && lang === 'en') ? 'en-GB' : 'fr-FR';
    const numMonths = window.innerWidth < 700 ? 1 : 2;
    for (let i = 0; i < numMonths; i++) {
        let m = viewMonth + i, y = viewYear;
        if (m > 11) { m -= 12; y++; }
        const lbl = document.createElement('div');
        lbl.style.cssText = 'font-family:"Cormorant Garamond",serif;font-size:1.05rem;font-weight:300;color:#fff;letter-spacing:0.1em;text-align:center;min-width:200px;flex:1;';
        lbl.textContent = new Date(y, m, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
        lbls.appendChild(lbl);
        cont.appendChild(makeMonth(y, m));
    }
    updateSummary();
}

function makeMonth(y, m) {
    const locale = (typeof lang !== 'undefined' && lang === 'en') ? 'en-GB' : 'fr-FR';
    const dayNames = locale === 'en-GB'
        ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
        : ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

    const wrap = document.createElement('div');
    wrap.style.cssText = 'flex:1;min-width:240px;';

    // Day-of-week headers
    const hdr = document.createElement('div');
    hdr.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:4px;';
    dayNames.forEach(n => {
        const h = document.createElement('div');
        h.textContent = n;
        h.style.cssText = 'text-align:center;font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.25);padding:0.4rem 0;';
        hdr.appendChild(h);
    });
    wrap.appendChild(hdr);

    // Day grid
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);gap:3px;';

    const firstDow = new Date(y, m, 1).getDay(); // 0=Sun
    const off = firstDow === 0 ? 6 : firstDow - 1;
    const dim = new Date(y, m + 1, 0).getDate();

    // Empty spacer cells
    for (let i = 0; i < off; i++) {
        const e = document.createElement('div');
        e.style.minHeight = '36px';
        grid.appendChild(e);
    }

    for (let dn = 1; dn <= dim; dn++) {
        const date = new Date(y, m, dn);
        const past = isPast(date);
        const selectingDeparture = !!selStart && !selEnd;
        const bl = selectingDeparture ? false : !canArrive(date);
        const ss = sameDay(date, selStart);
        const se = sameDay(date, selEnd);
        const tod = sameDay(date, new Date());
        const inR = selStart && selEnd &&
            midnight(date) > midnight(selStart) &&
            midnight(date) < midnight(selEnd);

        const cell = document.createElement('div');
        cell.textContent = dn;

        let bg, col, cur, brd = '1px solid transparent', td = 'none', fw = 'normal';
        if (past) {
            bg = 'rgba(255,255,255,0.02)'; col = 'rgba(255,255,255,0.18)'; cur = 'default';
        } else if (bl) {
            bg = 'rgba(210,50,50,0.28)'; col = 'rgba(255,90,90,0.7)'; cur = 'not-allowed';
            brd = '1px solid rgba(210,50,50,0.2)'; td = 'line-through';
        } else if (ss || se) {
            bg = 'var(--accent)'; col = '#fff'; cur = 'pointer'; fw = '600';
        } else if (inR) {
            bg = 'rgba(77,184,200,0.2)'; col = 'rgba(255,255,255,0.9)'; cur = 'pointer';
            brd = '1px solid rgba(77,184,200,0.4)';
        } else {
            bg = 'rgba(255,255,255,0.07)'; col = 'rgba(255,255,255,0.82)'; cur = 'pointer';
        }
        if (tod && !ss && !se) brd = '1px solid rgba(77,184,200,0.65)';

        cell.style.cssText = [
            'display:flex', 'align-items:center', 'justify-content:center',
            'min-height:36px', 'font-size:0.82rem',
            `font-weight:${fw}`, `background:${bg}`, `color:${col}`,
            `cursor:${cur}`, `border:${brd}`, 'border-radius:2px',
            'user-select:none', `text-decoration:${td}`
        ].join(';') + ';';

        if (!past && !bl) {
            (function (capturedDate) {
                cell.addEventListener('click', function () {
                    onDateClick(capturedDate);
                });
            })(new Date(y, m, dn));
        }

        grid.appendChild(cell);
    }
    wrap.appendChild(grid);
    return wrap;
}

function onDateClick(date) {
    document.getElementById('unavail-banner').style.display = 'none';

    if (!selStart || selEnd) {
        if (isBlockedForArrival(date) || isPast(date)) return;
        selStart = midnight(date);
        selEnd = null;
        buildCalendars();
        return;
    }

    if (midnight(date).getTime() <= midnight(selStart).getTime()) {
        if (isBlockedForArrival(date) || isPast(date)) return;
        selStart = midnight(date);
        selEnd = null;
        buildCalendars();
        return;
    }

    let check = new Date(selStart.getFullYear(), selStart.getMonth(), selStart.getDate() + 1);
    while (midnight(check).getTime() < midnight(date).getTime()) {
        if (isBlockedForStay(check)) {
            document.getElementById('unavail-banner').style.display = 'block';
            selStart = null;
            selEnd = null;
            buildCalendars();
            return;
        }
        check = new Date(check.getFullYear(), check.getMonth(), check.getDate() + 1);
    }

    selEnd = midnight(date);
    buildCalendars();
}

// ── PRICE SUMMARY & FORM ─────────────────────────────────────────
function updateSummary() {
    const ps = document.getElementById('price-summary');
    const cf = document.getElementById('contact-form');
    const sp = document.getElementById('select-prompt');

    if (!selStart || !selEnd) {
        ps.style.display = 'none';
        cf.style.display = 'none';
        sp.style.display = 'block';
        sp.textContent = selStart
            ? '↑ Cliquez maintenant sur votre date de départ'
            : '↑ Cliquez sur une date d\'arrivée pour commencer votre sélection';
        return;
    }

    sp.style.display = 'none';
    ps.style.display = 'block';
    cf.style.display = 'block';

    const price = calcPrice(selStart, selEnd);
    const fmt = d => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';
    const fmtL = d => d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('date-summary').textContent = `${fmtL(selStart)} → ${fmtL(selEnd)}`;
    document.getElementById('nights-summary').textContent = `${price.nights} ${lang === 'fr' ? 'nuit' : 'night'}${price.nights > 1 ? 's' : ''}`;
    document.getElementById('price-total').textContent = `${price.total.toLocaleString('fr-FR')} €`;
    const rateLabel = lang === 'fr' ? Object.entries(price.bk).map(([l, { n, pn }]) => `${l} (${n}n × ${Math.round(pn)}€/n)`).join(' + ')
        : Object.entries(price.bk).map(([l, { n, pn }]) => {
            const en = { 'Mars': 'March', 'Avril': 'April', 'Printemps': 'Spring', 'Été': 'Summer', 'Automne': 'Autumn', 'Toussaint': 'All Saints', 'Pré-Hiver': 'Pre-Winter', 'Vacances': 'Holidays', 'Mi-Saison': 'Mid-Season', 'Haute Saison': 'High Season' };
            return `${en[l] || l} (${n}n × ${Math.round(pn)}€/n)`;
        }).join(' + ');
    document.getElementById('price-breakdown').textContent = rateLabel
        + ` + ${lang === 'fr' ? 'ménage' : 'cleaning'} ${CLEANING_FEE.toLocaleString('fr-FR')} €`;
    const pw = document.getElementById('price-warning');
    if (price.nights < 7) {
        pw.textContent = lang === 'fr'
            ? '⚠ Séjour minimum recommandé : 7 nuits. Contactez-nous pour les courts séjours.'
            : '⚠ Recommended minimum stay: 7 nights. Contact us for shorter stays.';
        pw.style.display = 'block';
    } else pw.style.display = 'none';
}

function submitForm() {
    const f = id => document.getElementById(id).value.trim();
    if (!f('fname') || !f('email') || !f('guests') || !selStart || !selEnd) {
        const icalStatus = document.getElementById('ical-status');
        if (icalStatus) icalStatus.textContent = '⚠ Veuillez remplir tous les champs et sélectionner vos dates.';
        setDot('error'); return;
    }
    const price = calcPrice(selStart, selEnd);
    const fmt = d => d.toLocaleDateString('fr-FR');
    const sub = encodeURIComponent('Demande de réservation – Villa les Ondines, Martinique');
    const body = encodeURIComponent(
        `Bonjour,\n\nJe souhaite réserver la Villa les Ondines :\n\n` +
        `Arrivée    : ${fmt(selStart)}\nDépart     : ${fmt(selEnd)}\n` +
        `Durée      : ${price.nights} nuit(s)\nVoyageurs  : ${f('guests')}\n` +
        `Location   : ${price.rental.toLocaleString('fr-FR')} €\n` +
        `Ménage     : ${price.cleaning.toLocaleString('fr-FR')} €\n` +
        `TOTAL      : ${price.total.toLocaleString('fr-FR')} €\n\n` +
        `Nom   : ${f('fname')} ${f('lname')}\nEmail : ${f('email')}\n` +
        `Tél   : ${f('phone') || 'Non renseigné'}\n\nMessage :\n${f('message') || '–'}\n\nCordialement,\n${f('fname')}`
    );
    window.location.href = `mailto:info@villaondines.com?subject=${sub}&body=${body}`;
}

// ── GALLERY LIGHTBOX ───────────────────────────────────────────
(function () {
    const lb = document.getElementById('lightbox');
    const gallery = document.querySelector('.gallery-grid');
    console.log('Lightbox IIFE start', { lb, gallery });
    if (!lb) return;
    const lbImg = lb.querySelector('.lightbox-img');
    const lbClose = lb.querySelector('.lightbox-close');
    const lbPrev = lb.querySelector('.lightbox-prev');
    const lbNext = lb.querySelector('.lightbox-next');
    const lbCounter = lb.querySelector('.lightbox-counter');
    let imgs = [];
    let idx = 0;

    function refreshImgs() { imgs = Array.from(document.querySelectorAll('.gallery-grid .gallery-item img')); console.log('refreshImgs ->', imgs.length); }
    function openAt(i) {
        if (!imgs.length) { refreshImgs(); if (!imgs.length) { console.log('no imgs to open'); return; } }
        idx = (i + imgs.length) % imgs.length;
        console.log('openAt', idx, imgs[idx] && imgs[idx].src);
        lbImg.src = imgs[idx].src;
        lbImg.alt = imgs[idx].alt || '';
        lb.classList.add('open');
        lb.setAttribute('aria-hidden', 'false');
        updateCounter();
    }
    function close() { console.log('lightbox close'); lb.classList.remove('open'); lb.setAttribute('aria-hidden', 'true'); }
    function prev() { openAt(idx - 1); }
    function next() { openAt(idx + 1); }
    function updateCounter() { if (lbCounter) lbCounter.textContent = `${idx + 1} / ${imgs.length}`; }

    // Delegate clicks from gallery container
    if (gallery) {
        gallery.addEventListener('click', function (e) {
            // Accept clicks on the img or anywhere inside its .gallery-item
            const item = e.target.closest ? e.target.closest('.gallery-item') : null;
            if (!item || !gallery.contains(item)) return;
            let img = item.querySelector('img');
            console.log('gallery click', { target: e.target, item, img });

            // If no <img> element, try to read a CSS background-image on the item
            if (!img) {
                const bg = window.getComputedStyle(item).backgroundImage;
                if (bg && bg !== 'none') {
                    const url = bg.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
                    console.log('found background image URL', url);
                    // open lightbox with this url (not part of imgs array)
                    e.preventDefault();
                    if (lbImg) {
                        lbImg.src = url;
                        lbImg.alt = item.getAttribute('data-alt') || '';
                        lb.classList.add('open');
                        lb.setAttribute('aria-hidden', 'false');
                        lbCounter.textContent = '';
                    }
                    return;
                }
                // nothing to open
                return;
            }

            refreshImgs();
            const i = imgs.indexOf(img);
            console.log('clicked image index', i);
            if (i >= 0) { e.preventDefault(); openAt(i); }
        });
    }

    if (lbClose) lbClose.addEventListener('click', close);
    if (lbPrev) lbPrev.addEventListener('click', prev);
    if (lbNext) lbNext.addEventListener('click', next);
    lb.addEventListener('click', e => { if (e.target === lb) close(); });
    document.addEventListener('keydown', e => {
        if (!lb.classList.contains('open')) return;
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowLeft') prev();
        else if (e.key === 'ArrowRight') next();
    });
})();

// ── LANGUAGE TOGGLE ──────────────────────────────────────────────
let lang = 'fr';

const T = {
    fr: {
        // Nav
        nav_about: 'La Villa', nav_gallery: 'Photos', nav_amenities: 'Équipements',
        nav_rates: 'Tarifs', nav_reviews: 'Avis', nav_book: 'Réserver',
        // Hero
        hero_eyebrow: "Martinique · Anses d'Arlet · Villa 5★",
        hero_title: 'La Villa<br><em>les Ondines</em>',
        hero_sub: "350m² entièrement tournés vers la mer des Caraïbes. Architecture créole, piscine à débordement et vue panoramique sur le village pittoresque d'Anses d'Arlet.",
        hero_badge1: '⭐ 4,92/5 Airbnb', hero_badge2: '🏆 Classement 5★ officiel',
        hero_badge3: '🚶 150m de la plage', hero_badge4: "✈️ 33km de l'aéroport",
        hero_cta1: 'Vérifier les disponibilités', hero_cta2: 'Découvrir la villa',
        stat1_label: 'm² de villa', stat2_label: 'Chambres', stat3_label: 'Personnes',
        scroll_hint: 'Découvrir',
        // About
        about_label: 'Environ la propriété',
        about_title: "Plus de 350 m²<br><em>face à l'horizon</em>",
        about_p1: "L'arrivée à la Villa les Ondines est à vous couper le souffle. Entièrement tournée vers le large, elle offre une vue extraordinaire sur les eaux cristallines de la mer des Caraïbes. Entre camaïeux de bleus, mornes verdoyants et village pittoresque, le spectacle est à la hauteur.",
        about_p2: "Mariant architecture créole, matériaux modernes et couleurs actuelles, la villa est une adresse attachante où le charme opère vite. Le séjour et la cuisine, largement ouverts sur l'extérieur, donnent sur la piscine à débordement où ciel, mer et horizon semblent se fondre à l'infini.",
        feat1: 'Surface habitable', feat2: 'Chambres (5 SDB)', feat3: 'Piscine à débordement',
        feat4: 'Voyageurs max', feat5: 'De la plage', feat6: "De l'aéroport FDF",
        // Specs
        spec1: 'Rénovée', spec2: 'Classement officiel', spec3: 'Salles de bain',
        spec4: 'WiFi & Parking', spec5: 'Accès handicapés',
        // Gallery
        gal_label: 'Galerie photos', gal_title: 'La villa <em>en images</em>',
        // Amenities
        am_label: 'Confort & équipements',
        am_title: 'Tout pour un séjour <em style="color:var(--light)">parfait</em>',
        am_body: "Chaque chambre dispose de sa propre salle de bain avec douche italienne et sèche-cheveux. La villa est entièrement climatisée et insonorisée.",
        rule1: '🚬 Non-fumeur', rule2: '🐾 Animaux non admis',
        rule3: '👫 Groupes –22 ans non acceptés', rule4: '👶 Enfants bienvenus · Berceau disponible',
        amenity_1: 'Piscine à débordement<br><small style="font-size:0.6rem;opacity:0.5">5.5 × 3.5m · prof. 0.8–1.6m</small>',
        amenity_2: 'Baignoire extérieure',
        amenity_3: 'Vue mer panoramique',
        amenity_4: 'Climatisation<br><small style="font-size:0.6rem;opacity:0.5">Toutes les pièces</small>',
        amenity_5: 'Cuisine équipée<br><small style="font-size:0.6rem;opacity:0.5">Lave-vaisselle inclus</small>',
        amenity_6: 'Lave-linge',
        amenity_7: 'WiFi haut débit<br><small style="font-size:0.6rem;opacity:0.5">Gratuit</small>',
        amenity_8: 'TV écran plat',
        amenity_9: 'Parking privé<br><small style="font-size:0.6rem;opacity:0.5">Gratuit</small>',
        amenity_10: 'Fenêtres insonorisées',
        amenity_11: 'Barbecue extérieur',
        amenity_12: 'Jardin & terrasses',
        amenity_13: 'Accès mobilité réduite',
        amenity_14: '5 douches italiennes<br><small style="font-size:0.6rem;opacity:0.5">1 par chambre</small>',
        amenity_15: 'Cuisine à induction<br><small style="font-size:0.6rem;opacity:0.5">Four, micro-ondes, lave-vaisselle</small>',
        amenity_16: '4 chambres avec lit double et 1 chambre dortoir pour enfants.',
        amenity_17: 'TV satellite<br><small style="font-size:0.6rem;opacity:0.5">Chaînes FR & EN</small>',
        amenity_18: 'Sèche-linge',
        amenity_19: 'Coffre-fort',
        amenity_20: 'Moustiquaires<br><small style="font-size:0.6rem;opacity:0.5">Dans toutes les chambres</small>',
        amenity_21: 'Fer à repasser',
        amenity_22: '150m² de terrasses',
        // Rates
        rates_label: 'Tarification', rates_title: 'Tarifs <em>par saison</em>',
        rates_body: "Tarifs à la semaine pour l'ensemble de la villa — jusqu'à 12 personnes. Caution de 3 000 € / séjour, payable sur place.",
        season1: 'MARS', season1_name: '7 Mar, 2026 - 3 Apr, 2026', season1_unit: 'Par semaine',
        season1_details: "7 nights min<br>Jusqu'à 12 personnes · Charges incluses",
        season2: 'AVRIL', season2_name: '4 Apr, 2026 - 8 May, 2026', season2_unit: 'Par semaine',
        season2_details: "7 nights min<br>Jusqu'à 12 personnes · Charges incluses",
        season3: 'PRINTEMPS', season3_name: '9 May, 2026 - 29 Jun, 2026', season3_unit: 'Par semaine',
        season3_details: "5 nights min<br>Jusqu'à 12 personnes · Charges incluses",
        season4: 'ÉTÉ', season4_name: '29 Jun, 2026 - 28 Aug, 2026', season4_unit: 'Par semaine',
        season4_details: "7 nights min<br>Jusqu'à 12 personnes · Charges incluses",
        season5: 'AUTOMNE', season5_name: '30 Aug, 2026 - 16 Oct, 2026', season5_unit: 'Par semaine',
        season5_details: "5 nights min<br>Jusqu'à 12 personnes · Charges incluses",
        season6: 'TOUSSAINT', season6_name: '17 Oct, 2026 - 6 Nov, 2026', season6_unit: 'Par semaine',
        season6_details: "7 nights min<br>Jusqu'à 12 personnes · Charges incluses",
        season7: 'PRÉ-HIVER', season7_name: '7 Nov, 2026 - 18 Dec, 2026', season7_unit: 'Par semaine',
        season7_details: "7 nights min<br>Jusqu'à 12 personnes · Charges incluses",
        season8: 'VACANCES', season8_name: '19 Dec, 2026 - 1 Jan, 2027', season8_unit: 'Par semaine',
        season8_details: "7 nights min<br>Jusqu'à 12 personnes · Charges incluses",
        season9: 'MI-SAISON', season9_name: '2 Jan, 2027 - 5 Feb, 2027', season9_unit: 'Par semaine',
        season9_details: "7 nights min<br>Jusqu'à 12 personnes · Charges incluses",
        season10: 'HAUTE SAISON', season10_name: '6 Feb, 2027 - 5 Mar, 2027', season10_unit: 'Par semaine',
        season10_details: "7 nights min<br>Jusqu'à 12 personnes · Charges incluses",
        deposit: 'Frais de ménage : <strong>350 €</strong> / séjour · Caution réservation directe : <strong>3 000 €</strong> (chèque/CB) · Taxe de séjour non incluse',
        rooms_label: 'Chambres',
        rooms_title: '4 chambres & une chambre dortoir',
        rooms_body: "<p>4 chambres avec lit double - 160x200 (3x), 180x200 (1x) - et salle d'eau en suite.</p><p>1 chambre dortoir pour enfants.</p>",
        // Booking
        book_label: 'Disponibilités & Réservation',
        book_title: 'Vérifiez les dates <em style="color:var(--light)">disponibles</em>',
        book_body: 'Les dates en rouge sont déjà réservées. Sélectionnez votre arrivée puis votre départ pour obtenir le prix.',
        cal_sel: 'Sélectionné', cal_unavail: 'Indisponible', cal_avail: 'Disponible',
        unavail_banner: "⛔ Ces dates ne sont pas disponibles — elles contiennent une période déjà réservée. Veuillez choisir d'autres dates.",
        stay_label: 'Votre séjour', price_label: 'Prix total',
        select_prompt: "↑ Cliquez sur une date d'arrivée pour commencer votre sélection",
        select_prompt2: '↑ Cliquez maintenant sur votre date de départ',
        form_fname: 'Prénom *', form_lname: 'Nom *', form_email: 'Email *',
        form_phone: 'Téléphone', form_guests: 'Nombre de voyageurs *',
        form_msg: 'Message (optionnel)',
        form_ph_fname: 'Marie', form_ph_lname: 'Dupont', form_ph_email: 'marie@exemple.com',
        form_ph_phone: '+33 6 00 00 00 00', form_ph_msg: "Heure d'arrivée approximative, demandes particulières…",
        form_select: 'Sélectionner',
        form_submit: 'Envoyer ma demande de réservation →',
        guests_options: ['2 personnes', '3 personnes', '4 personnes', '5 personnes', '6 personnes', '7 personnes', '8 personnes', '9 personnes', '10 personnes', '11 personnes', '12 personnes'],
        // Reviews
        reviews: [
            {
                text: '« La vue incroyable, l\'espace de vie, la piscine et les salles de bain pour chaque chambre, la proximité de la plage et du bourg — tout était parfait. »',
                author: '— Séjour vérifié',
                source: 'Booking.com · Note : 10/10 pour l\'emplacement'
            },
            {
                text: '« Nous voulions vous dire merci pour ce séjour mémorable. Nous avons passé de magnifiques vacances dans un cadre idyllique. »',
                author: '— Olivier V.',
                source: 'villaondines.com'
            },
            {
                text: '« Quelle vue ! La villa surplombe le village des Anses d\'Arlet et la mer des Caraïbes. On ne se lasse pas du panorama depuis la terrasse. »',
                author: '— Michel M.',
                source: 'villaondines.com'
            },
            {
                text: '« La villa Les Ondines est l\'une de ces adresses uniques qui laissent des souvenirs durables. La piscine à débordement face à la mer des Caraïbes… inoubliable. »',
                author: '— Famille Bertrand',
                source: 'Archipel Évasion'
            }
        ],
        rev_label: 'Témoignages', rev_title: 'Ce que disent <em>nos hôtes</em>',
        // Attractions
        att_label: 'Aux alentours',
        att_title: 'À <em style="color:var(--light)">découvrir</em> à proximité',
        att1_name: "Plage de l'Anse d'Arlet", att1_dist: '🚶 150m · 4 min à pied',
        att1_desc: "La plage du village, adossée à l'église Saint-Henri du 18ème siècle — carte postale emblématique de Martinique. Snorkeling exceptionnel, tortues marines visibles à l'année.",
        att2_name: 'Ti Sable · Grande Anse', att2_dist: '🚗 5 min · 2.2 km',
        att2_desc: "Restaurant prisé en bord de mer à Grande Anse d'Arlet. Cuisine locale, poissons frais du jour et salades exotiques dans un cadre idyllique face à la mer.",
        att3_name: 'Anse Dufour & Anse Noire', att3_dist: '🚗 10 min · 4.1 km',
        att3_desc: "Sites de plongée et snorkeling parmi les plus réputés de Martinique. Criques préservées avec tortues marines, coraux colorés et poissons tropicaux.",
        att4_name: "Mémorial de l'Anse Caffard", att4_dist: '🚗 10 min',
        att4_desc: "Monument émouvant dédié aux victimes de la traite négrière. Sculptures face à la mer, entre Diamant et Anses d'Arlet.",
        att5_name: 'La Savane des Esclaves', att5_dist: '🚗 10 min · 6 km',
        att5_desc: "Musée à ciel ouvert retraçant la vie des esclaves africains en Martinique. Reconstitution de cases créoles et jardins ethnobotaniques.",
        // Contact
        contact_label: 'Contact direct', contact_title: 'Prenez <em>contact</em>',
        contact_meta: "Lotissement la Batterie · 97217 Les Anses-d'Arlet · Martinique (France)<br>GPS : <strong>14.4871°N, 61.0781°O</strong> · Arrêt de bus La Batterie à 1 min à pied<br><strong>Check-in :</strong> Contactez-nous 1 semaine avant pour donner votre n° de vol et heure d'arrivée · Réponse sous 24h",
        footer_copy: "© 2026 Villa les Ondines · Les Anses-d'Arlet · Martinique",
    },
    en: {
        nav_about: 'The Villa', nav_gallery: 'Photos', nav_amenities: 'Amenities',
        nav_rates: 'Rates', nav_reviews: 'Reviews', nav_book: 'Book Now',
        hero_eyebrow: "Martinique · Anses d'Arlet · 5★ Villa",
        hero_title: 'Villa<br><em>les Ondines</em>',
        hero_sub: "350m² entirely facing the Caribbean Sea. Creole architecture, infinity pool and panoramic views over the picturesque village of Anses d'Arlet.",
        hero_badge1: '⭐ 4,92/5 Airbnb', hero_badge2: '🏆 Official 5★ rating',
        hero_badge3: '🚶 150m from the beach', hero_badge4: '✈️ 33km from airport',
        hero_cta1: 'Check availability', hero_cta2: 'Discover the villa',
        stat1_label: 'm² villa', stat2_label: 'Bedrooms', stat3_label: 'Guests',
        scroll_hint: 'Discover',
        about_label: 'About the property',
        about_title: 'Over 350 m²<br><em>facing the horizon</em>',
        about_p1: "Arriving at Villa les Ondines takes your breath away. Entirely facing the open sea, it offers an extraordinary view over the crystal-clear waters of the Caribbean. Between shades of blue, lush hills and the picturesque village, the scenery is simply spectacular.",
        about_p2: "Blending Creole architecture, modern materials and contemporary colours, the villa is a charming retreat where the magic works quickly. The living room and kitchen open wide onto the infinity pool, where sky, sea and horizon seem to merge into one.",
        feat1: 'Living space', feat2: 'Bedrooms (5 bathrooms)', feat3: 'Infinity pool',
        feat4: 'Max guests', feat5: 'From the beach', feat6: 'From FDF airport',
        spec1: 'Renovated', spec2: 'Official rating', spec3: 'Bathrooms',
        spec4: 'Free WiFi & Parking', spec5: 'Accessible',
        gal_label: 'Photo gallery', gal_title: 'The villa <em>in pictures</em>',
        am_label: 'Comfort & amenities',
        am_title: 'Everything for a <em style="color:var(--light)">perfect</em> stay',
        am_body: "Each bedroom has its own en-suite bathroom with walk-in shower and hairdryer. The villa is fully air-conditioned and soundproofed throughout.",
        rule1: '🚬 Non-smoking', rule2: '🐾 No pets',
        rule3: '👫 Groups under 22 not accepted', rule4: '👶 Children welcome · Cot available',
        amenity_1: 'Infinity pool<br><small style="font-size:0.6rem;opacity:0.5">5.5 × 3.5m · depth 0.8–1.6m</small>',
        amenity_2: 'Outdoor bathtub',
        amenity_3: 'Panoramic sea view',
        amenity_4: 'Air conditioning<br><small style="font-size:0.6rem;opacity:0.5">All rooms</small>',
        amenity_5: 'Equipped kitchen<br><small style="font-size:0.6rem;opacity:0.5">Dishwasher included</small>',
        amenity_6: 'Washing machine',
        amenity_7: 'High-speed WiFi<br><small style="font-size:0.6rem;opacity:0.5">Free</small>',
        amenity_8: 'Flat-screen TV',
        amenity_9: 'Private parking<br><small style="font-size:0.6rem;opacity:0.5">Free</small>',
        amenity_10: 'Soundproof windows',
        amenity_11: 'Outdoor barbecue',
        amenity_12: 'Garden & terraces',
        amenity_13: 'Accessible / Mobility access',
        amenity_14: '5 walk-in showers<br><small style="font-size:0.6rem;opacity:0.5">1 per bedroom</small>',
        amenity_15: 'Induction kitchen<br><small style="font-size:0.6rem;opacity:0.5">Oven, microwave, dishwasher</small>',
        amenity_16: '4 rooms with double beds and 1 dormitory room for children.',
        amenity_17: 'Satellite TV<br><small style="font-size:0.6rem;opacity:0.5">FR & EN channels</small>',
        amenity_18: 'Tumble dryer',
        amenity_19: 'Safe',
        amenity_20: 'Mosquito nets<br><small style="font-size:0.6rem;opacity:0.5">In all bedrooms</small>',
        amenity_21: 'Iron',
        amenity_22: '150m² of terraces',
        rates_label: 'Pricing', rates_title: 'Rates <em>by season</em>',
        rates_body: "Weekly rates for the entire villa — up to 12 guests. Security deposit of €3,000 per stay, payable on arrival.",
        season1: 'MARCH', season1_name: '7 Mar, 2026 - 3 Apr, 2026', season1_unit: 'Per week',
        season1_details: '7 nights min<br>Up to 12 guests<br>All charges included',
        season2: 'APRIL', season2_name: '4 Apr, 2026 - 8 May, 2026', season2_unit: 'Per week',
        season2_details: '7 nights min<br>Up to 12 guests<br>All charges included',
        season3: 'SPRING', season3_name: '9 May, 2026 - 29 Jun, 2026', season3_unit: 'Per week',
        season3_details: '5 nights min<br>Up to 12 guests<br>All charges included',
        season4: 'SUMMER', season4_name: '29 Jun, 2026 - 28 Aug, 2026', season4_unit: 'Per week',
        season4_details: '7 nights min<br>Up to 12 guests<br>All charges included',
        season5: 'AUTUMN', season5_name: '30 Aug, 2026 - 16 Oct, 2026', season5_unit: 'Per week',
        season5_details: '5 nights min<br>Up to 12 guests<br>All charges included',
        season6: 'FALL BREAK', season6_name: '17 Oct, 2026 - 6 Nov, 2026', season6_unit: 'Per week',
        season6_details: '7 nights min<br>Up to 12 guests<br>All charges included',
        season7: 'PRE-WINTER', season7_name: '7 Nov, 2026 - 18 Dec, 2026', season7_unit: 'Per week',
        season7_details: '7 nights min<br>Up to 12 guests<br>All charges included',
        season8: 'HOLIDAYS', season8_name: '19 Dec, 2026 - 1 Jan, 2027', season8_unit: 'Per week',
        season8_details: '7 nights min<br>Up to 12 guests<br>All charges included',
        season9: 'MID SEASON', season9_name: '2 Jan, 2027 - 5 Feb, 2027', season9_unit: 'Per week',
        season9_details: '7 nights min<br>Up to 12 guests<br>All charges included',
        season10: 'HIGH SEASON', season10_name: '6 Feb, 2027 - 5 Mar, 2027', season10_unit: 'Per week',
        season10_details: '7 nights min<br>Up to 12 guests<br>All charges included',
        deposit: 'Cleaning fee: <strong>€350</strong> per stay · Direct booking deposit: <strong>€3,000</strong> (cheque/CC) · Tourist tax not included',
        rooms_label: 'Bedrooms',
        rooms_title: '4 double beds & a dormitory',
        rooms_body: "<p>4 double bedrooms with beds - 160x200 (3x), 180x200 (1x) - each with an en-suite shower room.</p><p>1 dormitory room suitable for children.</p>",
        book_label: 'Availability & Booking',
        book_title: 'Check <em style="color:var(--light)">available</em> dates',
        book_body: 'Dates in red are already reserved, synced in real time. Select your arrival then departure to see the exact price.',
        cal_sel: 'Selected', cal_range: 'In range', cal_unavail: 'Unavailable', cal_avail: 'Available',
        unavail_banner: '⛔ These dates are not available — they overlap a reserved period. Please choose different dates.',
        stay_label: 'Your stay', price_label: 'Total price',
        select_prompt: '↑ Click on an arrival date to start your selection',
        select_prompt2: '↑ Now click your departure date',
        form_fname: 'First name *', form_lname: 'Last name *', form_email: 'Email *',
        form_phone: 'Phone', form_guests: 'Number of guests *',
        form_msg: 'Message (optional)',
        form_ph_fname: 'Marie', form_ph_lname: 'Dupont', form_ph_email: 'marie@example.com',
        form_ph_phone: '+33 6 00 00 00 00', form_ph_msg: 'Approximate arrival time, special requests…',
        form_select: 'Select',
        form_submit: 'Send booking request →',
        guests_options: ['2 guests', '3 guests', '4 guests', '5 guests', '6 guests', '7 guests', '8 guests', '9 guests', '10 guests', '11 guests', '12 guests'],
        reviews: [
            {
                text: '"Amazing view, the living space, the pool and the en-suite bathrooms for each bedroom, proximity to the beach and the village — everything was perfect."',
                author: '— Verified stay',
                source: 'Booking.com · Rating: 10/10 for location'
            },
            {
                text: '"We wanted to say thank you for this memorable stay. We had a wonderful holiday in an idyllic setting."',
                author: '— Olivier V.',
                source: 'villaondines.com'
            },
            {
                text: '"What a view! The villa overlooks the village of Anse d\'Arlet and the Caribbean Sea. We never tired of the panorama from the terrace."',
                author: '— Michel M.',
                source: 'villaondines.com'
            },
            {
                text: '"Villa Les Ondines is one of those unique addresses that leave lasting memories. The infinity pool facing the Caribbean Sea… unforgettable."',
                author: '— Famille Bertrand',
                source: 'Archipel Évasion'
            }
        ],
        rev_label: 'Testimonials', rev_title: 'What our <em>guests say</em>',
        att_label: 'Nearby',
        att_title: '<em style="color:var(--light)">Discover</em> what\'s around',
        att1_name: "Anse d'Arlet Beach", att1_dist: '🚶 150m · 4 min walk',
        att1_desc: "The village beach, backed by the 18th-century Saint-Henri church — the iconic postcard of Martinique. Exceptional snorkelling, sea turtles visible year-round.",
        att2_name: 'Ti Sable · Grande Anse', att2_dist: '🚗 5 min · 2.2 km',
        att2_desc: "Popular beachside restaurant at Grande Anse d'Arlet. Fresh local fish, exotic salads and spectacular sunsets right over the sea.",
        att3_name: 'Anse Dufour & Anse Noire', att3_dist: '🚗 10 min · 4.1 km',
        att3_desc: "Among Martinique's finest diving and snorkelling spots. Sheltered coves with sea turtles, colourful coral and abundant tropical fish.",
        att4_name: "Anse Caffard Memorial", att4_dist: '🚗 10 min',
        att4_desc: "A moving monument to the victims of the slave trade. Sculptures facing the sea between Le Diamant and Anses d'Arlet.",
        att5_name: "La Savane des Esclaves", att5_dist: '🚗 10 min · 6 km',
        att5_desc: "Open-air museum tracing the lives of enslaved Africans in Martinique. Reconstructed Creole huts and ethnobotanical gardens.",
        contact_label: 'Direct contact', contact_title: 'Get in <em>touch</em>',
        contact_meta: "Lotissement la Batterie · 97217 Les Anses-d'Arlet · Martinique (France)<br>GPS: <strong>14.4871°N, 61.0781°E</strong> · Bus stop La Batterie, 1 min walk<br><strong>Check-in:</strong> Contact us 1 week before with your flight number and arrival time · Response within 24h",
        footer_copy: "© 2026 Villa les Ondines · Les Anses-d'Arlet · Martinique",
    }
};

function t(key) { return T[lang][key] || T.fr[key] || key; }

function applyLang() {
    const l = lang;

    // Toggle button label (guarded)
    const __langBtn = document.getElementById && document.getElementById('lang-toggle');
    if (__langBtn) __langBtn.textContent = l === 'fr' ? 'EN' : 'FR';
    document.documentElement.lang = l;

    try {
        // data-i18n elements
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const k = el.dataset.i18n;
            if (T[l] && T[l][k] !== undefined) el.innerHTML = T[l][k];
        });

        // Hero
        document.querySelector('.hero-eyebrow').innerHTML = t('hero_eyebrow');
        document.querySelector('.hero-title').innerHTML = t('hero_title');
        document.querySelector('.hero-sub').textContent = t('hero_sub');
        const badges = document.querySelectorAll('.badge');
        if (badges[0]) badges[0].textContent = t('hero_badge1');
        if (badges[1]) badges[1].textContent = t('hero_badge2');
        if (badges[2]) badges[2].textContent = t('hero_badge3');
        if (badges[3]) badges[3].textContent = t('hero_badge4');
        const heroActions = document.querySelectorAll('.hero-actions a');
        if (heroActions[0]) heroActions[0].textContent = t('hero_cta1');
        if (heroActions[1]) heroActions[1].textContent = t('hero_cta2');
        const statLabels = document.querySelectorAll('.stat-label');
        if (statLabels[0]) statLabels[0].textContent = t('stat1_label');
        if (statLabels[1]) statLabels[1].textContent = t('stat2_label');
        if (statLabels[2]) statLabels[2].textContent = t('stat3_label');
        document.querySelector('.scroll-hint').childNodes[0].textContent = t('scroll_hint');

        // About
        document.querySelector('.about-text .section-label').textContent = t('about_label');
        document.querySelector('.about-text .section-title').innerHTML = t('about_title');
        const aboutPs = document.querySelectorAll('.about-text .section-body');
        if (aboutPs[0]) aboutPs[0].textContent = t('about_p1');
        if (aboutPs[1]) aboutPs[1].textContent = t('about_p2');
        const featLabels = document.querySelectorAll('.feature .feature-label');
        const fkeys = ['feat1', 'feat2', 'feat3', 'feat4', 'feat5', 'feat6'];
        featLabels.forEach((el, i) => { if (fkeys[i]) el.textContent = t(fkeys[i]); });

        // Spec keys
        const specKeys = document.querySelectorAll('.spec-key');
        const sk = ['spec1', 'spec2', 'spec3', 'spec4', 'spec5'];
        specKeys.forEach((el, i) => { if (sk[i]) el.textContent = t(sk[i]); });

        // Gallery
        document.querySelector('.gallery-header .section-label').textContent = t('gal_label');
        document.querySelector('.gallery-header .section-title').innerHTML = t('gal_title');

        // Amenities
        document.querySelector('.amenities .section-label').textContent = t('am_label');
        document.querySelector('.amenities .section-title').innerHTML = t('am_title');
        document.querySelector('.amenities .section-body').textContent = t('am_body');
        const rules = document.querySelectorAll('.rule');
        const rk = ['rule1', 'rule2', 'rule3', 'rule4'];
        rules.forEach((el, i) => { if (rk[i]) el.textContent = t(rk[i]); });

        // Rates
        document.querySelector('.rates-header .section-label').textContent = t('rates_label');
        document.querySelector('.rates-header .section-title').innerHTML = t('rates_title');
        document.querySelector('.rates-header .section-body').textContent = t('rates_body');
        const rateCards = document.querySelectorAll('.rate-card');
        rateCards.forEach((card, i) => {
            // season label key (season1, season2, ...)
            const keyBase = 'season' + (i + 1);
            const seasonLabel = T[l] && T[l][keyBase];
            const seasonNameEl = card.querySelector('.rate-season');
            if (seasonNameEl) {
                if (seasonLabel) seasonNameEl.textContent = seasonLabel;
                else if (SEASONS[i] && SEASONS[i].name) seasonNameEl.textContent = SEASONS[i].name;
            }

            // Localize the date range using the SEASONS array when available
            const nameEl = card.querySelector('.rate-name');
            if (nameEl && SEASONS[i]) {
                try {
                    const locale = l === 'en' ? 'en-GB' : 'fr-FR';
                    const opts = { day: 'numeric', month: 'short', year: 'numeric' };
                    const s = new Date(SEASONS[i].start);
                    const e = new Date(SEASONS[i].end);
                    nameEl.textContent = `${s.toLocaleDateString(locale, opts)} - ${e.toLocaleDateString(locale, opts)}`;
                } catch (e) {
                    // fallback: leave existing text
                }
            }

            // Unit and details translate — use season1 keys as canonical where appropriate
            const unitEl = card.querySelector('.rate-unit');
            if (unitEl) unitEl.textContent = t('season1_unit');
            const detailsEl = card.querySelector('.rate-details');
            if (detailsEl) detailsEl.innerHTML = t('season1_details');
        });
        document.querySelector('.deposit-note').innerHTML = t('deposit');

        // Booking
        document.querySelector('.booking .section-label').textContent = t('book_label');
        document.querySelector('.booking .section-title').innerHTML = t('book_title');
        document.querySelector('.booking .section-body').textContent = t('book_body');
        // Update legend labels (dot is separate element, labels have data-i18n)
        const legendLabels = document.querySelectorAll('.cal-legend .leg-label');
        const legendKeys = ['cal_sel', 'cal_unavail', 'cal_avail'];
        legendLabels.forEach((lbl, i) => {
            if (!legendKeys[i]) return;
            try { lbl.innerHTML = t(legendKeys[i]); } catch (e) { /* ignore */ }
        });
        document.getElementById('unavail-banner').textContent = t('unavail_banner');
        if (document.getElementById('stay-label')) document.getElementById('stay-label').textContent = t('stay_label');
        if (document.getElementById('price-label')) document.getElementById('price-label').textContent = t('price_label');
        const sp = document.getElementById('select-prompt');
        if (sp && sp.style.display !== 'none') {
            sp.textContent = selStart ? t('select_prompt2') : t('select_prompt');
        }

        // Form labels & placeholders
        const formLabels = document.querySelectorAll('#contact-form label');
        const lk = ['form_fname', 'form_lname', 'form_email', 'form_phone', 'form_guests', 'form_msg'];
        formLabels.forEach((el, i) => { if (lk[i]) el.textContent = t(lk[i]); });
        const inp = id => document.getElementById(id);
        if (inp('fname')) inp('fname').placeholder = t('form_ph_fname');
        if (inp('lname')) inp('lname').placeholder = t('form_ph_lname');
        if (inp('email')) inp('email').placeholder = t('form_ph_email');
        if (inp('phone')) inp('phone').placeholder = t('form_ph_phone');
        if (inp('message')) inp('message').placeholder = t('form_ph_msg');
        const guestSel = inp('guests');
        if (guestSel) {
            const opts = t('guests_options');
            Array.from(guestSel.options).forEach((opt, i) => {
                if (i === 0) opt.textContent = t('form_select');
                else if (opts[i - 1]) opt.textContent = opts[i - 1];
            });
        }
        document.querySelector('.form-submit').textContent = t('form_submit');

        // Reviews
        document.querySelector('.reviews-header .section-label').textContent = t('rev_label');
        document.querySelector('.reviews-header .section-title').innerHTML = t('rev_title');
        // Translate individual review cards if translations are provided
        try {
            const reviewsData = (T[l] && T[l].reviews) ? T[l].reviews : [];
            const reviewCards = document.querySelectorAll('.review-card');
            reviewCards.forEach((card, i) => {
                const r = reviewsData[i];
                if (!r) return;
                const txt = card.querySelector('.review-text');
                const auth = card.querySelector('.review-author');
                const src = card.querySelector('.review-source');
                if (txt) txt.textContent = r.text;
                if (auth) auth.textContent = r.author;
                if (src) src.textContent = r.source;
            });
        } catch (e) { /* ignore if structure differs */ }

        // Attractions
        document.querySelector('.attractions-header .section-label').textContent = t('att_label');
        document.querySelector('.attractions-header .section-title').innerHTML = t('att_title');
        const attCards = document.querySelectorAll('.att-card');
        const ak = ['att1', 'att2', 'att3', 'att4', 'att5'];
        attCards.forEach((card, i) => {
            if (!ak[i]) return;
            const name = card.querySelector('.att-name');
            const dist = card.querySelector('.att-dist');
            const desc = card.querySelector('.att-desc');
            if (name) name.textContent = t(ak[i] + '_name');
            if (dist) dist.textContent = t(ak[i] + '_dist');
            if (desc) desc.textContent = t(ak[i] + '_desc');
        });

        // Contact
        document.querySelector('.contact .section-label').textContent = t('contact_label');
        document.querySelector('.contact .section-title').innerHTML = t('contact_title');
        document.querySelector('.contact-meta').innerHTML = t('contact_meta');

        // Footer
        document.querySelector('.footer-copy').textContent = t('footer_copy');
        const footerLinks = document.querySelectorAll('.footer-links a');
        const fln = ['nav_about', 'nav_gallery', 'nav_amenities', 'nav_rates', 'nav_reviews', 'nav_book', 'contact_label'];
        footerLinks.forEach((el, i) => { if (fln[i]) el.textContent = t(fln[i]); });

        // Rebuild calendar labels (month names change locale)
        buildCalendars();

        // Re-run updateSummary if dates are selected
        if (selStart && selEnd) updateSummary();
    } catch (err) {
        console.error('applyLang() error:', err);
    }
}

function toggleLang() {
    const old = lang;
    const nw = old === 'fr' ? 'en' : 'fr';
    console.log('toggleLang()', old, '->', nw);
    lang = nw;
    applyLang();
}

// ── INIT ─────────────────────────────────────────────────────────
// Expose for inline handlers just in case and attach a safe event listener
// Expose for inline handlers just in case and attach a safe event listener
window.toggleLang = toggleLang;
const __langBtn = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('lang-toggle') : null;
if (__langBtn) {
    console.log('lang-toggle: found button element', __langBtn);
    try { __langBtn.removeAttribute('onclick'); } catch (e) { }
    try {
        __langBtn.addEventListener('click', function (e) { try { e.preventDefault(); } catch (er) { } console.log('lang-toggle clicked (direct)'); toggleLang(); });
        __langBtn.addEventListener('pointerdown', function (e) { try { e.preventDefault(); } catch (er) { } console.log('lang-toggle pointerdown'); toggleLang(); });
        __langBtn.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { try { e.preventDefault(); } catch (er) { } console.log('lang-toggle keydown', e.key); toggleLang(); } });
    } catch (ex) { console.warn('lang-toggle: failed to attach direct listeners', ex); }
} else {
    console.log('lang-toggle: button not found at init');
}
// Delegated handler as a fallback if the button is moved or not present at init
document.addEventListener('click', function (e) {
    const btn = e.target && e.target.closest ? e.target.closest('#lang-toggle') : null;
    if (btn) {
        try { e.preventDefault(); } catch (er) { }
        console.log('lang-toggle clicked (delegated)');
        toggleLang();
    }
});

// Apply current language then initialize UI
console.log('i18n init — current lang:', lang);
applyLang();
buildCalendars();
loadICal();
window.addEventListener('resize', buildCalendars);


