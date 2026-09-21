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
    const lines = csvText.split('\n');
    
    // Skip first row (column letters), use second row as headers
    const csvWithCorrectHeaders = lines.slice(1).join('\n');
    
    const records = parse(csvWithCorrectHeaders, {
      columns: true,
      skip_empty_lines: true
    });

    const events = [];

    for (const record of records) {
      const eventName = record['Event/activity name'] ? record['Event/activity name'].trim() : '';
      const hostOrg = record['What organization do you represent?'] ? record['What organization do you represent?'].trim() : '';
      let timeInfo = record['Start time / End time'] ? record['Start time / End time'].trim() : '';
      const locationText = record['Location of the event (please include State/County)'] ? record['Location of the event (please include State/County)'].trim() : '';
      const isPublic = record['Is this event open to the public?'] ? record['Is this event open to the public?'].trim().toLowerCase() : '';
      const registrationLink = record['Event registration link'] ? record['Event registration link'].trim() : '';

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
