const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

const SHEET_ID = '1dO027VAM1PwKrv07DkU1tIPMKTbfRMtmr9gU9jppl4s';
const SHEET_GID = '1581051441';
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;
const USER_AGENT = 'VedMapIntegration/1.0 (event map)';

const clean = (value) => String(value ?? '')
  .replace(/^\uFEFF/, '')
  .replace(/\r/g, '')
  .trim();

const comingSoon = (value) => {
  const text = clean(value);
  return /\b(?:TBA|TBD)\b/gi.test(text)
    ? text.replace(/\b(?:TBA|TBD)\b/gi, 'Coming Soon')
    : text;
};

const isPublicEvent = (value) => /^yes/i.test(clean(value));
const validCoordinates = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon)
  && lat >= 18 && lat <= 72 && lon >= -180 && lon <= -60;

async function geocode(value, cache) {
  const search = clean(value);
  if (!search || search.length < 2) return null;
  if (cache.has(search)) return cache.get(search);

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(search)}`,
      { headers: { 'User-Agent': USER_AGENT } }
    );
    
    if (!response.ok) {
      cache.set(search, null);
      return null;
    }
    
    const results = await response.json();
    if (!results[0]) {
      cache.set(search, null);
      return null;
    }

    const lat = Number(results[0].lat);
    const lon = Number(results[0].lon);
    const coordinates = validCoordinates(lat, lon) ? { lat, lon } : null;
    cache.set(search, coordinates);
    return coordinates;
  } catch (e) {
    cache.set(search, null);
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const response = await fetch(SHEET_CSV_URL, { headers: { 'User-Agent': USER_AGENT } });
    const csvText = await response.text();

    const rows = parse(csvText, {
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true,
      trim: true
    });

    if (!rows.length) throw new Error('No rows');

    const events = [];
    const skipReasons = {};
    const geocodeCache = new Map();

    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index] || [];
      
      const title = comingSoon(row[11]);
      const hostOrganization = comingSoon(row[2]);
      const dateValue = comingSoon(row[10]);
      const time = comingSoon(row[12]);
      const location = comingSoon(row[13]);
      const publicAnswer = clean(row[14]);
      const browserUrl = comingSoon(row[15]);
      const description = comingSoon(row[17]);
      const zip = clean(row[7]);
      const cityState = clean(row[3]); // City and state

      if (!title) {
        skipReasons['no_title'] = (skipReasons['no_title'] || 0) + 1;
        continue;
      }

      if (!isPublicEvent(publicAnswer)) {
        skipReasons['not_public'] = (skipReasons['not_public'] || 0) + 1;
        continue;
      }

      // Try: location → city/state → ZIP
      let coordinates = await geocode(location, geocodeCache);
      if (!coordinates && cityState) {
        coordinates = await geocode(cityState, geocodeCache);
      }
      if (!coordinates && zip) {
        coordinates = await geocode(zip, geocodeCache);
      }
      
      if (!coordinates) {
        skipReasons['geocode_failed'] = (skipReasons['geocode_failed'] || 0) + 1;
        continue;
      }

      events.push({
        id: `${index}-${title}`,
        title,
        hostOrganization,
        date: dateValue,
        time,
        description,
        address: location,
        browserUrl,
        city: '',
        state: '',
        zip,
        lat: coordinates.lat,
        lon: coordinates.lon
      });
    }

    return res.status(200).json({ 
      count: events.length, 
      skipReasons,
      data: events 
    });
  } catch (error) {
    return res.status(500).json({ error: error.message, data: [] });
  }
};
