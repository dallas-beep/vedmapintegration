const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

const PUBLISHED_SHEET_ID = '2PACX-1vSl-yUZCi_Rv_aMe5tYTRixQ1dUyd5G2QgfrfeGsgPwjIlXUpiUJ-9IG5ja1RYRsBzfePgSJ3VxvwLA';
const GID = '619059883';

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
    // The supplied URL is a published-sheet URL, so use /pub with output=csv.
    // /export only works with the spreadsheet's private document ID, not its
    // published 2PACX ID.
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
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      relax_column_count: true
    });

    const events = [];

    for (const record of records) {
      // Filter: only show rows where column N (public) is "Yes".
      if (record.N && record.N.trim().toLowerCase() !== 'yes') {
        continue;
      }

      const eventName = record.K ? record.K.trim() : '';
      const hostOrg = record.C ? record.C.trim() : '';
      const dateInfo = record.J ? record.J.trim() : '';
      const timeInfo = record.L ? record.L.trim() : '';
      const locationText = record.M ? record.M.trim() : '';
      const registrationLink = record.O ? record.O.trim() : '';

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
          description: `${hostOrg} - ${dateInfo} ${timeInfo}`,
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
