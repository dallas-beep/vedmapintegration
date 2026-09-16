const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

const PUBLISHED_SHEET_ID = '2PACX-1vSl-yUZCi_Rv_aMe5tYTRixQ1dUyd5G2QgfrfeGsgPwjIlXUpiUJ-9IG5ja1RYRsBzfePgSJ3VxvwLA';
const EVENTS_TAB_GID = '1581051441';

const FIELD_ALIASES = {
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
  .replace(/\ufeff/g, '')
  .trim()
  .toLowerCase()
  .replace(/[?_*()[\]{}:#/\\-]+/g, ' ')
  .replace(/\s+/g, ' ');

const cellMatchesAlias = (cellValue, aliases) => {
  const normalizedCell = normalize(cellValue);
  return aliases.some(alias => {
    const normalizedAlias = normalize(alias);
    return normalizedCell === normalizedAlias || normalizedCell.includes(normalizedAlias) || normalizedAlias.includes(normalizedCell);
  });
};

const findHeaderRow = rows => {
  let best = { index: -1, score: 0 };
  rows.slice(0, 20).forEach((row, index) => {
    const score = Object.values(FIELD_ALIASES).filter(aliases => row.some(cell => cellMatchesAlias(cell, aliases))).length;
    if (score > best.score) {
      best = { index, score };
    }
  });
  return best;
};

const findColumns = row => Object.fromEntries(
  Object.entries(FIELD_ALIASES).map(([field, aliases]) => [field, row.findIndex(cell => cellMatchesAlias(cell, aliases))])
);

const valueAt = (row, columns, field) => {
  const index = columns[field];
  return index == null || index < 0 || row[index] == null ? '' : String(row[index]).trim();
};

const isExplicitNo = value => /^(no|n|false|0)(?:\b|\s|[-:])/i.test(String(value || '').trim());

async function fetchPublishedTab() {
  const csvUrl = new URL(`https://docs.google.com/spreadsheets/d/e/${PUBLISHED_SHEET_ID}/pub`);
  csvUrl.searchParams.set('gid', EVENTS_TAB_GID);
  csvUrl.searchParams.set('single', 'true');
  csvUrl.searchParams.set('output', 'csv');

  const response = await fetch(csvUrl.toString(), { headers: { Accept: 'text/csv' } });
  const csvText = await response.text();

  if (!response.ok) {
    throw new Error(`Published spreadsheet returned HTTP ${response.status}`);
  }

  if (/^\s*<(?:!doctype|html)/i.test(csvText)) {
    throw new Error('Published sheet returned HTML instead of CSV; republish the tab and allow public viewing.');
  }

  const rows = parse(csvText, {
    columns: false,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
    trim: false
  });

  const header = findHeaderRow(rows);
  if (header.index < 0 || header.score < 3) {
    const preview = rows[0] ? rows[0].slice(0, 8).join(' | ') : 'none';
    throw new Error(`No event header row found in published tab ${EVENTS_TAB_GID}. Header preview: ${preview}`);
  }

  return { rows, header, columns: findColumns(rows[header.index]) };
}

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
    const { rows, header, columns } = await fetchPublishedTab();
    const events = [];
    const diagnostics = {
      rowsScanned: rows.length - header.index - 1,
      publicRows: 0,
      skippedRows: 0,
      geocodeFailures: 0,
      headerRowIndex: header.index,
      headerScore: header.score
    };

    for (const row of rows.slice(header.index + 1)) {
      if (Object.values(row).every(value => !String(value || '').trim())) {
        continue;
      }

      const publicValue = valueAt(row, columns, 'public');
      if (columns.public >= 0 && isExplicitNo(publicValue)) {
        diagnostics.skippedRows += 1;
        continue;
      }

      diagnostics.publicRows += 1;

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

      if (!title) {
        diagnostics.skippedRows += 1;
        continue;
      }

      const location = [address, cityState, zip].filter(Boolean).join(', ');
      if (!location) {
        diagnostics.skippedRows += 1;
        continue;
      }

      try {
        const geoResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(location)}`,
          { headers: { 'User-Agent': 'vedmapintegration/1.0' } }
        );
        const geoData = await geoResponse.json();

        if (!geoData || !geoData.length) {
          diagnostics.geocodeFailures += 1;
          continue;
        }

        const geo = geoData[0];
        events.push({
          id: `${title}-${location}`,
          title,
          hostOrganization: organization,
          date: !octoberEvent || isExplicitNo(octoberEvent) ? 'TBD' : 'October 24, 2026',
          time: startEnd,
          address,
          city: cityState,
          state: '',
          zip,
          social,
          octoberEvent,
          public: publicValue,
          mobilize,
          description,
          browserUrl: registrationLink,
          lat: Number(geo.lat),
          lon: Number(geo.lon)
        });
      } catch (error) {
        diagnostics.geocodeFailures += 1;
        console.error(`Geocoding error for ${location}:`, error);
      }
    }

    res.status(200).json({ count: events.length, data: events, diagnostics });
  } catch (error) {
    console.error('Error loading published events:', error);
    res.status(500).json({ error: error.message, source: `published gid ${EVENTS_TAB_GID}` });
  }
};
