const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

const PUBLISHED_SHEET_ID = '2PACX-1vSl-yUZCi_Rv_aMe5tYTRixQ1dUyd5G2QgfrfeGsgPwjIlXUpiUJ-9IG5ja1RYRsBzfePgSJ3VxvwLA';
const EVENTS_TAB_NAME = 'properspreadsheet';
const EVENTS_TAB_GID = '619059883';

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

const isHeaderMatch = (header, aliases) => aliases.some(alias => {
  const candidate = normalize(alias);
  return header === candidate || header.includes(candidate) || candidate.includes(header);
});

// Published Google Sheets CSVs sometimes include a title/preamble before the
// real header. Find the row that actually contains event fields instead of
// assuming row zero is always the header.
const findHeader = rows => {
  let best = { index: 0, score: 0 };
  rows.slice(0, 10).forEach((row, index) => {
    const headers = row.map(normalize);
    const score = Object.values(COLUMN_ALIASES)
      .filter(aliases => headers.some(header => isHeaderMatch(header, aliases))).length;
    if (score > best.score) best = { index, score };
  });
  return best;
};

const findColumns = headerRow => Object.fromEntries(
  Object.entries(COLUMN_ALIASES).map(([field, aliases]) => {
    const index = headerRow.findIndex(header => isHeaderMatch(normalize(header), aliases));
    return [field, index === -1 ? FALLBACK_COLUMNS[field] : index];
  })
);

const valueAt = (row, columns, field) => {
  const value = row[columns[field]];
  return value == null ? '' : String(value).trim();
};

const isPublished = value => ['yes', 'y', 'true', '1', 'published', 'public'].includes(normalize(value));

async function fetchTab({ useName }) {
  const csvUrl = new URL(`https://docs.google.com/spreadsheets/d/e/${PUBLISHED_SHEET_ID}/pub`);
  csvUrl.searchParams.set('single', 'true');
  csvUrl.searchParams.set('output', 'csv');
  if (useName) csvUrl.searchParams.set('sheet', EVENTS_TAB_NAME);
  else csvUrl.searchParams.set('gid', EVENTS_TAB_GID);

  const response = await fetch(csvUrl.toString());
  const csvText = await response.text();
  if (!response.ok) throw new Error(`Google Sheets returned ${response.status}`);

  const rows = parse(csvText, {
    columns: false,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
    trim: false
  });
  const header = findHeader(rows);
  return { rows, header, columns: findColumns(rows[header.index] || []) };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Prefer the named properspreadsheet tab. Fall back to its configured gid
    // because some published workbooks ignore the sheet query parameter.
    let tab;
    try {
      tab = await fetchTab({ useName: true });
      if (tab.header.score < 2) tab = await fetchTab({ useName: false });
    } catch (nameError) {
      tab = await fetchTab({ useName: false });
    }

    if (!tab.rows.length || tab.header.score < 2) {
      throw new Error(`Could not find event columns in the ${EVENTS_TAB_NAME} tab. Check the published tab name and gid.`);
    }

    const { rows, header, columns } = tab;
    const hasPublicColumn = header.index >= 0 && rows[header.index].some(cell => isHeaderMatch(normalize(cell), COLUMN_ALIASES.public));
    const events = [];

    for (const row of rows.slice(header.index + 1)) {
      // If the tab has no visibility column, do not discard every event.
      if (hasPublicColumn && !isPublished(valueAt(row, columns, 'public'))) continue;

      const eventName = valueAt(row, columns, 'title');
      const hostOrg = valueAt(row, columns, 'hostOrganization');
      const dateInfo = valueAt(row, columns, 'date');
      const timeInfo = valueAt(row, columns, 'time');
      const locationText = valueAt(row, columns, 'address');
      const registrationLink = valueAt(row, columns, 'registrationLink');
      if (!eventName || !locationText) continue;

      try {
        const geoResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationText)}`, {
          headers: { 'User-Agent': 'vedmapintegration/1.0' }
        });
        const geoData = await geoResponse.json();
        if (!geoData || !geoData.length) continue;
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
        console.error(`Geocoding error for ${locationText}:`, geoError);
      }
    }

    res.status(200).json({ count: events.length, data: events });
  } catch (error) {
    console.error('Error loading Google Sheet events:', error);
    res.status(500).json({ error: error.message });
  }
};
