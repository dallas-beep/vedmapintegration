const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

const SHEET_ID = '1DJgMiQT6oMxBvdKFK6bha2EEFkJrNrXYU8U0dEMDhhs';
const SHEET_GID = '0';
const SHEET_URLS = [
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`,
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`
];

const normalize = (value) => String(value || '')
  .replace(/^\uFEFF/, '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const aliases = {
  title: ['title', 'eventtitle', 'eventname', 'name', 'event'],
  host: ['host', 'hostorganization', 'organization', 'organizer', 'sponsor'],
  date: ['date', 'eventdate', 'startdate'],
  time: ['time', 'eventtime', 'starttime'],
  address: ['address', 'location', 'eventaddress', 'streetaddress', 'venuename', 'venue'],
  city: ['city', 'town'],
  state: ['state', 'st', 'province'],
  zip: ['zip', 'zipcode', 'postalcode', 'postcode'],
  url: ['url', 'link', 'registration', 'registrationurl', 'eventurl', 'rsvp', 'rsvplink'],
  description: ['description', 'details', 'eventdescription'],
  lat: ['lat', 'latitude'],
  lon: ['lon', 'lng', 'longitude']
};

function getValue(record, headers, field) {
  const wanted = aliases[field] || [];
  const index = headers.findIndex((header) => wanted.includes(normalize(header)));
  return index === -1 ? '' : String(record[index] || '').trim();
}

async function downloadSheet() {
  let lastError;
  for (const url of SHEET_URLS) {
    const response = await fetch(url, { headers: { 'User-Agent': 'VedMapIntegration/1.0' } });
    const text = await response.text();
    if (!response.ok || /sign in|request access|access denied/i.test(text.slice(0, 1000))) {
      lastError = new Error(`Google Sheet is not publicly readable (HTTP ${response.status})`);
      continue;
    }
    if (/^\s*<!doctype html|^\s*<html/i.test(text)) {
      lastError = new Error('Google Sheet returned an HTML sign-in/access page instead of CSV');
      continue;
    }
    return { text, url };
  }
  throw lastError || new Error('Unable to download Google Sheet');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const { text, url: source } = await downloadSheet();
    const rows = parse(text, {
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true,
      trim: true
    });

    if (rows.length < 2) throw new Error('The Google Sheet has no data rows');
    const headers = rows[0].map((header) => String(header || '').trim());
    const events = [];
    let skipped = 0;

    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index];
      const title = getValue(row, headers, 'title');
      const hostOrganization = getValue(row, headers, 'host');
      const date = getValue(row, headers, 'date');
      const time = getValue(row, headers, 'time');
      const address = getValue(row, headers, 'address');
      const city = getValue(row, headers, 'city');
      const state = getValue(row, headers, 'state');
      const zip = getValue(row, headers, 'zip');
      const browserUrl = getValue(row, headers, 'url');
      const description = getValue(row, headers, 'description');
      const fullAddress = [address, city, state, zip].filter(Boolean).join(', ');
      let lat = Number(getValue(row, headers, 'lat'));
      let lon = Number(getValue(row, headers, 'lon'));

      if (!title || (!fullAddress && (!Number.isFinite(lat) || !Number.isFinite(lon)))) {
        skipped += 1;
        continue;
      }

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        const geoResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(fullAddress)}`, {
          headers: { 'User-Agent': 'VedMapIntegration/1.0' }
        });
        const geoData = await geoResponse.json();
        if (!geoData[0]) { skipped += 1; continue; }
        lat = Number(geoData[0].lat);
        lon = Number(geoData[0].lon);
      }

      events.push({ id: `${index}-${title}`, title, hostOrganization, date, time, description, address: fullAddress, city, state, zip, lat, lon, browserUrl });
    }

    res.status(200).json({ source, count: events.length, skipped, headers, data: events });
  } catch (error) {
    console.error('Error loading Google Sheet events:', error);
    res.status(500).json({ error: error.message, data: [] });
  }
};
