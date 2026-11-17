// Builds the villa's price seasons from the official French school calendar
// (Ministère de l'Éducation nationale open data, metropolitan zones A/B/C only).
// Returns { seasons: [{ key, start, end }], coveredUntil } — dates are 'YYYY-MM-DD', end inclusive.
//
// Rules:
//   automne    first Saturday on/after 2 Sept (≈ Saturday after la rentrée)
//   (holiday starts snap to the first Saturday on/after the official start)
//   toussaint  Toussaint holidays start, always 3 weeks
//   prehiver   Toussaint + 3 weeks → Noël
//   vacances   Noël start → Saturday before school restarts
//   misaison   → winter holidays (first zone off)
//   haute      first zone off → Saturday before the last zone restarts
//   mars       → first Saturday of April
//   avril      first Saturday of April → first Saturday on/after 3 May
//   printemps  → summer holidays start
//   ete        summer start → next automne

const API = 'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/exports/json';

// ── date helpers (UTC day numbers, no timezone drift) ──
const DAY = 86400000;
const toDay = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const toStr = t => new Date(t).toISOString().slice(0, 10);
const dow = t => new Date(t).getUTCDay();                                  // 6 = Saturday
const satOnOrAfter = t => t + ((6 - dow(t) + 7) % 7) * DAY;
const satStrictlyBefore = t => t - (((dow(t) - 6 + 7) % 7) || 7) * DAY;
const ymd = (y, m, d) => Date.UTC(y, m - 1, d);

// API dates look like "2026-10-16T22:00:00+00:00" (= 17 Oct, Paris time)
function parisDay(v) {
    if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return toDay(v);
    const d = new Date(v);
    if (isNaN(d)) return null;
    return toDay(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d));
}

function kind(desc) {
    const s = (desc || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’]/g, ' ');
    if (s.includes('toussaint')) return 'toussaint';
    if (s.includes('noel')) return 'noel';
    if (s.includes('hiver')) return 'hiver';
    if (/\bete\b/.test(s)) return 'ete';
    return null;
}

export function buildSeasons(records) {
    // Collect per school year: earliest start and latest end of each holiday across zones A/B/C
    const years = {};
    for (const r of records) {
        if (!['Zone A', 'Zone B', 'Zone C'].includes(r.zones)) continue;
        if ((r.population || '').toLowerCase().includes('enseignant')) continue;
        const k = kind(r.description);
        const y = parseInt(r.annee_scolaire, 10);
        if (!k || !y) continue;
        const s = parisDay(r.start_date), e = parisDay(r.end_date);
        const h = ((years[y] ||= {})[k] ||= { start: Infinity, end: -Infinity });
        if (s) h.start = Math.min(h.start, s);
        if (e && e > (s || 0)) h.end = Math.max(h.end, e);
    }

    const seasons = [];
    const first = Math.min(...Object.keys(years).map(Number));
    for (let y = first; years[y]; y++) {
        const h = years[y];
        const ok = x => x && isFinite(x.start);
        if (!ok(h.toussaint) || !ok(h.noel) || !isFinite(h.noel.end) || !ok(h.hiver) || !isFinite(h.hiver.end) || !ok(h.ete)) break;

        const T = satOnOrAfter(h.toussaint.start);
        const b = [
            ['automne',   satOnOrAfter(ymd(y, 9, 2))],
            ['toussaint', T],
            ['prehiver',  T + 21 * DAY],
            ['vacances',  satOnOrAfter(h.noel.start)],
            ['misaison',  satStrictlyBefore(h.noel.end)],
            ['haute',     satOnOrAfter(h.hiver.start)],
            ['mars',      satStrictlyBefore(h.hiver.end)],
            ['avril',     satOnOrAfter(ymd(y + 1, 4, 1))],
            ['printemps', satOnOrAfter(ymd(y + 1, 5, 3))],
            ['ete',       satOnOrAfter(h.ete.start)],
            [null,        satOnOrAfter(ymd(y + 1, 9, 2))],
        ];
        if (b.some((x, i) => i && x[1] <= b[i - 1][1])) break;   // inconsistent data → stop here
        for (let i = 0; i < b.length - 1; i++) {
            seasons.push({ key: b[i][0], start: toStr(b[i][1]), end: toStr(b[i + 1][1] - DAY) });
        }
    }
    return { seasons, coveredUntil: seasons.length ? seasons[seasons.length - 1].end : null };
}

export async function handler() {
    const now = new Date();
    const y0 = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    const list = [0, 1, 2, 3, 4].map(i => `"${y0 + i}-${y0 + i + 1}"`).join(',');
    const params = new URLSearchParams({
        select: 'description,population,start_date,end_date,zones,annee_scolaire',
        where: `annee_scolaire IN (${list}) AND zones IN ("Zone A","Zone B","Zone C")`,
    });
    try {
        const res = await fetch(`${API}?${params}`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = buildSeasons(await res.json());
        if (!data.seasons.length) throw new Error('No complete school year in data');
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=3600',
                // Netlify CDN: cache a day, keep serving the last good copy for 30 days if the API is down
                'Netlify-CDN-Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=2592000, durable',
            },
            body: JSON.stringify(data),
        };
    } catch (err) {
        return { statusCode: 502, headers: { 'Cache-Control': 'no-store' }, body: 'Seasons fetch failed: ' + err.message };
    }
}
