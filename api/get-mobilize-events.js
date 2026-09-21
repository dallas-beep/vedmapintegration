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
    
    // Parse as arrays (no headers) to avoid quote parsing issues
    const rows = parse(csvText, {
      columns: false,
      skip_empty_lines: true
    });

    // Skip first 2 rows (column letters + broken headers)
    // Data starts at row 2
    const dataRows = rows.slice(2);
    const events = [];

    for (const row of dataRows) {
      try {
        // Column indices based on Google Form structure
        // 2 = Organization
        // 11 = Event/activity name
        // 12 = Start time / End time
        // 13 = Location
        // 14 = Is this event open to the public?
        // 15 = Event registration link

        const hostOrg = (row[2] || '').trim();
        const eventName = (row[11] || '').trim();
        const timeInfo = (row[12] || '').trim();
        const locationText = (row[13] || '').trim();
        const isPublic = (row[14] || '').trim().toLowerCase();
        const registrationLink = (row[15] || '').trim();

        // Must have event name, location, and be public
        if (!eventName || !locationText || isPublic !== 'yes') {
          continue;
        }

        // Try to geocode
        const geoResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationText)}`
        );
        
        if (!geoResponse.ok) {
          continue;
        }

        const geoData = await geoResponse.json();
        
        if (!Array.isArray(geoData) || geoData.length === 0) {
          continue;
        }

        const geo = geoData[0];
        const lat = parseFloat(geo.lat);
        const lon = parseFloat(geo.lon);

        if (isNaN(lat) || isNaN(lon)) {
          continue;
        }

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
