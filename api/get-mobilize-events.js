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
    if (!response.ok) {
      return res.status(500).json({ error: 'Failed to fetch sheet' });
    }

    const csvText = await response.text();
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true
    });

    const events = [];

    for (const record of records) {
      const eventName = (record['Event/activity name'] || '').trim();
      const hostOrg = (record['What organization do you represent?'] || '').trim();
      const timeInfo = (record['Start time / End time'] || '').trim();
      const locationText = (record['Location of the event (please include State/County)'] || '').trim();
      const isPublic = (record['Is this event open to the public?'] || '').trim().toLowerCase();
      const registrationLink = (record['Event registration link'] || '').trim();

      if (!eventName || !locationText || isPublic !== 'yes') {
        continue;
      }

      try {
        const geoResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationText)}`
        );
        
        if (!geoResponse.ok) continue;

        const geoData = await geoResponse.json();
        if (!Array.isArray(geoData) || geoData.length === 0) continue;

        const geo = geoData[0];
        const lat = parseFloat(geo.lat);
        const lon = parseFloat(geo.lon);

        if (isNaN(lat) || isNaN(lon)) continue;

        events.push({
          id: eventName,
          title: eventName,
          hostOrganization: hostOrg,
          date: 'October 24, 2026',
          time: timeInfo || 'TBD',
          description: `${hostOrg} - October 24, 2026`,
          address: locationText,
          city: '',
          state: '',
          zip: '',
          lat: lat,
          lon: lon,
          browserUrl: registrationLink
        });
      } catch (e) {
        continue;
      }
    }

    return res.status(200).json({
      count: events.length,
      data: events
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
