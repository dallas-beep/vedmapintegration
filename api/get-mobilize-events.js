const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

// Set these in Vercel. The defaults keep the endpoint usable locally.
const PUBLISHED_SHEET_ID = process.env.GOOGLE_PUBLISHED_SHEET_ID || '2PACX-1vSl-yUZCi_Rv_aMe5tYTRixQ1dUyd5G2QgfrfeGsgPwjIlXUpiUJ-9IG5ja1RYRsBzfePgSJ3VxvwLA';
const EVENTS_TAB_GID = process.env.GOOGLE_SHEET_GID || '619059883';
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15000;
const GEOCODE_DELAY_MS = 1100;

let cachedPayload = null;
let cachedAt = 0;
const geocodeCache = new Map();
let lastGeocodeAt = 0;

const FIELD_ALIASES = {
  title: ['event/activity name', 'event activity name', 'event name', 'event title', 'title'],
  organization: ['what organization do you represent', 'host organization', 'organization', 'host org'],
  cityState: ['city and state', 'city/state', 'city state', 'city'],
  zip: ['zipcode', 'zip code', 'zip'],
  social: ['what are your social media handles', 'social media handles', 'social handles'],
  octoberEvent: ['are you hosting a vote early day on october 24 2026', 'vote early day on october 24 2026', 'october 24 2026'],
  startEnd: ['start time / end time', 'start time end time', 'start/end time', 'time'],
  address: ['location of the event', 'event location', 'address', 'location'],
  public: ['is this event open to the public', 'open to the public', 'public'],
  registrationLink: ['event registration link', 'registration link', 'registration url', 'rsvp link', 'rsvp'],
  mobilize: ['how many people will you mobilize to vote early', 'people will you mobilize', 'mobilize'],
  description: ['event description', 'briefly describe what you are planning', 'description']
};

// Fallback indexes for the original form layout when the published sheet has
// generic or blank column names.
const LEGACY_COLUMNS = {
  organization: 2,
  date: 9,
  title: 10,
  startEnd: 11,
  address: 12,
  public: 13,
  registrationLink: 14
};

const normalize = value => String(value == null ? '' : value)
  .replace(/\ufeff/g, '')
  .trim()
  .toLowerCase()
  .replace(/[?_*()[\]{}:#/\\-]+/g, ' ')
  .replace(/\s+/g, ' ');

const cellMatchesAlias = (value, aliases) => {
  const normalizedValue = normalize(value);
  // Without this guard, an empty cell matches every alias because every
  // non-empty string includes an empty string.
  if (!normalizedValue) return false;

  return aliases.some(alias => {
    const normalizedAlias = normalize(alias);
    return normalizedValue === normalizedAlias ||
      normalizedValue.includes(normalizedAlias) ||
      normalizedAlias.includes(normalizedValue);
  });
};

function findHeader(rows) {
  let best = { index: -1, score: 0 };

  rows.slice(0, 20).forEach((row, index) => {
    const score = Object.values(FIELD_ALIASES)
      .filter(aliases => row.some(cell => cellMatchesAlias(cell, aliases)))
      .length;

    if (score > best.score) best = { index, score };
  });

  // The original form layout can still be read by fixed column indexes.
  return best.index >= 0 && best.score >= 3
    ? best
    : { index: 0, score: 0 };
}

function findColumns(row) {
  return Object.fromEntries(
    Object.entries(FIELD_ALIASES).map(([field, aliases]) => [
      field,
      row.findIndex(cell => cellMatchesAlias(cell, aliases))
    ])
  );
}

function valueAt(row, columns, field) {
  const matchedIndex = columns[field];
  const index = matchedIndex >= 0 ? matchedIndex : LEGACY_COLUMNS[field];
  return index == null || row[index] == null ? '' : String(row[index]).trim();
}

function isExplicitNo(value) {
  return /^(no|n|false|0)(?:\b|\s|[-:])/i.test(String(value || '').trim());
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, attempts = 3) {
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);

      if (response.ok || (response.status < 500 && response.status !== 429)) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
    }

    if (attempt < attempts - 1) await sleep(500 * (attempt + 1));
  }

  throw lastError || new Error('Request failed');
}

