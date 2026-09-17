const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

const SHEET_ID = '1DJgMiQT6oMxBvdKFK6bha2EEFkJrNrXYU8U0dEMDhhs';
const SHEET_GID = '0';
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;

const clean = (value) => String(value || '').replace(/^\uFEFF/, '').trim();
const isPublic = (value) => !/^(no|nope|false|private|not open|closed)$/i.test(clean(value));
const isFullStreetAddress = (value) => {
  const text = clean(value);
  return /\d+\s+[^,]+(?:,|\s)(?:[A-Za-z .'-]+,)?\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?/i.test(text) ||
    (/\d+\s+/.test(text) && /\b(?:street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|lane|ln|way|court|ct|parkway|pkwy|highway|hwy)\b/i.test(text));
};
const validCoordinates = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && lat >= 18 && lat <= 72 && lon >= -180 && lon <= -60;

function extractDates(value) {
  const text = clean(value);
  const matches = text.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,\s*\d{4})?|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/gi);
  return matches ? [...new Set(matches.map(clean))].join(', ') : '';
}

async function geocodeZip(zipcode) {
  const zip = clean(zipcode).match(/\b\d{5}(?:-\d{4})?\b/)?.[0];
  if (!zip) return null;
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&country=United%20States&postalcode=${encodeURIComponent(zip)}`, {
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
    const text = await response.text();
    if (!response.ok || /^\s*<!doctype html|^\s*<html/i.test(text)) {
      throw new Error(`Google Sheet is not publicly readable (HTTP ${response.status})`);
    }

    const rows = parse(text, { skip_empty_lines: true, relax_column_count: true, bom: true, trim: true });
    if (rows.length < 2) throw new Error('The Google Sheet returned no event rows');

    // Fixed spreadsheet columns: C=host, K=date answer, L=name, M=time,
    // N=location, O=public, P=registration, R=description, Y=zipcode.
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

      if (!title || !isPublic(publicAnswer) || !zip) { skipped += 1; continue; }
      const coordinates = await geocodeZip(zip);
      if (!coordinates) { skipped += 1; continue; }

      const address = isFullStreetAddress(locationEntry) ? locationEntry : '';
      events.push({
        id: `${index}-${title}`,
        title,
        hostOrganization,
        date: extractDates(dateAnswer),
        time,
        description,
        address,
        location: locationEntry,
        city: '',
        state: '',
        zip,
        lat: coordinates.lat,
        lon: coordinates.lon,
        browserUrl
      });
    }

    res.status(200).json({ source: SHEET_CSV_URL, count: events.length, skipped, data: events });
  } catch (error) {
    console.error('Error loading Google Sheet events:', error);
    res.status(500).json({ error: error.message, data: [] });
  }
};
