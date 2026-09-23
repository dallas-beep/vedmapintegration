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
    if (!response.ok) return res.status(200).json({ count: 0, data: [] });

    const csvText = await response.text();
    const records = parse(csvText, { columns: true, skip_empty_lines: true });

    const events = [];

    for (const record of records) {
      // Column C - Organization name
      const org = (record['What organization do you represent?'] || '').trim();
      // Column H - Zip code
      const zip = (record['Zipcode'] || '').trim();
      // Column L - Date
      let date = (record['Date'] || '').trim();
      // Column M - Activity name
      const activityName = (record['Event/activity name'] || '').trim();
      // Column N - Time
      let time = (record['Start time / End time '] || '').trim();
      // Column O - Location
      const location = (record['Location of the event (please include State/County)'] || '').trim();
      // Column P - Display check
      const showIt = (record['Is this event open to the public? '] || '').trim();
      // Column T - Description
      let description = (record['Event description: Briefly describe what you\'re planning and how it will help eligible voters participate.'] || '').trim();
      // Column V - Share publicly check
      const sharePublic = (record['Can we share your event publicly as part of Vote Early Day?'] || '').trim();

      // Filters
      if (!activityName || !location) continue;
      if (showIt.toLowerCase() !== 'yes') continue;
      if (sharePublic.toLowerCase() !== 'yes') continue;

      // Replace TBD/TBA
      if (date.toUpperCase() === 'TBD' || date.toUpperCase() === 'TBA') date = 'Coming Soon';
      if (time.toUpperCase() === 'TBD' || time.toUpperCase() === 'TBA') time = 'Coming Soon';
      if (description.toUpperCase() === 'TBD' || description.toUpperCase() === 'TBA') description = 'Coming Soon';

      // Geocode by zip
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(zip)}`);
        const geoData = await geoRes.json();
        if (!geoData || !geoData[0]) continue;

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
        console.error(`Geocode fail: ${zip}`);
      }
    }

    return res.status(200).json({ count: events.length, data: events });
  } catch (error) {
    console.error('Error:', error);
    return res.status(200).json({ count: 0, data: [] });
  }
};
