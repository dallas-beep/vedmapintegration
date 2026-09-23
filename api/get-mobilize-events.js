const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const SHEET_ID = '1dO027VAM1PwKrv07DkU1tIPMKTbfRMtmr9gU9jppl4s';
    const GID = '1581051441';
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

    const response = await fetch(csvUrl);
    if (!response.ok) return res.status(200).json({ count: 0, data: [] });

    const csvText = await response.text();
    const rows = parse(csvText, { skip_empty_lines: true, relax_column_count: true });

    const events = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      // Column mapping
      const org = (row[2] || '').trim();           // C
      const zip = (row[7] || '').trim();           // H
      let date = (row[11] || '').trim();           // L
      const activityName = (row[12] || '').trim(); // M
      let time = (row[13] || '').trim();           // N
      const location = (row[14] || '').trim();     // O
      const showIt = (row[15] || '').trim().toLowerCase(); // P
      let description = (row[19] || '').trim();    // T
      const sharePublic = (row[21] || '').trim().toLowerCase(); // V

      // Filters: P and V must both be "yes"
      if (showIt !== 'yes' || sharePublic !== 'yes') continue;
      if (!activityName || !location) continue;

      // Replace TBD/TBA
      if (date.toUpperCase() === 'TBD' || date.toUpperCase() === 'TBA') date = 'Coming Soon';
      if (time.toUpperCase() === 'TBD' || time.toUpperCase() === 'TBA') time = 'Coming Soon';
      if (description.toUpperCase() === 'TBD' || description.toUpperCase() === 'TBA') description = 'Coming Soon';

      // Geocode by zip
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(zip)}`);
        const geoData = await geoRes.json();
        if (!geoData || !geoData[0]) continue;

        const geo = geoData[0];
        events.push({
          id: activityName,
          title: activityName,
          hostOrganization: org,
          date: date,
          time: time,
          description: description,
          address: location,
          zip: zip,
          lat: parseFloat(geo.lat),
          lon: parseFloat(geo.lon)
        });
      } catch (e) {
        console.error(`Geocode fail: ${zip}`);
      }
    }

    return res.status(200).json({ count: events.length, data: events });
  } catch (error) {
    console.error('Error:', error);
    return res.status(200).json({ count: 0, data: [] });
  }
};
