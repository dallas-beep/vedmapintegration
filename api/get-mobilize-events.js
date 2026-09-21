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
      throw new Error(`Failed to fetch sheet: ${response.status}`);
    }

    const csvText = await response.text();
    const rows = parse(csvText, {
      columns: false,
      skip_empty_lines: true
    });

    if (!rows || rows.length < 20) {
      return res.status(200).json({ count: 0, data: [] });
    }

    const events = [];

    // Skip header rows (rows 0-14), start with data at row 15+
    for (let i = 15; i < rows.length; i++) {
      const row = rows[i];
      
      // Column indices (0-indexed):
      // 2 = Organization
      // 3 = City/State
      // 11 = Event name (Are you hosting a Vote Early Day...)
      // 12 = Event/activity name
      // 13 = Start time / End time
      // 14 = Location
      // 15 = Is this event open to the public?
      // 16 = Event registration link

      const eventName = (row[12] || '').trim();
      const hostOrg = (row[2] || '').trim();
      let timeInfo = (row[13] || '').trim();
      const locationText = (row[14] || '').trim();
      const isPublic = (row[15] || '').trim().toLowerCase();
      const registrationLink = (row[16] || '').trim();

      // Skip if not public
      if (isPublic !== 'yes') {
        continue;
      }

      // Replace TBD/TBA
      if (timeInfo.toUpperCase() === 'TBD' || timeInfo.toUpperCase() === 'TBA') {
        timeInfo = 'Coming Soon...';
      }

      if (!eventName || !locationText) {
        continue;
      }

      try {
        const geoResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationText)}`
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
          date: 'October 24, 2026',
          time: timeInfo,
          description: `${hostOrg} - October 24, 2026 ${timeInfo}`,
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

    res.status(200).json({
      count: events.length,
      data: events
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
};
