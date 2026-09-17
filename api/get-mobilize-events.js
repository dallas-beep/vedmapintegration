const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

const SHEET_ID = '1DJgMiQT6oMxBvdKFK6bha2EEFkJrNrXYU8U0dEMDhhs';
const SHEET_GID = '0';
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;

const clean = (value) => String(value ?? '').replace(/^\uFEFF/, '').replace(/\r/g, '').trim();
const isPublicEvent = (value) => /^(yes|y|open|public|available)$/i.test(clean(value));
const validCoordinates = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && lat >= 18 && lat <= 72 && lon >= -180 && lon <= -60;

const isFullStreetAddress = (value) => {
  const text = clean(value);
  if (!text) return false;
  return /\d+\s+/.test(text) && /\b(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|lane|ln|way|court|ct|parkway|pkwy|circle|cir|highway|hwy|trail|trl|place|pl)\b/i.test(text);
};

function extractDates(value) {
  const text = clean(value).replace(/^(yes|no)\s*,?\s*/i, '');
  const matches = text.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:,\s*\d{4})?|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/gi);
  return matches ? [...new Set(matches.map(clean))].join(', ') : '';
}

async function geocodeZip(zipcode) {
  const zip = clean(zipcode).match(/\b\d{5}(?:-\d{4})?\b/);
  if (!zip) return null;
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&postalcode=${encodeURIComponent(zip[0])}`, {
    headers: { 'User-Agent': 'VedMapIntegration/1.0' }
  });
  const results = await response.json();
  if (!results[0]) return null;
  const lat = Number(results[0].lat);
  const lon = Number(results[0].lon);
  return validCoordinates(lat, lon) ? { lat, lon } : null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const response = await fetch(SHEET_CSV_URL, { headers: { 'User-Agent': 'VedMapIntegration/1.0' } });
    const csvText = await response.text();
    if (!response.ok || /^\s*<!doctype html|^\s*<html/i.test(csvText)) {
      throw new Error(`Google Sheet is not publicly readable (HTTP ${response.status})`);
    }

    const rows = parse(csvText, { skip_empty_lines: true, relax_column_count: true, bom: true, trim: true });
    if (rows.length < 2) throw new Error('The Google Sheet returned no event rows');

    // CSV columns are zero-based: C=2, K=10, L=11, M=12, N=13,
    // O=14, P=15, R=17, Y=24. AA/AB are source coordinates but ZIP is authoritative.
    const events = [];
    let skipped = 0;
    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index];
      const hostOrganization = clean(row[2]);
      const dateAnswer = clean(row[10]);
      const title = clean(row[11]);
      const time = clean(row[12]);
      const locationEntry = clean(row[13]);
      const publicAnswer = clean(row[14]);
      const browserUrl = clean(row[15]);
      const description = clean(row[17]);
      const zip = clean(row[24]);

      if (!title || !zip || !isPublicEvent(publicAnswer)) { skipped += 1; continue; }
      const coordinates = await geocodeZip(zip);
      if (!coordinates) { skipped += 1; continue; }

      events.push({
        id: `${index}-${title}`,
        title,
        hostOrganization,
        date: extractDates(dateAnswer),
        time,
        address: isFullStreetAddress(locationEntry) ? locationEntry : '',
        description,
        browserUrl,
        city: '',
        state: '',
        zip,
        lat: coordinates.lat,
        lon: coordinates.lon
      });
    }

    res.status(200).json({ source: SHEET_CSV_URL, count: events.length, skipped, data: events });
  } catch (error) {
    console.error('Error loading Google Sheet events:', error);
    res.status(500).json({ error: error.message, data: [] });
  }
};
