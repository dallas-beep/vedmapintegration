const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  try {
    const SHEET_ID = '1DJgMiQT6oMxBvdKFK6bha2EEFkJrNrXYU8U0dEMDhhs';
    const GID = '0';
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

    const response = await fetch(csvUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.google.com/'
      }
    });

    if (!response.ok) return res.status(200).json({ count: 0, data: [] });

    const csvText = await response.text();
    const rows = parse(csvText, { skip_empty_lines: true, relax_column_count: true });
    const events = [];

    for (let i = 1; i < rows.length; i++) {
      try {
        const row = rows[i];
        if (!row || row.length < 22) continue;

        const org = String(row[2] || '').trim();
        const date = String(row[11] || '').trim();
        const activityName = String(row[12] || '').trim();
        const time = String(row[13] || '').trim();
        const location = String(row[14] || '').trim();
        const isPublic = String(row[15] || '').trim().toLowerCase();
        const registrationLink = String(row[16] || '').trim();
        const description = String(row[19] || '').trim();

        if (!activityName || isPublic !== 'yes') continue;

        const latStr = String(row[20] || '').trim();
        const lonStr = String(row[21] || '').trim();

        if (!latStr || !lonStr) continue;

        const lat = parseFloat(latStr);
        const lon = parseFloat(lonStr);

        if (isNaN(lat) || isNaN(lon)) continue;
        if (!(lat >= 24 && lat <= 49 && lon >= -125 && lon <= -66)) continue;

        events.push({
          id: activityName,
          title: activityName,
          hostOrganization: org,
          date,
          time,
          description,
          address: location,
          registrationLink: registrationLink || null,
          lat,
          lon
        });
      } catch (rowError) {
        console.error(`Row ${i}: ${rowError.message}`);
      }
    }

    return res.status(200).json({ count: events.length, data: events });
  } catch (error) {
    console.error(`API: ${error.message}`);
    return res.status(200).json({ count: 0, data: [] });
  }
};