async function fetchRows() {
  const url = new URL(`https://docs.google.com/spreadsheets/d/e/${PUBLISHED_SHEET_ID}/pub`);
  url.searchParams.set('gid', EVENTS_TAB_GID);
  url.searchParams.set('single', 'true');
  url.searchParams.set('output', 'csv');

  const response = await fetchWithTimeout(url.toString(), {
    headers: { Accept: 'text/csv' }
  });
  const csvText = await response.text();

  if (/^\s*<(?:!doctype|html)/i.test(csvText)) {
    throw new Error('Google Sheets returned HTML instead of CSV. Republish the sheet and enable “Anyone with the link” viewing.');
  }

  const rows = parse(csvText, {
    columns: false,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
    trim: false
  });

  if (!rows.length) throw new Error('The published Google Sheet returned no rows.');

  const header = findHeader(rows);
  return {
    rows,
    header,
    columns: findColumns(rows[header.index])
  };
}

async function geocode(location) {
  if (geocodeCache.has(location)) return geocodeCache.get(location);

  const wait = GEOCODE_DELAY_MS - (Date.now() - lastGeocodeAt);
  if (wait > 0) await sleep(wait);
  lastGeocodeAt = Date.now();

  const response = await fetchWithTimeout(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(location)}`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'vedmapintegration/1.0 (event map)'
      }
    }
  );

  const data = await response.json();
  const result = data && data[0]
    ? { lat: Number(data[0].lat), lon: Number(data[0].lon) }
    : null;

  geocodeCache.set(location, result);
  return result;
}

async function buildPayload() {
  const { rows, header, columns } = await fetchRows();
  const events = [];
  const diagnostics = {
    rowsScanned: Math.max(0, rows.length - header.index - 1),
    publicRows: 0,
    skippedRows: 0,
    geocodeFailures: 0,
    headerRowIndex: header.index,
    headerScore: header.score,
    sheetGid: EVENTS_TAB_GID
  };

  for (const row of rows.slice(header.index + 1)) {
    if (row.every(value => !String(value || '').trim())) continue;

    const publicValue = valueAt(row, columns, 'public');
    if (publicValue && isExplicitNo(publicValue)) {
      diagnostics.skippedRows += 1;
      continue;
    }

    diagnostics.publicRows += 1;

    const title = valueAt(row, columns, 'title');
    const organization = valueAt(row, columns, 'organization');
    const cityState = valueAt(row, columns, 'cityState');
    const zip = valueAt(row, columns, 'zip');
    const address = valueAt(row, columns, 'address');
    const location = [address, cityState, zip].filter(Boolean).join(', ');

    if (!title || !location) {
      diagnostics.skippedRows += 1;
      continue;
    }

    try {
      const geo = await geocode(location);

      if (!geo || !Number.isFinite(geo.lat) || !Number.isFinite(geo.lon)) {
        diagnostics.geocodeFailures += 1;
        continue;
      }

      const octoberEvent = valueAt(row, columns, 'octoberEvent');

      events.push({
        id: `${title}-${location}`,
        title,
        hostOrganization: organization,
        date: !octoberEvent || isExplicitNo(octoberEvent) ? 'TBD' : 'October 24, 2026',
        time: valueAt(row, columns, 'startEnd'),
        address,
        city: cityState,
        state: '',
        zip,
        social: valueAt(row, columns, 'social'),
        octoberEvent,
        public: publicValue,
        mobilize: valueAt(row, columns, 'mobilize'),
        description: valueAt(row, columns, 'description'),
        browserUrl: valueAt(row, columns, 'registrationLink'),
        lat: geo.lat,
        lon: geo.lon
      });
    } catch (error) {
      diagnostics.geocodeFailures += 1;
      console.error(`Geocoding failed for ${location}:`, error.message);
    }
  }

  return {
    count: events.length,
    data: events,
    diagnostics,
    generatedAt: new Date().toISOString()
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (cachedPayload && Date.now() - cachedAt < CACHE_TTL_MS) {
      return res.status(200).json(cachedPayload);
    }

    const payload = await buildPayload();
    cachedPayload = payload;
    cachedAt = Date.now();
    return res.status(200).json(payload);
  } catch (error) {
    console.error('Error loading published events:', error);

    if (cachedPayload) {
      return res.status(200).json({
        ...cachedPayload,
        stale: true,
        warning: 'Google Sheets is temporarily unavailable; showing the last successful data.'
      });
    }

    return res.status(502).json({
      error: error.message,
      source: `published gid ${EVENTS_TAB_GID}`,
      hint: 'Confirm the tab is published and accessible without signing in.'
    });
  }
};
