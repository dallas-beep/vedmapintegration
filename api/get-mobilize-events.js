const fetch = require('node-fetch');

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
    const lines = csvText.split('\n');
    
    // Skip rows 0-2 (title, column letters, headers)
    // Start with row 3 (actual data)
    const events = [];

    for (let i = 3; i < lines.length; i++) {
      try {
        const cols = lines[i].split(',');
        if (cols.length < 16) continue;

        const hostOrg = (cols[2] || '').trim().replace(/^"|"$/g, '');
        const eventName = (cols[11] || '').trim().replace(/^"|"$/g, '');
        const timeInfo = (cols[12] || '').trim().replace(/^"|"$/g, '');
        const locationText = (cols[13] || '').trim().replace(/^"|"$/g, '');
        const isPublic = (cols[14] || '').trim().toLowerCase().replace(/^"|"$/g, '');
        const registrationLink = (cols[15] || '').trim().replace(/^"|"$/g, '');

        if (!eventName || !locationText || isPublic !== 'yes') {
          continue;
        }

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
