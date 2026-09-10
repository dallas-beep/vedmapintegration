const fetch = require('node-fetch');
const csv = require('csv-parse/sync');

export default async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Google Sheet CSV export URL
    const SHEET_ID = '1dO027VAM1PwKrv07DkU1tIPMKTbfRMtmr9gU9jppl4s';
    const GID = '619059883';
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch sheet: ${response.status}`);
    }

    const csvText = await response.text();
    const records = csv.parse(csvText, {
      columns: true,
      skip_empty_lines: true
    });

    const events = [];

    for (const record of records) {
      // Filter: only show if column N (public) = "Yes"
      if (record.N && record.N.trim().toLowerCase() !== 'yes') {
        continue;
      }

      const eventName = record.K ? record.K.trim() : '';
      const hostOrg = record.C ? record.C.trim() : '';
      const dateInfo = record.J ? record.J.trim() : '';
      const timeInfo = record.L ? record.L.trim() : '';
      const locationText = record.M ? record.M.trim() : '';

      if (!eventName || !locationText) {
        continue;
      }

      // Geocode the location
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
          date: dateInfo,
          time: timeInfo,
          description: `${hostOrg} - ${dateInfo} ${timeInfo}`,
          address: locationText,
          city: '',
          state: '',
          zip: '',
          lat: parseFloat(geo.lat),
          lon: parseFloat(geo.lon),
          browserUrl: '#'
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
