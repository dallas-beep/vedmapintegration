const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  try {
    const SHEET_ID = '1dO027VAM1PwKrv07DkU1tIPMKTbfRMtmr9gU9jppl4s';
    const GID = '1581051441';
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
    const response = await fetch(csvUrl);
    if (!response.ok) return res.status(200).json({ count: 0, data: [] });
    const csvText = await response.text();
    const rows = parse(csvText, { skip_empty_lines: true, relax_column_count: true });
    const events = [];
    let requestCount = 0;
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
      const location = (row[14] || '').trim();
      const isPublic = (row[15] || '').trim().toLowerCase();
      let description = (row[19] || '').trim();
      if (activityName.toUpperCase() === 'TBD' || activityName.toUpperCase() === 'TBA') activityName = 'Coming Soon';
      if (date.toUpperCase() === 'TBD' || date.toUpperCase() === 'TBA') date = 'Coming Soon';
      if (time.toUpperCase() === 'TBD' || time.toUpperCase() === 'TBA') time = 'Coming Soon';
      if (description.toUpperCase() === 'TBD' || description.toUpperCase() === 'TBA') description = 'Coming Soon';
      if (zip.length === 4) zip = '0' + zip;
      if (!zip || isPublic !== 'yes' || !location) continue;
      try {
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData && geoData[0]) {
            const resultLat = parseFloat(geoData[0].lat);
            const resultLon = parseFloat(geoData[0].lon);
            if (resultLat >= 24 && resultLat <= 49 && resultLon >= -125 && resultLon <= -66) {
              lat = resultLat;
              lon = resultLon;
            }
          }
        }
        events.push({ id: activityName, title: activityName, hostOrganization: org, date, time, description, address: location, zip, lat, lon });
      } catch (e) {
        events.push({ id: activityName, title: activityName, hostOrganization: org, date, time, description, address: location, zip, lat: 39.8283, lon: -98.5795 });
      }
    }
    return res.status(200).json({ count: events.length, data: events });
  } catch (error) {
    return res.status(200).json({ count: 0, data: [] });
  }
};
