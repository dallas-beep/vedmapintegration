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
    const SHEET_NAME = encodeURIComponent('Form Responses');
    
    const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=AIzaSyDHdpjHl3T7eYIL6wfXoNz5K_Qx4R8R8J4`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      return res.status(500).json({ error: `API error: ${response.status}` });
    }

    const data = await response.json();
    const rows = data.values || [];

    // Row 0 = title, Row 1 = column letters, Row 2 = headers, Row 3+ = data
    const events = [];

    for (let i = 3; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 16) continue;

      const hostOrg = (row[2] || '').trim();
      const eventName = (row[11] || '').trim();
      const timeInfo = (row[12] || '').trim();
      const locationText = (row[13] || '').trim();
      const isPublic = (row[14] || '').trim().toLowerCase();
      const registrationLink = (row[15] || '').trim();

      if (!eventName || !locationText || isPublic !== 'yes') continue;

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
