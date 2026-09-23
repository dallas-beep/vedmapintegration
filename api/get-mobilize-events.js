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
      console.error(`Failed to fetch sheet: ${response.status}`);
      return res.status(200).json({ count: 0, data: [] });
    }

    const csvText = await response.text();
    const rows = parse(csvText, { skip_empty_lines: true, relax_column_count: true });

    console.log(`Parsed ${rows.length} rows from sheet`);
    const events = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const org = (row[2] || '').trim();
      let zip = (row[7] || '').trim();
      
      if (!zip) {
        const mailingAddress = (row[6] || '').trim();
        const zipMatch = mailingAddress.match(/\b\d{5}(?:-\d{4})?\b/);
        zip = zipMatch ? zipMatch[0] : '';
      }
      
      let date = (row[11] || '').trim();
      let activityName = (row[12] || '').trim();
      let time = (row[13] || '').trim();
      let location = (row[14] || '').trim();
      const isPublic = (row[15] || '').trim().toLowerCase();
      let description = (row[19] || '').trim();

      if (activityName.toUpperCase() === 'TBD' || activityName.toUpperCase() === 'TBA') activityName = 'Coming Soon';
      if (date.toUpperCase() === 'TBD' || date.toUpperCase() === 'TBA') date = 'Coming Soon';
      if (time.toUpperCase() === 'TBD' || time.toUpperCase() === 'TBA') time = 'Coming Soon';
      if (description.toUpperCase() === 'TBD' || description.toUpperCase() === 'TBA') description = 'Coming Soon';

      if (zip.length === 4) zip = '0' + zip;

      if (!zip || isPublic !== 'yes' || !location) continue;

      try {
        let lat = null, lon = null;
        let geocoded = false;

        // Extract state abbreviation from location
        let state = '';
        const stateMatch = location.match(/([A-Z]{2})(?:\s|$|,)/);
        if (stateMatch) {
          state = stateMatch[1];
        }

        // Geocode with zip + state
        let query = zip;
        if (state) {
          query = `${zip}, ${state}`;
        } else {
          query = `${zip}, USA`;
        }

        console.log(`Geocoding ${activityName}: "${query}"`);

        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`, {
          headers: { 'User-Agent': 'VoteEarlyDayMap/1.0 (voteearlyday.org)' }
        });

        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData && geoData[0]) {
            lat = parseFloat(geoData[0].lat);
            lon = parseFloat(geoData[0].lon);
            
            if (lat >= 24 && lat <= 49 && lon >= -125 && lon <= -66) {
              geocoded = true;
              console.log(`✓ ${activityName}: [${lat.toFixed(4)}, ${lon.toFixed(4)}]`);
            }
          }
        }

        if (!geocoded) {
          lat = 39.8283;
          lon = -98.5795;
          console.warn(`✗ Failed: ${activityName} (${query})`);
        }

        events.push({
          id: activityName,
          title: activityName,
          hostOrganization: org,
          date: date,
          time: time,
          description: description,
          address: location,
          zip: zip,
          lat: lat,
          lon: lon
        });
      } catch (e) {
        console.error(`Exception ${activityName}: ${e.message}`);
        events.push({
          id: activityName,
          title: activityName,
          hostOrganization: org,
          date: date,
          time: time,
          description: description,
          address: location,
          zip: zip,
          lat: 39.8283,
          lon: -98.5795
        });
      }
    }

    console.log(`Final: ${events.length} events`);
    return res.status(200).json({ count: events.length, data: events });
  } catch (error) {
    console.error('Fatal error:', error);
    return res.status(200).json({ count: 0, data: [] });
  }
};
