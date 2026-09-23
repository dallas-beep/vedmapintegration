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
      const zip = (row[7] || '').trim();
      let date = (row[11] || '').trim();
      const activityName = (row[12] || '').trim();
      let time = (row[13] || '').trim();
      const location = (row[14] || '').trim();
      const isPublic = (row[15] || '').trim();
      let description = (row[19] || '').trim();
      const canShare = (row[21] || '').trim();

      if (!zip) {
        console.warn(`Row ${i}: Missing zip code`);
        continue;
      }
      if (isPublic.toLowerCase() !== 'yes') {
        console.warn(`Row ${i}: Not public (${isPublic})`);
        continue;
      }
      if (canShare.toLowerCase() !== 'yes') {
        console.warn(`Row ${i}: Cannot share (${canShare})`);
        continue;
      }
      if (!activityName || !location) {
        console.warn(`Row ${i}: Missing activity name or location`);
        continue;
      }

      if (date.toUpperCase() === 'TBD' || date.toUpperCase() === 'TBA') date = 'Coming Soon';
      if (time.toUpperCase() === 'TBD' || time.toUpperCase() === 'TBA') time = 'Coming Soon';
      if (description.toUpperCase() === 'TBD' || description.toUpperCase() === 'TBA') description = 'Coming Soon';

      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(zip)}`, {
          headers: { 'User-Agent': 'VoteEarlyDayMap/1.0 (voteearlyday.org)' }
        });
        
        if (!geoRes.ok) {
          console.error(`Nominatim error for zip ${zip}: ${geoRes.status}`);
          continue;
        }

        const geoData = await geoRes.json();
        if (!geoData || !geoData[0]) {
          console.warn(`No geocode result for zip ${zip}`);
          continue;
        }

        const geo = geoData[0];
        console.log(`Row ${i}: Geocoded ${zip} successfully`);
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
        console.error(`Geocode exception for zip ${zip}: ${e.message}`);
      }
    }

    console.log(`Final event count: ${events.length}`);
    return res.status(200).json({ count: events.length, data: events });
  } catch (error) {
    console.error('Fatal error:', error);
    return res.status(200).json({ count: 0, data: [] });
  }
};
