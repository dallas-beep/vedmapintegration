const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

// This must be the published spreadsheet URL and the gid for the events tab
// (not the gid for the workbook's first/default tab).
const PUBLISHED_SHEET_ID = '2PACX-1vSl-yUZCi_Rv_aMe5tYTRixQ1dUyd5G2QgfrfeGsgPwjIlXUpiUJ-9IG5ja1RYRsBzfePgSJ3VxvwLA';
const GID = '619059883';

// The published CSV contains the actual header labels, so resolve columns by
// header name first. The numeric positions are only a compatibility fallback
// for sheets whose header row has been removed or renamed completely.
const COLUMN_ALIASES = {
  hostOrganization: ['host organization', 'hostorganization', 'organization', 'host org'],
  date: ['date', 'event date'],
  title: ['title', 'event title', 'event name', 'name'],
  time: ['time', 'event time', 'start time'],
  address: ['address', 'location', 'event address', 'venue address'],
  public: ['public', 'is public', 'publish', 'published', 'show on map', 'visible'],
  registrationLink: ['registration link', 'registrationlink', 'registration url', 'rsvp', 'rsvp link', 'url', 'link']
};

const FALLBACK_COLUMNS = {
  hostOrganization: 2, // C
  date: 9, // J
  title: 10, // K
  time: 11, // L
  address: 12, // M
  public: 13, // N
  registrationLink: 14 // O
};

const normalizeHeader = value => String(value == null ? '' : value)
  .replace(/\ufeff/g, '')
  .trim()
  .toLowerCase()
  .replace(/[?_*()[\]{}:#/\\-]+/g, ' ')
  .replace(/\s+/g, ' ');

const findColumns = headerRow => {
  const normalizedHeaders = headerRow.map(normalizeHeader);
  return Object.fromEntries(Object.entries(COLUMN_ALIASES).map(([field, aliases]) => {
    const aliasSet = new Set(aliases.map(normalizeHeader));
    const index = normalizedHeaders.findIndex(header => aliasSet.has(header));
    return [field, index === -1 ? FALLBACK_COLUMNS[field] : index];
  }));
};

const valueAt = (row, columns, field) => {
  const value = row[columns[field]];
  return value == null ? '' : String(value).trim();
};

const isPublished = value => ['yes', 'y', 'true', '1', 'published', 'public'].includes(
  normalizeHeader(value)
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const csvUrl = new URL(`https://docs.google.com/spreadsheets/d/e/${PUBLISHED_SHEET_ID}/pub`);
    csvUrl.searchParams.set('gid', GID);
    csvUrl.searchParams.set('single', 'true');
    csvUrl.searchParams.set('output', 'csv');

    const response = await fetch(csvUrl.toString());
    if (!response.ok) {
      throw new Error(`Failed to fetch the events spreadsheet tab (gid ${GID}): ${response.status}`);
    }

    const csvText = await response.text();
    const rows = parse(csvText, {
      columns: false,
      skip_empty_lines: true,
      bom: true,
      relax_column_count: true,
      trim: false
    });

    if (rows.length < 2) {
      throw new Error(`The events spreadsheet tab (gid ${GID}) returned no data rows`);
    }

    const columns = findColumns(rows[0]);
    const events = [];

    for (const row of rows.slice(1)) {
      if (!isPublished(valueAt(row, columns, 'public'))) continue;

      const eventName = valueAt(row, columns, 'title');
      const hostOrg = valueAt(row, columns, 'hostOrganization');
      const dateInfo = valueAt(row, columns, 'date');
      const timeInfo = valueAt(row, columns, 'time');
      const locationText = valueAt(row, columns, 'address');
      const registrationLink = valueAt(row, columns, 'registrationLink');

      if (!eventName || !locationText) continue;

      try {
        const geoResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationText)}`,
          { headers: { 'User-Agent': 'vedmapintegration/1.0' } }
        );
        const geoData = await geoResponse.json();

        if (!geoData || geoData.length === 0) {
          console.warn(`Could not geocode: ${locationText}`);
          continue;
        }

        const geo = geoData[0];
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
          lat: parseFloat(geo.lat),
          lon: parseFloat(geo.lon),
          browserUrl: registrationLink
        });
      } catch (geoError) {
        console.error(`Geocoding error for ${locationText}:`, geoError);
      }
    }

    res.status(200).json({ count: events.length, data: events });
  } catch (error) {
    console.error('Error loading Google Sheet events:', error);
    res.status(500).json({ error: error.message });
  }
};
