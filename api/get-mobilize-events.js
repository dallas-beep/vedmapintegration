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
    if (!response.ok) {
      return res.status(200).json({ count: 0, data: [] });
    }

    const csvText = await response.text();
    const records = parse(csvText, { columns: true, skip_empty_lines: true });

    const events = [];

    for (const record of records) {
      const title = record['Event/activity name'] ? record['Event/activity name'].trim() : '';
      const org = record['What organization do you represent?'] ? record['What organization do you represent?'].trim() : '';
      let time = record['Start time / End time'] ? record['Start time / End time'].trim() : '';
      const location = record['Location of the event (please include State/County)'] ? record['Location of the event (please include State/County)'].trim() : '';
      const canPromote = record['Can we promote your event?'] ? record['Can we promote your event?'].trim().toLowerCase() : '';
      const regLink = record['Event registration link'] ? record['Event registration link'].trim() : '';

      if (!title || !location) continue;
      if (canPromote !== 'yes') continue;

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
          address: location,
          lat: parseFloat(geo.lat),
          lon: parseFloat(geo.lon),
          browserUrl: regLink
        });
      } catch (e) {
        console.error(`Geocode error: ${location}`);
      }
    }

    return res.status(200).json({ count: events.length, data: events });

  } catch (error) {
    console.error('Error:', error);
    return res.status(200).json({ count: 0, data: [], error: error.message });
  }
};
