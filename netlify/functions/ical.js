export async function handler() {
  const ICAL_URL = 'https://calendar.avantio.pro/v1/174e5151-9f4e-4885-a2b7-85574d33fd68.ics';
  try {
    const res = await fetch(ICAL_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const ics = await res.text();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/calendar',
        'Cache-Control': 'public, max-age=900',
      },
      body: ics,
    };
  } catch (err) {
    return { statusCode: 502, body: 'iCal fetch failed: ' + err.message };
  }
}