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
    const SHEET_ID = '1DJgMiQT6oMxBvdKFK6bha2EEFkJrNrXYU8U0dEMDhhs';
    const GID = '0';
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch spreadsheet: HTTP ${response.status}`);
    }

    const csvText = await response.text();
    const rows = parse(csvText, {
      columns: false,
      skip_empty_lines: true
    });

    const dataRows = rows.slice(1);
    const events = [];

    for (const row of dataRows) {
      // 0-indexed columns: C=2, J=9, K=10, L=11, M=12, O=14, U=20
      const colO = (row[14] || '').trim().toLowerCase();
      const colU = (row[20] || '').trim().toLowerCase();

      // Skip row if both columns are 'no'
      if (colO === 'no' && colU === 'no') {
        continue;
      }

      const hostOrg = (row[2] || '').trim();
      const dateInfo = (row[9] || '').trim();
      const eventName = (row[10] || '').trim(); // Column K: Event Name / Activity Name
      const timeInfo = (row[11] || '').trim();
      const locationText = (row[12] || '').trim();

      // Assumes Latitude in AA (index 26) and Longitude in AB (index 27)
      const lat = parseFloat(row[26]);
      const lon = parseFloat(row[27]);

      // Skip if event name is missing or coordinates are not valid numbers
      if (!eventName || isNaN(lat) || isNaN(lon)) {
        continue;
      }

      const showRegLink = (colO === 'yes' && colU === 'yes') ? (row[14] || '').trim() : '';

      events.push({
        id: eventName,
        title: eventName,
        hostOrganization: hostOrg,
        date: dateInfo,
        time: timeInfo,
        address: locationText,
        lat: lat,
        lon: lon,
        browserUrl: showRegLink
      });
    }

    res.status(200).json({
      count: events.length,
      data: events
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
};
