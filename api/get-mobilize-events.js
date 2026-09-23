const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const SHEET_ID = '1dO027VAM1PwKrv07DkU1tIPMKTbfRMtmr9gU9jppl4s';
    const GID = '1581051441';
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

    const csvText = await response.text();
    const rows = parse(csvText, { skip_empty_lines: true, relax_column_count: true });

    const events = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[11]) continue;

      const title = (row[11] || '').trim();
      const org = (row[2] || '').trim();
      let time = (row[12] || '').trim();
      const location = (row[13] || '').trim();
      const isPublic = (row[14] || '').trim().toLowerCase();
      const regLink = (row[15] || '').trim();

      if (isPublic !== 'yes' || !title || !location) continue;

      if (time.toUpperCase() === 'TBD' || time.toUpperCase() === 'TBA') {
        time = 'Coming Soon...';
      }

      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`);
        const geoData = await geoRes.json();
        if (!geoData || !geoData[0]) continue;

        const geo = geoData[0];
        events.push({
          id: title,
          title: title,
          hostOrganization: org,
          date: 'October 24, 2026',
          time: time,
          description: `${org} - October 24, 2026`,
          address: location,
          lat: parseFloat(geo.lat),
          lon: parseFloat(geo.lon),
          browserUrl: regLink
        });
      } catch (e) {
        console.error(`Geocode error: ${location}`);
      }
    }

    res.status(200).json({ count: events.length, data: events });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
};
