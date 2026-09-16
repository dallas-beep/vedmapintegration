const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

const PUBLISHED_SHEET_ID = '2PACX-1vSl-yUZCi_Rv_aMe5tYTRixQ1dUyd5G2QgfrfeGsgPwjIlXUpiUJ-9IG5ja1RYRsBzfePgSJ3VxvwLA';
const EVENTS_TAB_GID = '1581051441';

const COLUMN_ALIASES = {
  title: ['event/activity name', 'event activity name', 'event name', 'event title', 'title'],
  organization: ['what organization do you represent', 'host organization', 'organization', 'host org'],
  cityState: ['city and state', 'city/state', 'city state'],
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

const normalize = value => String(value == null ? '' : value)
  .replace(/\ufeff/g, '').trim().toLowerCase()
  .replace(/[?_*()[\]{}:#/\\-]+/g, ' ').replace(/\s+/g, ' ');

const matches = (header, aliases) => aliases.some(alias => {
  const candidate = normalize(alias);
  return header === candidate || header.includes(candidate) || candidate.includes(header);
});

const findHeader = rows => {
  let best = { index: -1, score: 0 };
  rows.slice(0, 20).forEach((row, index) => {
    const score = Object.values(COLUMN_ALIASES).filter(aliases =>
      row.some(cell => matches(normalize(cell), aliases))
    ).length;
    if (score > best.score) best = { index, score };
  });
  return best;
};

const findColumns = headerRow => Object.fromEntries(
  Object.entries(COLUMN_ALIASES).map(([field, aliases]) => [
    field,
    headerRow.findIndex(cell => matches(normalize(cell), aliases))
  ])
);

const valueAt = (row, columns, field) => {
  const index = columns[field];
  return index < 0 || row[index] == null ? '' : String(row[index]).trim();
};

// Only an explicit negative answer excludes a row. This is important because
// form exports often contain values such as "Yes - open to everyone".
const isExplicitNo = value => /^(no|n|false|0)(?:\b|\s|[-:])/i.test(String(value || '').trim());

async function fetchPublishedTab() {
  const url = new URL(`https://docs.google.com/spreadsheets/d/e/${PUBLISHED_SHEET_ID}/pub`);
  url.searchParams.set('gid', EVENTS_TAB_GID);
  url.searchParams.set('single', 'true');
  url.searchParams.set('output', 'csv');
  const response = await fetch(url.toString(), { headers: { Accept: 'text/csv' } });
  const csvText = await response.text();
  if (!response.ok) throw new Error(`Published spreadsheet returned ${response.status}`);
  if (/^\s*<(?:!doctype|html)/i.test(csvText)) {
    throw new Error('The published spreadsheet returned HTML instead of CSV. Publish the tab and enable public viewing.');
  }
  const rows = parse(csvText, { columns: false, skip_empty_lines: true, bom: true, relax_column_count: true });
  const header = findHeader(rows);
  if (header.index < 0 || header.score < 3) {
    throw new Error(`No usable event header row found in published tab gid ${EVENTS_TAB_GID}`);
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
    const { rows, header, columns } = await fetchPublishedTab();
    const events = [];
    let skippedRows = 0;
    let publicRows = 0;

    for (const row of rows.slice(header.index + 1)) {
      const publicValue = valueAt(row, columns, 'public');
      if (columns.public >= 0 && isExplicitNo(publicValue)) {
        skippedRows += 1;
        continue;
      }
      publicRows += 1;

      const title = valueAt(row, columns, 'title');
      const organization = valueAt(row, columns, 'organization');
      const cityState = valueAt(row, columns, 'cityState');
      const zip = valueAt(row, columns, 'zip');
      const social = valueAt(row, columns, 'social');
      const octoberEvent = valueAt(row, columns, 'octoberEvent');
      const startEnd = valueAt(row, columns, 'startEnd');
      const address = valueAt(row, columns, 'address');
      const registrationLink = valueAt(row, columns, 'registrationLink');
      const mobilize = valueAt(row, columns, 'mobilize');
      const description = valueAt(row, columns, 'description');

      if (!title || !address) {
        skippedRows += 1;
        continue;
      }

      const geocodeQuery = [address, cityState, zip].filter(Boolean).join(', ');
      try {
        const geoResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(geocodeQuery)}`, {
          headers: { 'User-Agent': 'vedmapintegration/1.0' }
        });
        const geoData = await geoResponse.json();
        if (!geoData || !geoData.length) {
          skippedRows += 1;
          continue;
        }

        events.push({
          id: `${title}-${address}`,
          title,
          hostOrganization: organization,
          date: isExplicitNo(octoberEvent) || !octoberEvent ? 'TBD' : 'October 24, 2026',
          time: startEnd,
          address,
          city: cityState,
          state: '',
          zip,
          social,
          octoberEvent,
          startEnd,
          public: publicValue,
          mobilize,
          description,
          browserUrl: registrationLink,
          lat: Number(geoData[0].lat),
          lon: Number(geoData[0].lon)
        });
      } catch (error) {
        skippedRows += 1;
        console.error(`Geocoding error for ${geocodeQuery}:`, error);
      }
    }

    res.status(200).json({ count: events.length, data: events, skippedRows, publicRows });
  } catch (error) {
    console.error('Error loading published events:', error);
    res.status(500).json({ error: error.message });
  }
};
