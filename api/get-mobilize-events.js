const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

// This is the actual workbook and the actual events tab supplied for this app.
const SHEET_ID = '1dO027VAM1PwKrv07DkU1tIPMKTbfRMtmr9gU9jppl4s';
const EVENTS_TAB_GID = '1581051441';

const COLUMN_ALIASES = {
  hostOrganization: ['host organization', 'hostorganization', 'organization', 'host org'],
  date: ['date', 'event date'],
  title: ['title', 'event title', 'event name', 'name'],
  time: ['time', 'event time', 'start time'],
  address: ['address', 'location', 'event address', 'venue address'],
  public: ['public', 'is public', 'publish', 'published', 'show on map', 'visible'],
  registrationLink: ['registration link', 'registrationlink', 'registration url', 'rsvp', 'rsvp link', 'url', 'link']
};

// Compatibility fallback for the original spreadsheet layout: C, J, K, L, M, N, O.
const FALLBACK_COLUMNS = {
  hostOrganization: 2,
  date: 9,
  title: 10,
  time: 11,
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

const matchesHeader = (header, aliases) => aliases.some(alias => {
  const candidate = normalize(alias);
  return header === candidate || header.includes(candidate) || candidate.includes(header);
});

const findHeader = rows => {
  let best = { index: -1, score: 0 };
  rows.slice(0, 15).forEach((row, index) => {
    const headers = row.map(normalize);
    const score = Object.values(COLUMN_ALIASES)
      .filter(aliases => headers.some(header => matchesHeader(header, aliases))).length;
    if (score > best.score) best = { index, score };
  });
  return best;
};

const findColumns = headerRow => Object.fromEntries(
  Object.entries(COLUMN_ALIASES).map(([field, aliases]) => {
    const index = headerRow.findIndex(header => matchesHeader(normalize(header), aliases));
    return [field, index === -1 ? FALLBACK_COLUMNS[field] : index];
  })
);

const valueAt = (row, columns, field) => {
  const value = row[columns[field]];
  return value == null ? '' : String(value).trim();
};

const isPublished = value => ['yes', 'y', 'true', '1', 'published', 'public'].includes(normalize(value));

async function fetchEventsTab() {
  // Use the normal workbook export because the provided URL is a /d/ workbook
  // URL, not a /d/e/ published URL. The gid selects properspreadsheet exactly.
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${EVENTS_TAB_GID}`;
  const response = await fetch(csvUrl, { headers: { Accept: 'text/csv' } });
  const csvText = await response.text();

  if (!response.ok) {
    throw new Error(`Google Sheets export failed (${response.status}) for gid ${EVENTS_TAB_GID}`);
  }
  if (/^\s*<(?:!doctype|html)/i.test(csvText)) {
    throw new Error('Google Sheets returned an HTML/login page instead of CSV. Make the workbook readable by the deployed app or publish the properspreadsheet tab.');
  }

  const rows = parse(csvText, {
    columns: false,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
    trim: false
  });
  const header = findHeader(rows);
  if (!rows.length || header.index < 0 || header.score < 2) {
    throw new Error(`No event columns found in spreadsheet tab gid ${EVENTS_TAB_GID}. Verify the tab and its header row.`);
  }
  return { rows, header, columns: findColumns(rows[header.index]) };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { rows, header, columns } = await fetchEventsTab();
    const headerRow = rows[header.index];
    const hasPublicColumn = headerRow.some(cell => matchesHeader(normalize(cell), COLUMN_ALIASES.public));
    const events = [];
    let skippedRows = 0;

    for (const row of rows.slice(header.index + 1)) {
      if (hasPublicColumn && !isPublished(valueAt(row, columns, 'public'))) {
        skippedRows += 1;
        continue;
      }

      const eventName = valueAt(row, columns, 'title');
      const hostOrg = valueAt(row, columns, 'hostOrganization');
      const dateInfo = valueAt(row, columns, 'date');
      const timeInfo = valueAt(row, columns, 'time');
      const locationText = valueAt(row, columns, 'address');
      const registrationLink = valueAt(row, columns, 'registrationLink');

      if (!eventName || !locationText) {
        skippedRows += 1;
        continue;
      }

      try {
        const geoResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationText)}`,
          { headers: { 'User-Agent': 'vedmapintegration/1.0' } }
        );
        const geoData = await geoResponse.json();
        if (!geoData || !geoData.length) {
          skippedRows += 1;
          continue;
        }

        events.push({
          id: eventName,
          title: eventName,
          hostOrganization: hostOrg,
          date: dateInfo,
          time: timeInfo,
          description: `${hostOrg} - ${dateInfo} ${timeInfo}`.trim(),
          address: locationText,
          city: '',
          state: '',
          zip: '',
          lat: parseFloat(geoData[0].lat),
          lon: parseFloat(geoData[0].lon),
          browserUrl: registrationLink
        });
      } catch (geoError) {
        skippedRows += 1;
        console.error(`Geocoding error for ${locationText}:`, geoError);
      }
    }

    res.status(200).json({ count: events.length, data: events, skippedRows });
  } catch (error) {
    console.error('Error loading Google Sheet events:', error);
    res.status(500).json({ error: error.message });
  }
};
