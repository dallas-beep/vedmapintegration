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
      console.error(`Failed to fetch CSV: ${response.statusText}`);
      return res.status(200).json({ count: 0, data: [] });
    }

    const csvText = await response.text();
    const rows = parse(csvText, { skip_empty_lines: true, relax_column_count: true });

    const events = [];

    // Loop through rows starting from row 1 (skipping header at row 0)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      // Column mappings based on your requirements
      const org = (row[2] || '').trim();          // Column C
      const zip = (row[7] || '').trim();          // Column H
      let date = (row[11] || '').trim();        // Column L
      const activityName = (row[12] || '').trim(); // Column M
      let time = (row[13] || '').trim();        // Column N
      const location = (row[14] || '').trim();    // Column O
      const isPublic = (row[15] || '').trim();    // Column P
      let description = (row[19] || '').trim();   // Column T
      const canShare = (row[21] || '').trim();    // Column V

      // Filters: Skip if requirements are not met
      if (!zip || isPublic.toLowerCase() !== 'yes' || canShare.toLowerCase() !== 'yes' || !activityName || !location) {
        continue;
      }

      // TBD / TBA handling
      if (date.toUpperCase() === 'TBD' || date.toUpperCase() === 'TBA') date = 'Coming Soon';
      if (time.toUpperCase() === 'TBD' || time.toUpperCase() === 'TBA') time = 'Coming Soon';
      if (description.toUpperCase() === 'TBD' || description.toUpperCase() === 'TBA') description = 'Coming Soon';

      try {
        // Nominatim requires a User-Agent header
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(zip)}`, {
          headers: {
            'User-Agent': 'EventMapperApp/1.0 (contact@yourdomain.com)'
          }
        });
        
        const geoData = await geoRes.json();
        if (!geoData || geoData.length === 0) {
          console.warn(`Geocode failed or not found for zip: ${zip}`);
          continue;
        }

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
        console.error(`Geocode error for zip ${zip}:`, e.message);
      }
    }

    return res.status(200).json({ count: events.length, data: events });
  } catch (error) {
    console.error('Error processing spreadsheet:', error);
    return res.status(200).json({ count: 0, data: [] });
  }
};
