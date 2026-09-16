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
    if (!response.ok) throw new Error(`Sheet HTTP error: ${response.status}`);

    const csvText = await response.text();
    const rows = parse(csvText, {
      columns: false,
      skip_empty_lines: true
    });

    const dataRows = rows.slice(1);
    const events = [];

    for (const row of dataRows) {
      // Check your column letters in your secondary Google Sheet:
      // Column A=0, B=1, C=2, D=3 ... K=10, L=11, M=12, N=13, O=14, P=15, Q=16, R=17, S=18, T=19, U=20
      
      const hostOrg = (row[2] || '').trim();

      // Based on the screenshot, row[10] was the 'No, we are hosting...' question.
      // The actual event title is in row[11] (Column L) or row[12] (Column M).
      // If row[11] is empty or is a question, use row[12]:
      const eventName = (row[11] || row[10] || '').trim();
      const dateInfo = (row[12] || '').trim();
      const timeInfo = (row[13] || '').trim();
      const locationText = (row[14] || '').trim();

      // Latitude and Longitude from your appended columns (AA=26, AB=27)
      const lat = parseFloat(row[26]);
      const lon = parseFloat(row[27]);

      if (!eventName || isNaN(lat) || isNaN(lon)) {
        continue;
      }

      // Link column (check if registration URL is in O/P/U)
      const regUrl = (row[20] || row[14] || '').startsWith('http') 
        ? (row[20] || row[14]).trim() 
        : '';

      events.push({
        id: eventName,
        title: eventName,
        hostOrganization: hostOrg,
        date: dateInfo,
        time: timeInfo,
        address: locationText,
        lat: lat,
        lon: lon,
        browserUrl: regUrl
      });
    }

    res.status(200).json({ count: events.length, data: events });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
};
