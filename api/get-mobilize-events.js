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

const isPublicEvent = (value) => /^(yes|y|open|public|available)$/i.test(clean(value));
const validCoordinates = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon)
  && lat >= 18 && lat <= 72 && lon >= -180 && lon <= -60;

function extractDates(value) {
  const text = comingSoon(value).replace(/^(yes|no)\s*,?\s*/i, '');
  const matches = text.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:,\s*\d{4})?|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g);
  return matches ? [...new Set(matches.map(clean))].join(', ') : text;
}

function findColumn(headers, patterns, fallback) {
  const index = headers.findIndex((header) => {
    const text = clean(header).toLowerCase();
    return patterns.some((pattern) => pattern.test(text));
  });
  return index === -1 ? fallback : index;
}

async function geocode(value, cache) {
  const search = clean(value);
  if (!search) return null;
  if (cache.has(search)) return cache.get(search);

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(search)}`,
    { headers: { 'User-Agent': USER_AGENT } }
  );
  if (!response.ok) return null;
  const results = await response.json();
  if (!results[0]) return null;

  const lat = Number(results[0].lat);
  const lon = Number(results[0].lon);
  const coordinates = validCoordinates(lat, lon) ? { lat, lon } : null;
  cache.set(search, coordinates);
  return coordinates;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const response = await fetch(SHEET_CSV_URL, { headers: { 'User-Agent': USER_AGENT } });
    const csvText = await response.text();
    if (!response.ok || /^\s*<!doctype html|^\s*<html/i.test(csvText)) {
      throw new Error(`Google Sheet is not publicly readable (HTTP ${response.status})`);
    }

    const rows = parse(csvText, {
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true,
      trim: true
    });
    if (!rows.length) throw new Error('The Google Sheet returned no rows');

    // The response sheet includes title/letter rows before its header row.
    // Locate the header instead of relying on a fixed row number.
    const headerIndex = rows.findIndex((row) => row.some((cell) =>
      /event|title|location|public|organization/i.test(clean(cell))
    ));
    const headers = headerIndex >= 0 ? rows[headerIndex] : [];
    const firstDataRow = headerIndex >= 0 ? headerIndex + 1 : 0;

    // Header matching handles renamed columns; the fallbacks preserve the
    // established form layout (C, K, L, M, N, O, P, R, Y).
    const hostColumn = findColumn(headers, [/host/, /organization/], 2);
    const dateColumn = findColumn(headers, [/date/], 10);
    const titleColumn = findColumn(headers, [/event.*name/, /^title$/, /event/], 11);
    const timeColumn = findColumn(headers, [/time/], 12);
    const locationColumn = findColumn(headers, [/location/, /address/], 13);
    const publicColumn = findColumn(headers, [/public/, /visibility/, /available/], 14);
    const urlColumn = findColumn(headers, [/registration/, /browser/, /url/, /link/], 15);
    const descriptionColumn = findColumn(headers, [/description/, /details/], 17);
    const zipColumn = findColumn(headers, [/zip/, /postal/], 24);

    const events = [];
    let skipped = 0;
    const geocodeCache = new Map();

    for (let index = firstDataRow; index < rows.length; index += 1) {
      const row = rows[index] || [];
      const title = comingSoon(row[titleColumn]);
      const hostOrganization = comingSoon(row[hostColumn]);
      const dateValue = comingSoon(row[dateColumn]);
      const time = comingSoon(row[timeColumn]);
      const location = comingSoon(row[locationColumn]);
      const publicAnswer = clean(row[publicColumn]);
      const browserUrl = comingSoon(row[urlColumn]);
      const description = comingSoon(row[descriptionColumn]);
      const zip = clean(row[zipColumn]);

      if (!title || !isPublicEvent(publicAnswer)) {
        skipped += 1;
        continue;
      }

      // Prefer the complete location; fall back to ZIP when only ZIP is supplied.
      const coordinates = await geocode(location || zip, geocodeCache)
        || await geocode(zip, geocodeCache);
      if (!coordinates) {
        skipped += 1;
        continue;
      }

      events.push({
        id: `${index}-${title}`,
        title,
        hostOrganization,
        date: extractDates(dateValue),
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

    return res.status(200).json({ source: SHEET_CSV_URL, count: events.length, skipped, data: events });
  } catch (error) {
    console.error('Error loading Google Sheet events:', error);
    return res.status(500).json({ error: error.message, data: [] });
  }
};
