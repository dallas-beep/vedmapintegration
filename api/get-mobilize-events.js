const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

const PUBLISHED_SHEET_ID = '2PACX-1vSl-yUZCi_Rv_aMe5tYTRixQ1dUyd5G2QgfrfeGsgPwjIlXUpiUJ-9IG5ja1RYRsBzfePgSJ3VxvwLA';
const GID = '619059883';

// Google Sheets CSV exports use the first row as the column headers. The
// previous implementation parsed with `columns: true`, then looked up values
// using spreadsheet letters (record.K, record.M, etc.). That only works when
// the sheet's header text literally is "K", "M", and so on. Keep the mapping
// explicit, but read the exported rows by their zero-based column positions.
const COLUMN_MAPPING = {
  hostOrganization: 2, // C
  date: 9,              // J
  title: 10,            // K
  time: 11,             // L
  address: 12,          // M
  public: 13,           // N
  registrationLink: 14  // O
};

const valueAt = (row, column) => {
  const value = row[COLUMN_MAPPING[column]];
  return value == null ? '' : String(value).trim();
};

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
    const csvUrl = new URL(
      `https://docs.google.com/spreadsheets/d/e/${PUBLISHED_SHEET_ID}/pub`
    );
    csvUrl.searchParams.set('gid', GID);
    csvUrl.searchParams.set('single', 'true');
    csvUrl.searchParams.set('output', 'csv');

    const response = await fetch(csvUrl.toString());
    if (!response.ok) {
      throw new Error(`Failed to fetch Google Sheet: ${response.status}`);
    }

    const csvText = await response.text();
    const rows = parse(csvText, {
      columns: false,
      skip_empty_lines: true,
      bom: true,
      relax_column_count: true,
      trim: false
    });

    // Row zero is the sheet header. Using rows instead of header names means
    // the mapping remains correct even when headers contain spaces or labels.
    const events = [];

    for (const row of rows.slice(1)) {
      const isPublic = valueAt(row, 'public').toLowerCase();
      if (isPublic !== 'yes') {
        continue;
      }

      const eventName = valueAt(row, 'title');
      const hostOrg = valueAt(row, 'hostOrganization');
      const dateInfo = valueAt(row, 'date');
      const timeInfo = valueAt(row, 'time');
      const locationText = valueAt(row, 'address');
      const registrationLink = valueAt(row, 'registrationLink');

      if (!eventName || !locationText) {
        continue;
      }

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
    console.error('Error loading Google Sheet:', error);
    res.status(500).json({ error: error.message });
  }
};
