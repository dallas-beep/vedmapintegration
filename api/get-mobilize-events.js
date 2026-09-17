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
      throw new Error(`Sheet fetch failed with status: ${response.status}`);
    }

    const csvText = await response.text();
    const rows = parse(csvText, {
      columns: false,
      skip_empty_lines: true
    });

    if (!rows || rows.length <= 1) {
      return res.status(200).json({ count: 0, data: [] });
    }

    const dataRows = rows.slice(1);
    const events = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];

      // Grab the title from the first non-empty text column among K, L, M, J
      // 0-indexed: J=9, K=10, L=11, M=12, N=13, O=14, U=20
      const titleCandidate = (row[11] || row[10] || row[12] || row[9] || '').trim();
      const hostOrg = (row[2] || '').trim();
      const dateInfo = (row[9] || '').trim();
      const timeInfo = (row[11] || '').trim();
      const locationText = (row[12] || '').trim();

      // Ensure your Latitude is in Column AA (index 26) and Longitude in AB (index 27)
      const rawLat = (row[26] || '').trim();
      const rawLon = (row[27] || '').trim();

      const lat = parseFloat(rawLat);
      const lon = parseFloat(rawLon);

      // Skip row only if coordinates are completely invalid
      if (isNaN(lat) || isNaN(lon)) {
        continue;
      }

      // Check registration link in column O or U, or any URL string
      const linkCandidate = (row[14] || row[20] || '').trim();
      const browserUrl = linkCandidate.startsWith('http') ? linkCandidate : '';

      events.push({
        id: `event-${i}`,
        title: titleCandidate || 'Community Event',
        hostOrganization: hostOrg,
        date: dateInfo,
        time: timeInfo,
        address: locationText,
        lat: lat,
        lon: lon,
        browserUrl: browserUrl
      });
    }

    return res.status(200).json({
      count: events.length,
      data: events
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message, data: [] });
  }
};
